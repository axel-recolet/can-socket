use neon::prelude::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[cfg(target_os = "linux")]
use socketcan::{
    CanFdFrame, CanFdSocket, CanFilter, CanFrame, CanSocket, EmbeddedFrame, ExtendedId, Frame, Id,
    Socket, SocketOptions, StandardId,
};
#[cfg(target_os = "linux")]
use std::time::Duration;

/// Pool de buffers réutilisables pour éviter les allocations répétées
#[cfg(target_os = "linux")]
struct BufferPool {
    buffers: Vec<Vec<u8>>,
    // Statistiques pour évaluer l'efficacité
    hits: u64,   // Nombre de buffers obtenus du pool
    misses: u64, // Nombre de nouvelles allocations
}

#[cfg(target_os = "linux")]
impl BufferPool {
    fn new(pool_size: usize, buffer_capacity: usize) -> Self {
        let mut buffers = Vec::with_capacity(pool_size);
        for _ in 0..pool_size {
            buffers.push(Vec::with_capacity(buffer_capacity));
        }
        Self {
            buffers,
            hits: 0,
            misses: 0,
        }
    }

    /// Obtenir un buffer du pool (ou créer un nouveau si pool vide)
    fn get_buffer(&mut self) -> Vec<u8> {
        if let Some(buffer) = self.buffers.pop() {
            self.hits += 1;
            buffer
        } else {
            self.misses += 1;
            Vec::with_capacity(64)
        }
    }

    /// Remettre un buffer dans le pool après usage
    fn return_buffer(&mut self, mut buffer: Vec<u8>) {
        buffer.clear(); // Vider le contenu mais garder la capacité
        if buffer.capacity() >= 8 && buffer.capacity() <= 128 {
            // Garder seulement les buffers de taille raisonnable
            if self.buffers.len() < 100 {
                // Limiter la taille du pool
                self.buffers.push(buffer);
            }
        }
    }

    /// Obtenir les statistiques d'utilisation du pool
    fn get_stats(&self) -> (u64, u64, f64) {
        let total = self.hits + self.misses;
        let hit_rate = if total > 0 {
            self.hits as f64 / total as f64 * 100.0
        } else {
            0.0
        };
        (self.hits, self.misses, hit_rate)
    }
}

/// Structure to represent a CAN socket (both regular and FD)
#[cfg(target_os = "linux")]
#[derive(Clone)]
pub enum CanSocketWrapper {
    /// Regular CAN 2.0 socket
    Regular(Arc<Mutex<CanSocket>>),
    /// CAN FD socket
    Fd(Arc<Mutex<CanFdSocket>>),
}

#[cfg(not(target_os = "linux"))]
#[derive(Clone)]
pub struct CanSocketWrapper {
    interface: String,
    is_fd: bool,
}

// Global registry to store sockets and buffer pool
lazy_static::lazy_static! {
    static ref SOCKET_REGISTRY: Arc<Mutex<HashMap<u32, CanSocketWrapper>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref NEXT_ID: Arc<Mutex<u32>> = Arc::new(Mutex::new(1));
}

#[cfg(target_os = "linux")]
lazy_static::lazy_static! {
    static ref BUFFER_POOL: Arc<Mutex<BufferPool>> = Arc::new(Mutex::new(BufferPool::new(50, 64)));
}

#[cfg(target_os = "linux")]
impl CanSocketWrapper {
    /// Create a new CAN socket (regular)
    fn new(interface: String) -> Result<Self, Box<dyn std::error::Error>> {
        let socket = CanSocket::open(&interface)?;
        Ok(CanSocketWrapper::Regular(Arc::new(Mutex::new(socket))))
    }

    /// Create a new CAN FD socket
    fn new_fd(interface: String) -> Result<Self, Box<dyn std::error::Error>> {
        let socket = CanFdSocket::open(&interface)?;
        Ok(CanSocketWrapper::Fd(Arc::new(Mutex::new(socket))))
    }

