use neon::prelude::*;
use neon::types::buffer::TypedArray;
use std::borrow::{Borrow, BorrowMut};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[cfg(target_os = "linux")]
use socketcan::{
    CanFdFrame, CanFdSocket, CanFilter, CanFrame, CanSocket, EmbeddedFrame, ExtendedId, Frame, Id,
    Socket, SocketOptions, StandardId,
};
#[cfg(target_os = "linux")]
use std::time::Duration;

// Optimisation 1: Pool de buffers réutilisables pour éviter les allocations
lazy_static::lazy_static! {
    static ref BUFFER_POOL: Arc<Mutex<Vec<Vec<u8>>>> = Arc::new(Mutex::new(Vec::new()));
    static ref SOCKET_REGISTRY: Arc<Mutex<HashMap<u32, CanSocketWrapper>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref NEXT_ID: Arc<Mutex<u32>> = Arc::new(Mutex::new(1));
}

// Structure de socket compatible avec l'original (pour les fonctions legacy)
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

    /// Send a CAN frame
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

    /// Receive a CAN frame with timeout
    fn read_frame(
        &self,
        timeout_ms: Option<u64>,
    ) -> Result<(u32, Vec<u8>, bool, bool, bool, bool), Box<dyn std::error::Error>> {
        match self {
            CanSocketWrapper::Regular(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                if let Some(timeout) = timeout_ms {
                    socket.set_read_timeout(Duration::from_millis(timeout))?;
                }

                let frame = match socket.read_frame() {
                    Ok(frame) => frame,
                    Err(e) => {
                        let error_str = e.to_string().to_lowercase();
                        if error_str.contains("timeout")
                            || error_str.contains("timed out")
                            || error_str.contains("would block")
                            || error_str.contains("eagain")
                            || error_str.contains("resource temporarily unavailable")
                        {
                            return Err("Operation timed out".into());
                        }
                        return Err(e.into());
                    }
                };
                let (id, extended) = match frame.id() {
                    Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                    Id::Extended(ext_id) => (ext_id.as_raw(), true),
                };

                let is_remote = frame.is_remote_frame();
                let is_error = frame.is_error_frame();

                let data = if is_remote || is_error {
                    if is_error {
                        frame.data().to_vec()
                    } else {
                        vec![]
                    }
                } else {
                    frame.data().to_vec()
                };

                Ok((id, data, extended, false, is_remote, is_error))
            }
            CanSocketWrapper::Fd(socket) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                if let Some(timeout) = timeout_ms {
                    socket.set_read_timeout(Duration::from_millis(timeout))?;
                }

                let frame = match socket.read_frame() {
                    Ok(frame) => frame,
                    Err(e) => {
                        let error_str = e.to_string().to_lowercase();
                        if error_str.contains("timeout")
                            || error_str.contains("timed out")
                            || error_str.contains("would block")
                            || error_str.contains("eagain")
                            || error_str.contains("resource temporarily unavailable")
                        {
                            return Err("Operation timed out".into());
                        }
                        return Err(e.into());
                    }
                };

                match frame {
                    socketcan::CanAnyFrame::Normal(can_frame) => {
                        let (id, extended) = match can_frame.id() {
                            Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                            Id::Extended(ext_id) => (ext_id.as_raw(), true),
                        };

                        let is_remote = can_frame.is_remote_frame();
                        let is_error = can_frame.is_error_frame();

                        let data = if is_remote || is_error {
                            if is_error {
                                can_frame.data().to_vec()
                            } else {
                                vec![]
                            }
                        } else {
                            can_frame.data().to_vec()
                        };

                        Ok((id, data, extended, false, is_remote, is_error))
                    }
                    socketcan::CanAnyFrame::Fd(fd_frame) => {
                        let (id, extended) = match fd_frame.id() {
                            Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                            Id::Extended(ext_id) => (ext_id.as_raw(), true),
                        };
                        let data = fd_frame.data().to_vec();
                        Ok((id, data, extended, true, false, false))
                    }
                    _ => Err("Unsupported frame type".into()),
                }
            }
        }
    }

    /// Set CAN filters
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

    /// Close the socket
    fn close(&self) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }
}