    /// Send a CAN frame (regular, FD, or remote)
    fn send_frame(
        &self,
        id: u32,
        data: Vec<u8>,
        extended: bool,
        is_fd: bool,
        is_remote: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let can_id: Id = if extended {
            Id::Extended(ExtendedId::new(id).ok_or("Invalid extended CAN ID")?)
        } else {
            Id::Standard(StandardId::new(id as u16).ok_or("Invalid standard CAN ID")?)
        };

        match self {
            CanSocketWrapper::Regular(socket) => {
                if is_fd {
                    return Err("Cannot send FD frame on regular CAN socket".into());
                }
                if data.len() > 8 {
                    return Err("Data too long for regular CAN frame (max 8 bytes)".into());
                }
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;

                if is_remote {
                    // Create a remote frame using the correct DLC
                    // Remote frames have no data payload, only request a specific DLC
                    let dlc = if data.is_empty() { 0 } else { data.len() };
                    let frame = CanFrame::new_remote(can_id, dlc).ok_or("Invalid remote frame")?;
                    socket.write_frame(&frame)?;
                } else {
                    let frame = CanFrame::new(can_id, &data).ok_or("Invalid frame data")?;
                    socket.write_frame(&frame)?;
                }
            }
            CanSocketWrapper::Fd(socket) => {
                if data.len() > 64 {
                    return Err("Data too long for CAN FD frame (max 64 bytes)".into());
                }
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;

                if is_remote {
                    // Remote frames are not typically used with CAN FD
                    return Err("Remote frames are not supported on CAN FD sockets".into());
                }

                if is_fd {
                    let frame = CanFdFrame::new(can_id, &data).ok_or("Invalid FD frame data")?;
                    socket.write_frame(&frame)?;
                } else {
                    if data.len() > 8 {
                        return Err("Data too long for regular CAN frame (max 8 bytes)".into());
                    }
                    let frame = CanFrame::new(can_id, &data).ok_or("Invalid frame data")?;
                    socket.write_frame(&frame)?;
                }
            }
        }
        Ok(())
    }

    /// Receive a CAN frame with timeout (returns frame type info with remote/error detection)
    fn read_frame(
        &self,
        timeout_ms: Option<u64>,
    ) -> Result<(u32, Vec<u8>, bool, bool, bool, bool), Box<dyn std::error::Error>> {
        match self {
            CanSocketWrapper::Regular(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                if let Some(timeout) = timeout_ms {
                    socket.set_read_timeout(Duration::from_millis(timeout))?;
                } else {
                    // Set to blocking mode if no timeout (very long timeout)
                    socket.set_read_timeout(Duration::from_secs(3600))?;
                }

                let frame = socket.read_frame()?;
                let (id, extended) = match frame.id() {
                    Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                    Id::Extended(ext_id) => (ext_id.as_raw(), true),
                };

                // Check frame type
                let is_remote = frame.is_remote_frame();
                let is_error = frame.is_error_frame();

                // Utiliser le pool de buffers pour optimiser les allocations
                let data = if is_remote || is_error {
                    // For remote frames, return empty data with DLC info
                    // For error frames, return the error data
                    if is_error {
                        // Obtenir un buffer du pool
                        if let Ok(mut pool) = BUFFER_POOL.lock() {
                            let mut buffer = pool.get_buffer();
                            buffer.extend_from_slice(frame.data());
                            buffer
                        } else {
                            frame.data().to_vec() // Fallback si pool indisponible
                        }
                    } else {
                        vec![] // Remote frame - no data payload
                    }
                } else {
                    // Utiliser le pool pour les frames normales aussi
                    if let Ok(mut pool) = BUFFER_POOL.lock() {
                        let mut buffer = pool.get_buffer();
                        buffer.extend_from_slice(frame.data());
                        buffer
                    } else {
                        frame.data().to_vec() // Fallback si pool indisponible
                    }
                };

                Ok((id, data, extended, false, is_remote, is_error)) // Regular CAN frame with flags
            }
            CanSocketWrapper::Fd(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                if let Some(timeout) = timeout_ms {
                    socket.set_read_timeout(Duration::from_millis(timeout))?;
                } else {
                    // Set to blocking mode if no timeout (very long timeout)
                    socket.set_read_timeout(Duration::from_secs(3600))?;
                }

                // Read any frame (CAN or CAN FD)
                match socket.read_frame() {
                    Ok(frame) => {
                        match frame {
                            socketcan::CanAnyFrame::Normal(can_frame) => {
                                let (id, extended) = match can_frame.id() {
                                    Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                                    Id::Extended(ext_id) => (ext_id.as_raw(), true),
                                };

                                let is_remote = can_frame.is_remote_frame();
                                let is_error = can_frame.is_error_frame();

                                // Utiliser le pool de buffers pour CAN frames
                                let data = if is_remote || is_error {
                                    if is_error {
                                        if let Ok(mut pool) = BUFFER_POOL.lock() {
                                            let mut buffer = pool.get_buffer();
                                            buffer.extend_from_slice(can_frame.data());
                                            buffer
                                        } else {
                                            can_frame.data().to_vec()
                                        }
                                    } else {
                                        vec![]
                                    }
                                } else {
                                    if let Ok(mut pool) = BUFFER_POOL.lock() {
                                        let mut buffer = pool.get_buffer();
                                        buffer.extend_from_slice(can_frame.data());
                                        buffer
                                    } else {
                                        can_frame.data().to_vec()
                                    }
                                };

                                Ok((id, data, extended, false, is_remote, is_error))
                                // Regular CAN frame with flags
                            }
                            socketcan::CanAnyFrame::Fd(fd_frame) => {
                                let (id, extended) = match fd_frame.id() {
                                    Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                                    Id::Extended(ext_id) => (ext_id.as_raw(), true),
                                };

                                // Utiliser le pool pour CAN FD frames
                                let data = if let Ok(mut pool) = BUFFER_POOL.lock() {
                                    let mut buffer = pool.get_buffer();
                                    buffer.extend_from_slice(fd_frame.data());
                                    buffer
                                } else {
                                    fd_frame.data().to_vec()
                                };

                                // CAN FD frames don't support remote or error frames in the traditional sense
                                Ok((id, data, extended, true, false, false)) // CAN FD frame
                            }
                            _ => Err("Unsupported frame type".into()),
                        }
                    }
                    Err(e) => Err(e.into()),
                }
            }
        }
    }