#[cfg(not(target_os = "linux"))]
impl CanSocketWrapper {
    fn new(interface: String) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(CanSocketWrapper {
            interface,
            is_fd: false,
        })
    }

    fn new_fd(interface: String) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(CanSocketWrapper {
            interface,
            is_fd: true,
        })
    }

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

    fn read_frame(
        &self,
        _timeout_ms: Option<u64>,
    ) -> Result<(u32, Vec<u8>, bool, bool, bool, bool), Box<dyn std::error::Error>> {
        Err("SocketCAN is only supported on Linux".into())
    }

    fn set_filters(
        &self,
        _filters: Vec<(u32, u32, bool)>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Err("SocketCAN is only supported on Linux".into())
    }

    fn clear_filters(&self) -> Result<(), Box<dyn std::error::Error>> {
        Err("SocketCAN is only supported on Linux".into())
    }

    fn close(&self) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }
}

/// Create a new CAN socket from JavaScript
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
        Ok(socket) => {
            let mut next_id = NEXT_ID.lock().unwrap();
            let socket_id = *next_id;
            *next_id += 1;

            let mut registry = SOCKET_REGISTRY.lock().unwrap();
            registry.insert(socket_id, socket);

            Ok(cx.number(socket_id as f64))
        }
        Err(e) => cx.throw_error(format!("Failed to create socket: {}", e)),
    }
}

/// Send a CAN frame from JavaScript (legacy compatibility)
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