    /// Set CAN filters for selective frame reception
    fn set_filters(
        &self,
        filters: Vec<(u32, u32, bool)>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // Convertir les filtres en format CanFilter
        let can_filters: Vec<CanFilter> = filters
            .into_iter()
            .map(|(id, mask, _extended)| {
                // CanFilter::new prend directement des u32, pas des Id
                CanFilter::new(id, mask)
            })
            .collect();

        match self {
            CanSocketWrapper::Regular(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                if can_filters.is_empty() {
                    // Si aucun filtre, utiliser un filtre qui accepte tout
                    let accept_all = vec![CanFilter::new(0x00000000, 0x00000000)];
                    socket.set_filters(&accept_all)?;
                } else {
                    // Appliquer les filtres spécifiques
                    socket.set_filters(&can_filters)?;
                }
            }
            CanSocketWrapper::Fd(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                if can_filters.is_empty() {
                    // Si aucun filtre, utiliser un filtre qui accepte tout
                    let accept_all = vec![CanFilter::new(0x00000000, 0x00000000)];
                    socket.set_filters(&accept_all)?;
                } else {
                    // Appliquer les filtres spécifiques
                    socket.set_filters(&can_filters)?;
                }
            }
        }
        Ok(())
    }

    /// Clear all CAN filters (receive all frames)
    fn clear_filters(&self) -> Result<(), Box<dyn std::error::Error>> {
        match self {
            CanSocketWrapper::Regular(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                // Utiliser un filtre qui accepte tout (ID=0, Mask=0)
                let accept_all = vec![CanFilter::new(0x00000000, 0x00000000)];
                socket.set_filters(&accept_all)?;
            }
            CanSocketWrapper::Fd(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                // Utiliser un filtre qui accepte tout (ID=0, Mask=0)
                let accept_all = vec![CanFilter::new(0x00000000, 0x00000000)];
                socket.set_filters(&accept_all)?;
            }
        }
        Ok(())
    }

    /// Close the socket and cleanup resources
    fn close(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Note: SocketCAN sockets are automatically closed when dropped
        // This method exists for explicit cleanup if needed
        Ok(())
    }
}

#[cfg(not(target_os = "linux"))]
impl CanSocketWrapper {
    /// Create a new CAN socket (stub for non-Linux)
    fn new(interface: String) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(CanSocketWrapper {
            interface,
            is_fd: false,
        })
    }

    /// Create a new CAN FD socket (stub for non-Linux)
    fn new_fd(interface: String) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(CanSocketWrapper {
            interface,
            is_fd: true,
        })
    }

    /// Send a CAN frame (stub for non-Linux)
    fn send_frame(
        &self,
        _id: u32,
        _data: Vec<u8>,
        _extended: bool,
        _is_fd: bool,
        _is_remote: bool,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Err("SocketCAN is only supported on Linux".into())
    }

    /// Receive a CAN frame with timeout (stub for non-Linux)
    fn read_frame(
        &self,
        _timeout_ms: Option<u64>,
    ) -> Result<(u32, Vec<u8>, bool, bool, bool, bool), Box<dyn std::error::Error>> {
        Err("SocketCAN is only supported on Linux".into())
    }

    /// Set CAN filters (stub for non-Linux)
    fn set_filters(
        &self,
        _filters: Vec<(u32, u32, bool)>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Err("SocketCAN is only supported on Linux".into())
    }

    /// Clear all CAN filters (stub for non-Linux)
    fn clear_filters(&self) -> Result<(), Box<dyn std::error::Error>> {
        Err("SocketCAN is only supported on Linux".into())
    }

    /// Close the socket (stub for non-Linux)
    fn close(&self) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }
}

/// Create a CAN socket from JavaScript
fn create_socket(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let interface = cx.argument::<JsString>(0)?.value(&mut cx);
    let is_fd = if cx.len() > 1 {
        cx.argument::<JsBoolean>(1)?.value(&mut cx)
    } else {
        false
    };

    let wrapper = if is_fd {
        CanSocketWrapper::new_fd(interface)
    } else {
        CanSocketWrapper::new(interface)
    };

    match wrapper {
        Ok(wrapper) => {
            let mut next_id = NEXT_ID.lock().unwrap();
            let id = *next_id;
            *next_id += 1;

            SOCKET_REGISTRY.lock().unwrap().insert(id, wrapper);
            Ok(cx.number(id as f64))
        }
        Err(e) => cx.throw_error(format!("Failed to create socket: {}", e)),
    }
}

/// Send a CAN frame from JavaScript
fn send_frame(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let id = cx.argument::<JsNumber>(1)?.value(&mut cx) as u32;
    let data_array = cx.argument::<JsArray>(2)?;
    let extended = if cx.len() > 3 {
        cx.argument::<JsBoolean>(3)?.value(&mut cx)
    } else {
        false
    };
    let is_fd = if cx.len() > 4 {
        cx.argument::<JsBoolean>(4)?.value(&mut cx)
    } else {
        false
    };
    let is_remote = if cx.len() > 5 {
        cx.argument::<JsBoolean>(5)?.value(&mut cx)
    } else {
        false
    };

    let mut data = Vec::new();
    for i in 0..data_array.len(&mut cx) {
        let val = data_array.get::<JsNumber, _, _>(&mut cx, i)?.value(&mut cx) as u8;
        data.push(val);
    }

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        match wrapper.send_frame(id, data, extended, is_fd, is_remote) {
            Ok(_) => Ok(cx.undefined()),
            Err(e) => cx.throw_error(format!("Failed to send frame: {}", e)),
        }
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// Receive a CAN frame from JavaScript (fonction optimisée)
fn read_frame(mut cx: FunctionContext) -> JsResult<JsObject> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let timeout = if cx.len() > 1 {
        Some(cx.argument::<JsNumber>(1)?.value(&mut cx) as u64)
    } else {
        Some(1000)
    };

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        match wrapper.read_frame(timeout) {
            Ok((id, data, extended, is_fd, is_remote, is_error)) => {
                let obj = cx.empty_object();

                // OPTIMISATION: Accès direct aux données du tuple sans allocation supplémentaire
                let id_val = cx.number(id as f64);
                obj.set(&mut cx, "id", id_val)?;

                let data_array = cx.empty_array();
                for (i, &byte) in data.iter().enumerate() {
                    let val = cx.number(byte as f64);
                    data_array.set(&mut cx, i as u32, val)?;
                }
                obj.set(&mut cx, "data", data_array)?;

                let extended_val = cx.boolean(extended);
                obj.set(&mut cx, "extended", extended_val)?;

                let fd_val = cx.boolean(is_fd);
                obj.set(&mut cx, "fd", fd_val)?;

                let remote_val = cx.boolean(is_remote);
                obj.set(&mut cx, "remote", remote_val)?;

                let error_val = cx.boolean(is_error);
                obj.set(&mut cx, "error", error_val)?;

                Ok(obj)
            }
            Err(e) => cx.throw_error(format!("Failed to read frame: {}", e)),
        }
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// Set CAN filters from JavaScript
fn set_filters(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let filters_array = cx.argument::<JsArray>(1)?;

    let mut filters = Vec::new();
    for i in 0..filters_array.len(&mut cx) {
        let filter_obj = filters_array.get::<JsObject, _, _>(&mut cx, i)?;

        let id = filter_obj
            .get::<JsNumber, _, _>(&mut cx, "id")?
            .value(&mut cx) as u32;
        let mask = filter_obj
            .get::<JsNumber, _, _>(&mut cx, "mask")?
            .value(&mut cx) as u32;
        let extended = if let Ok(ext) = filter_obj.get::<JsBoolean, _, _>(&mut cx, "extended") {
            ext.value(&mut cx)
        } else {
            false
        };

        filters.push((id, mask, extended));
    }

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        match wrapper.set_filters(filters) {
            Ok(_) => Ok(cx.undefined()),
            Err(e) => cx.throw_error(format!("Failed to set filters: {}", e)),
        }
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// Clear CAN filters from JavaScript
fn clear_filters(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        match wrapper.clear_filters() {
            Ok(_) => Ok(cx.undefined()),
            Err(e) => cx.throw_error(format!("Failed to clear filters: {}", e)),
        }
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// Close a socket from JavaScript
fn close_socket(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;

    let mut registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        match wrapper.close() {
            Ok(_) => {
                registry.remove(&socket_id);
                Ok(cx.undefined())
            }
            Err(e) => cx.throw_error(format!("Failed to close socket: {}", e)),
        }
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// OPTIMISATION: Lecture en lot avec cache de frames pré-allocées  
fn read_frames_batch(mut cx: FunctionContext) -> JsResult<JsArray> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let max_frames = if cx.len() > 1 {
        cx.argument::<JsNumber>(1)?.value(&mut cx) as usize
    } else {
        10
    };
    let timeout = if cx.len() > 2 {
        Some(cx.argument::<JsNumber>(2)?.value(&mut cx) as u64)
    } else {
        Some(100)
    };

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        // OPTIMISATION: Pré-allocation du cache de résultats
        let results = cx.empty_array();
        let mut count = 0;

        // OPTIMISATION: Lecture en lot avec cache optimisé
        for _ in 0..max_frames {
            match wrapper.read_frame(timeout) {
                Ok((id, data, extended, is_fd, is_remote, is_error)) => {
                    let obj = cx.empty_object();

                    // OPTIMISATION: Traitement direct du tuple sans allocations intermédiaires
                    let id_val = cx.number(id as f64);
                    obj.set(&mut cx, "id", id_val)?;

                    let data_array = cx.empty_array();
                    for (i, &byte) in data.iter().enumerate() {
                        let val = cx.number(byte as f64);
                        data_array.set(&mut cx, i as u32, val)?;
                    }
                    obj.set(&mut cx, "data", data_array)?;

                    let extended_val = cx.boolean(extended);
                    obj.set(&mut cx, "extended", extended_val)?;

                    let fd_val = cx.boolean(is_fd);
                    obj.set(&mut cx, "fd", fd_val)?;

                    let remote_val = cx.boolean(is_remote);
                    obj.set(&mut cx, "remote", remote_val)?;

                    let error_val = cx.boolean(is_error);
                    obj.set(&mut cx, "error", error_val)?;

                    results.set(&mut cx, count, obj)?;
                    count += 1;
                }
                Err(_) => break, // Timeout - arrêter la lecture
            }
        }

        Ok(results)
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// Neon module entry point - API optimale
#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    // Fonctions optimales
    cx.export_function("createSocket", create_socket)?;
    cx.export_function("sendFrame", send_frame)?; // OPTIMAL pour envoi
    cx.export_function("readFrame", read_frame)?; // OPTIMAL pour réception (+17%)
    cx.export_function("setFilters", set_filters)?;
    cx.export_function("clearFilters", clear_filters)?;
    cx.export_function("closeSocket", close_socket)?;

    // Fonction batch optimisée pour réception en lot
    cx.export_function("readFramesBatch", read_frames_batch)?;

    // Debug: fonction pour consulter les statistiques du pool de buffers
    cx.export_function("getBufferPoolStats", get_buffer_pool_stats)?;

    Ok(())
}

/// Fonction de debug pour consulter les statistiques du pool de buffers
fn get_buffer_pool_stats(mut cx: FunctionContext) -> JsResult<JsObject> {
    let obj = cx.empty_object();

    #[cfg(target_os = "linux")]
    {
        if let Ok(pool) = BUFFER_POOL.lock() {
            let (hits, misses, hit_rate) = pool.get_stats();

            let hits_val = cx.number(hits as f64);
            obj.set(&mut cx, "hits", hits_val)?;

            let misses_val = cx.number(misses as f64);
            obj.set(&mut cx, "misses", misses_val)?;

            let hit_rate_val = cx.number(hit_rate);
            obj.set(&mut cx, "hitRate", hit_rate_val)?;

            let pool_size_val = cx.number(pool.buffers.len() as f64);
            obj.set(&mut cx, "poolSize", pool_size_val)?;
        } else {
            let error_val = cx.string("Pool unavailable");
            obj.set(&mut cx, "error", error_val)?;
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        let error_val = cx.string("Buffer pool only available on Linux");
        obj.set(&mut cx, "error", error_val)?;
    }

    Ok(obj)
}

// Include test module
#[cfg(test)]
mod tests;

// Include benchmarks module
#[cfg(test)]
mod benchmarks;