/// Receive a CAN frame from JavaScript (legacy compatibility)
fn read_frame(mut cx: FunctionContext) -> JsResult<JsObject> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let timeout = if cx.len() > 1 {
        Some(cx.argument::<JsNumber>(1)?.value(&mut cx) as u64)
    } else {
        None
    };

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        match wrapper.read_frame(timeout) {
            Ok((id, data, extended, is_fd, is_remote, is_error)) => {
                let result = cx.empty_object();
                let js_id = cx.number(id as f64);
                let js_extended = cx.boolean(extended);
                let js_is_fd = cx.boolean(is_fd);
                let js_is_remote = cx.boolean(is_remote);
                let js_is_error = cx.boolean(is_error);
                let js_data = cx.empty_array();

                for (i, byte) in data.iter().enumerate() {
                    let js_byte = cx.number(*byte as f64);
                    js_data.set(&mut cx, i as u32, js_byte)?;
                }

                result.set(&mut cx, "id", js_id)?;
                result.set(&mut cx, "data", js_data)?;
                result.set(&mut cx, "extended", js_extended)?;
                result.set(&mut cx, "fd", js_is_fd)?;
                result.set(&mut cx, "remote", js_is_remote)?;
                result.set(&mut cx, "error", js_is_error)?;

                Ok(result)
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

// Optimisation 2: Cache de frames pré-allouées
#[derive(Clone)]
struct FrameCache {
    buffers: Vec<Vec<u8>>,
    next_index: usize,
}

impl FrameCache {
    fn new(capacity: usize) -> Self {
        let mut buffers = Vec::with_capacity(capacity);
        for _ in 0..capacity {
            buffers.push(vec![0u8; 64]); // Pre-allocate max CAN FD size
        }
        Self {
            buffers,
            next_index: 0,
        }
    }

    fn get_buffer(&mut self) -> &mut Vec<u8> {
        let len = self.buffers.len();
        let current_index = self.next_index;
        self.next_index = (self.next_index + 1) % len;
        let buffer = &mut self.buffers[current_index];
        buffer.clear();
        buffer
    }
}

// Optimisation 3: Structure de socket optimisée avec cache
#[cfg(target_os = "linux")]
#[derive(Clone)]
pub enum OptimizedCanSocketWrapper {
    Regular(Arc<Mutex<CanSocket>>, Arc<Mutex<FrameCache>>),
    Fd(Arc<Mutex<CanFdSocket>>, Arc<Mutex<FrameCache>>),
}

impl OptimizedCanSocketWrapper {
    /// Create optimized CAN socket with frame cache
    fn new_optimized(interface: String) -> Result<Self, Box<dyn std::error::Error>> {
        let socket = CanSocket::open(&interface)?;
        let cache = Arc::new(Mutex::new(FrameCache::new(100))); // 100 pre-allocated buffers
        Ok(OptimizedCanSocketWrapper::Regular(
            Arc::new(Mutex::new(socket)),
            cache,
        ))
    }

    /// Send frame with zero-copy optimization when possible
    fn send_frame_optimized(
        &self,
        id: u32,
        data: &[u8], // Use slice instead of Vec to avoid allocation
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
            OptimizedCanSocketWrapper::Regular(socket, _) => {
                if is_fd {
                    return Err("Cannot send FD frame on regular CAN socket".into());
                }
                if data.len() > 8 {
                    return Err("Data too long for regular CAN frame (max 8 bytes)".into());
                }
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;

                if is_remote {
                    let dlc = if data.is_empty() { 0 } else { data.len() };
                    let frame = CanFrame::new_remote(can_id, dlc).ok_or("Invalid remote frame")?;
                    socket.write_frame(&frame)?;
                } else {
                    // Optimisation: Construire directement sans allocation
                    let frame = CanFrame::new(can_id, data).ok_or("Invalid frame data")?;
                    socket.write_frame(&frame)?;
                }
            }
            OptimizedCanSocketWrapper::Fd(socket, _) => {
                if data.len() > 64 {
                    return Err("Data too long for CAN FD frame (max 64 bytes)".into());
                }
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;

                if is_remote {
                    return Err("Remote frames are not supported on CAN FD sockets".into());
                }

                if is_fd {
                    let frame = CanFdFrame::new(can_id, data).ok_or("Invalid FD frame data")?;
                    socket.write_frame(&frame)?;
                } else {
                    if data.len() > 8 {
                        return Err("Data too long for regular CAN frame (max 8 bytes)".into());
                    }
                    let frame = CanFrame::new(can_id, data).ok_or("Invalid frame data")?;
                    socket.write_frame(&frame)?;
                }
            }
        }
        Ok(())
    }

    /// Batch read multiple frames for better performance
    fn read_frames_batch(
        &self,
        max_frames: usize,
        timeout_ms: Option<u64>,
    ) -> Result<Vec<(u32, Vec<u8>, bool, bool, bool, bool)>, Box<dyn std::error::Error>> {
        let mut frames = Vec::with_capacity(max_frames);

        match self {
            OptimizedCanSocketWrapper::Regular(socket, cache) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                let mut cache = cache.lock().map_err(|_| "Cache mutex poisoned")?;

                if let Some(timeout) = timeout_ms {
                    socket.set_read_timeout(Duration::from_millis(timeout))?;
                }

                for _ in 0..max_frames {
                    match socket.read_frame() {
                        Ok(frame) => {
                            let (id, extended) = match frame.id() {
                                Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                                Id::Extended(ext_id) => (ext_id.as_raw(), true),
                            };

                            let is_remote = frame.is_remote_frame();
                            let is_error = frame.is_error_frame();

                            // Use cached buffer to avoid allocation
                            let buffer = cache.get_buffer();
                            if is_remote || is_error {
                                if is_error {
                                    buffer.extend_from_slice(frame.data());
                                }
                            } else {
                                buffer.extend_from_slice(frame.data());
                            }

                            frames.push((id, buffer.clone(), extended, false, is_remote, is_error));
                        }
                        Err(e) => {
                            let error_str = e.to_string().to_lowercase();
                            if error_str.contains("timeout") || error_str.contains("would block") {
                                break; // No more frames available
                            }
                            return Err(e.into());
                        }
                    }
                }
            }
            OptimizedCanSocketWrapper::Fd(socket, cache) => {
                let socket = socket.lock().map_err(|_| "Mutex poisoned")?;
                let mut cache = cache.lock().map_err(|_| "Cache mutex poisoned")?;

                if let Some(timeout) = timeout_ms {
                    socket.set_read_timeout(Duration::from_millis(timeout))?;
                }

                for _ in 0..max_frames {
                    match socket.read_frame() {
                        Ok(frame) => match frame {
                            socketcan::CanAnyFrame::Normal(can_frame) => {
                                let (id, extended) = match can_frame.id() {
                                    Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                                    Id::Extended(ext_id) => (ext_id.as_raw(), true),
                                };

                                let is_remote = can_frame.is_remote_frame();
                                let is_error = can_frame.is_error_frame();

                                let buffer = cache.get_buffer();
                                if is_remote || is_error {
                                    if is_error {
                                        buffer.extend_from_slice(can_frame.data());
                                    }
                                } else {
                                    buffer.extend_from_slice(can_frame.data());
                                }

                                frames.push((
                                    id,
                                    buffer.clone(),
                                    extended,
                                    false,
                                    is_remote,
                                    is_error,
                                ));
                            }
                            socketcan::CanAnyFrame::Fd(fd_frame) => {
                                let (id, extended) = match fd_frame.id() {
                                    Id::Standard(std_id) => (std_id.as_raw() as u32, false),
                                    Id::Extended(ext_id) => (ext_id.as_raw(), true),
                                };

                                let buffer = cache.get_buffer();
                                buffer.extend_from_slice(fd_frame.data());
                                frames.push((id, buffer.clone(), extended, true, false, false));
                            }
                            _ => return Err("Unsupported frame type".into()),
                        },
                        Err(e) => {
                            let error_str = e.to_string().to_lowercase();
                            if error_str.contains("timeout") || error_str.contains("would block") {
                                break;
                            }
                            return Err(e.into());
                        }
                    }
                }
            }
        }

        Ok(frames)
    }
}

/// Optimized batch send function for JavaScript
fn send_frames_batch(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let frames_array = cx.argument::<JsArray>(1)?;

    let mut frame_data = Vec::new();

    // Pre-process all frame data to minimize JavaScript interaction
    for i in 0..frames_array.len(&mut cx) {
        let frame_obj = frames_array.get::<JsObject, _, _>(&mut cx, i)?;

        let id = frame_obj
            .get::<JsNumber, _, _>(&mut cx, "id")?
            .value(&mut cx) as u32;
        let data_array = frame_obj.get::<JsArray, _, _>(&mut cx, "data")?;
        let extended = frame_obj
            .get::<JsBoolean, _, _>(&mut cx, "extended")?
            .value(&mut cx);
        let is_fd = frame_obj
            .get::<JsBoolean, _, _>(&mut cx, "fd")?
            .value(&mut cx);
        let is_remote = frame_obj
            .get::<JsBoolean, _, _>(&mut cx, "remote")?
            .value(&mut cx);

        let mut data = Vec::with_capacity(data_array.len(&mut cx) as usize);
        for j in 0..data_array.len(&mut cx) {
            let val = data_array.get::<JsNumber, _, _>(&mut cx, j)?.value(&mut cx) as u8;
            data.push(val);
        }

        frame_data.push((id, data, extended, is_fd, is_remote));
    }

    // Now send all frames in Rust land with minimal JS overhead
    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        for (id, data, extended, is_fd, is_remote) in frame_data {
            if let Err(e) = wrapper.send_frame(id, data, extended, is_fd, is_remote) {
                return cx.throw_error(format!("Failed to send frame: {}", e));
            }
        }
        Ok(cx.undefined())
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// OPTIMISATION CRITIQUE: Lecture de frames en lot avec ArrayBuffer (zero-copy)
fn read_frames_batch_optimized(mut cx: FunctionContext) -> JsResult<JsArrayBuffer> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let max_frames = cx.argument::<JsNumber>(1)?.value(&mut cx) as usize;
    let timeout = if cx.len() > 2 {
        Some(cx.argument::<JsNumber>(2)?.value(&mut cx) as u64)
    } else {
        None
    };

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        let mut frames = Vec::new();

        for _ in 0..max_frames {
            match wrapper.read_frame(timeout) {
                Ok(frame_data) => frames.push(frame_data),
                Err(_) => break, // No more frames or timeout
            }
        }

        // Sérialiser les frames dans un ArrayBuffer compact (format binaire)
        let mut buffer_data = Vec::new();

        for (id, data, extended, is_fd, is_remote, is_error) in frames {
            // Format compact: [id:u32][data_len:u8][flags:u8][data:data_len]
            buffer_data.extend_from_slice(&id.to_le_bytes());
            buffer_data.push(data.len() as u8);

            // Pack tous les flags dans un seul byte pour économiser l'espace
            let flags = (extended as u8)
                | ((is_fd as u8) << 1)
                | ((is_remote as u8) << 2)
                | ((is_error as u8) << 3);
            buffer_data.push(flags);

            buffer_data.extend_from_slice(&data);
        }

        // Créer l'ArrayBuffer et copier les données
        let buffer = cx.array_buffer(buffer_data.len())?;
        {
            let mut buffer_guard = buffer.borrow_mut(&mut cx);
            buffer_guard.as_mut_slice(&mut cx).copy_from_slice(&buffer_data);
        }

        Ok(buffer)
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// OPTIMISATION CRITIQUE: Envoi de frames en lot avec ArrayBuffer (zero-copy)
fn send_frames_batch_optimized(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let frames_buffer = cx.argument::<JsArrayBuffer>(1)?;

    // Lire le buffer de frames directement
    let frames_data = {
        let buffer_guard = frames_buffer.borrow(&cx);
        buffer_guard.as_slice(&cx).to_vec()
    };

    // Désérialiser les frames du buffer (format compact binaire)
    let mut frames = Vec::new();
    let mut offset = 0;

    while offset + 6 < frames_data.len() {
        // Minimum: 4+1+1 = 6 bytes
        // Format: [id:u32][data_len:u8][flags:u8][data:data_len]
        let id = u32::from_le_bytes([
            frames_data[offset],
            frames_data[offset + 1],
            frames_data[offset + 2],
            frames_data[offset + 3],
        ]);
        offset += 4;

        let data_len = frames_data[offset] as usize;
        offset += 1;

        let flags = frames_data[offset];
        offset += 1;

        // Unpacker les flags
        let extended = (flags & 0x01) != 0;
        let is_fd = (flags & 0x02) != 0;
        let is_remote = (flags & 0x04) != 0;

        if offset + data_len > frames_data.len() {
            break; // Buffer corrompu ou incomplet
        }

        let data = frames_data[offset..offset + data_len].to_vec();
        offset += data_len;

        frames.push((id, data, extended, is_fd, is_remote));
    }

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        let mut sent_count = 0;

        // Traitement en lot optimisé - tout en Rust
        for (id, data, extended, is_fd, is_remote) in frames {
            match wrapper.send_frame(id, data, extended, is_fd, is_remote) {
                Ok(_) => sent_count += 1,
                Err(e) => {
                    return cx.throw_error(format!("Failed to send frame {}: {}", sent_count, e))
                }
            }
        }

        Ok(cx.number(sent_count as f64))
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// OPTIMISATION: Envoi de frame unique avec ArrayBuffer pour les données
fn send_frame_optimized(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let id = cx.argument::<JsNumber>(1)?.value(&mut cx) as u32;
    let data_buffer = cx.argument::<JsArrayBuffer>(2)?;
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

    // Lire les données directement du buffer
    let data = {
        let buffer_guard = data_buffer.borrow(&cx);
        buffer_guard.as_slice(&cx).to_vec()
    };

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

/// OPTIMISATION: Réception de frame unique avec ArrayBuffer pour les données  
fn read_frame_optimized(mut cx: FunctionContext) -> JsResult<JsObject> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let timeout = if cx.len() > 1 {
        Some(cx.argument::<JsNumber>(1)?.value(&mut cx) as u64)
    } else {
        None
    };

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        match wrapper.read_frame(timeout) {
            Ok((id, data, extended, is_fd, is_remote, is_error)) => {
                let result = cx.empty_object();
                let js_id = cx.number(id as f64);
                let js_extended = cx.boolean(extended);
                let js_is_fd = cx.boolean(is_fd);
                let js_is_remote = cx.boolean(is_remote);
                let js_is_error = cx.boolean(is_error);

                // Utiliser ArrayBuffer pour les données
                let data_buffer = cx.array_buffer(data.len())?;
                {
                    let mut buffer_guard = data_buffer.borrow_mut(&mut cx);
                    buffer_guard.as_mut_slice(&mut cx).copy_from_slice(&data);
                }

                result.set(&mut cx, "id", js_id)?;
                result.set(&mut cx, "data", data_buffer)?;
                result.set(&mut cx, "extended", js_extended)?;
                result.set(&mut cx, "fd", js_is_fd)?;
                result.set(&mut cx, "remote", js_is_remote)?;
                result.set(&mut cx, "error", js_is_error)?;

                Ok(result)
            }
            Err(e) => cx.throw_error(format!("Failed to read frame: {}", e)),
        }
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// Optimized batch read function for JavaScript (legacy compatibility)
fn read_frames_batch(mut cx: FunctionContext) -> JsResult<JsArray> {
    let socket_id = cx.argument::<JsNumber>(0)?.value(&mut cx) as u32;
    let max_frames = cx.argument::<JsNumber>(1)?.value(&mut cx) as usize;
    let timeout = if cx.len() > 2 {
        Some(cx.argument::<JsNumber>(2)?.value(&mut cx) as u64)
    } else {
        None
    };

    let registry = SOCKET_REGISTRY.lock().unwrap();
    if let Some(wrapper) = registry.get(&socket_id) {
        // Cast to optimized wrapper if needed
        // For this example, we'll use the regular read_frame in a loop
        let mut frames = Vec::new();

        for _ in 0..max_frames {
            match wrapper.read_frame(timeout) {
                Ok(frame_data) => frames.push(frame_data),
                Err(_) => break, // No more frames or timeout
            }
        }

        let js_frames = cx.empty_array();
        for (i, (id, data, extended, is_fd, is_remote, is_error)) in frames.iter().enumerate() {
            let frame_obj = cx.empty_object();

            let js_id = cx.number(*id as f64);
            let js_extended = cx.boolean(*extended);
            let js_is_fd = cx.boolean(*is_fd);
            let js_is_remote = cx.boolean(*is_remote);
            let js_is_error = cx.boolean(*is_error);

            frame_obj.set(&mut cx, "id", js_id)?;
            frame_obj.set(&mut cx, "extended", js_extended)?;
            frame_obj.set(&mut cx, "fd", js_is_fd)?;
            frame_obj.set(&mut cx, "remote", js_is_remote)?;
            frame_obj.set(&mut cx, "error", js_is_error)?;

            let js_data = cx.empty_array();
            for (j, byte) in data.iter().enumerate() {
                let js_byte = cx.number(*byte as f64);
                js_data.set(&mut cx, j as u32, js_byte)?;
            }
            frame_obj.set(&mut cx, "data", js_data)?;

            js_frames.set(&mut cx, i as u32, frame_obj)?;
        }

        Ok(js_frames)
    } else {
        cx.throw_error("Invalid socket ID")
    }
}

/// Neon module entry point avec optimisations critiques
#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    // Fonctions legacy pour compatibilité avec l'API existante
    cx.export_function("createSocket", create_socket)?;
    cx.export_function("sendFrame", send_frame)?;
    cx.export_function("readFrame", read_frame)?;
    cx.export_function("setFilters", set_filters)?;
    cx.export_function("clearFilters", clear_filters)?;
    cx.export_function("closeSocket", close_socket)?;

    // Nouvelles fonctions optimisées avec ArrayBuffer (GAINS CRITIQUES)
    cx.export_function("sendFrameOptimized", send_frame_optimized)?;
    cx.export_function("readFrameOptimized", read_frame_optimized)?;
    cx.export_function("sendFramesBatchOptimized", send_frames_batch_optimized)?;
    cx.export_function("readFramesBatchOptimized", read_frames_batch_optimized)?;

    // Fonctions batch legacy (compatibilité)
    cx.export_function("sendFramesBatch", send_frames_batch)?;
    cx.export_function("readFramesBatch", read_frames_batch)?;

    Ok(())
}

// Include test module
#[cfg(test)]
mod tests_optimized;
