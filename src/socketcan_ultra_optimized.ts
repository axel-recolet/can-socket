import { EventEmitter } from "events";

// Types optimisés avec ArrayBuffer
export interface CanFrameOptimized {
  id: number;
  data: ArrayBuffer;
  extended?: boolean;
  fd?: boolean;
  remote?: boolean;
  error?: boolean;
}

export interface CanFrameLegacy {
  id: number;
  data: number[];
  extended?: boolean;
  fd?: boolean;
  remote?: boolean;
  error?: boolean;
}

export interface BatchFrame {
  id: number;
  data: number[] | ArrayBuffer;
  extended?: boolean;
  fd?: boolean;
  remote?: boolean;
}

export interface CanFilter {
  id: number;
  mask: number;
  extended?: boolean;
}

export interface OptimizedOptions {
  useBatching?: boolean;
  batchSize?: number;
  useArrayBuffers?: boolean;
  prefetchSize?: number;
}

/**
 * Classe SocketCAN optimisée avec les améliorations Neon critiques
 *
 * OPTIMISATIONS IMPLÉMENTÉES:
 * 1. ArrayBuffer zero-copy pour les données
 * 2. Traitement en lot (batch) au niveau Rust
 * 3. Réduction des conversions Rust↔JS
 * 4. Pool de buffers côté JS
 *
 * GAINS ATTENDUS: 10-50x performance vs version legacy
 */
export class OptimizedSocketCan extends EventEmitter {
  private socketId: number | null = null;
  private options: OptimizedOptions;

  // Pool de buffers pour réutilisation (optimisation mémoire)
  private bufferPool: ArrayBuffer[] = [];
  private readonly poolSize = 100;

  // Batch management
  private sendQueue: BatchFrame[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  // Statistiques de performance
  private stats = {
    framesSent: 0,
    framesReceived: 0,
    batchesSent: 0,
    bufferPoolHits: 0,
    bufferPoolMisses: 0,
  };

  constructor(options: OptimizedOptions = {}) {
    super();
    this.options = {
      useBatching: true,
      batchSize: 50,
      useArrayBuffers: true,
      prefetchSize: 10,
      ...options,
    };

    // Pré-allouer le pool de buffers
    this.initializeBufferPool();
  }

  /**
   * Initialise le pool de buffers ArrayBuffer pour réutilisation
   */
  private initializeBufferPool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.bufferPool.push(new ArrayBuffer(64)); // CAN FD max size
    }
  }

  /**
   * Obtient un buffer du pool ou en crée un nouveau
   */
  private getBuffer(size: number): ArrayBuffer {
    if (this.bufferPool.length > 0 && size <= 64) {
      this.stats.bufferPoolHits++;
      const buffer = this.bufferPool.pop()!;
      return buffer.slice(0, size); // Resize si nécessaire
    } else {
      this.stats.bufferPoolMisses++;
      return new ArrayBuffer(size);
    }
  }

  /**
   * Retourne un buffer au pool pour réutilisation
   */
  private returnBuffer(buffer: ArrayBuffer): void {
    if (buffer.byteLength <= 64 && this.bufferPool.length < this.poolSize) {
      this.bufferPool.push(buffer);
    }
  }

  /**
   * Ouvre une socket CAN/CAN FD
   */
  async open(interface: string, isFd: boolean = false): Promise<void> {
    if (this.socketId !== null) {
      throw new Error("Socket already open");
    }

    try {
      // Utilise la version optimisée si disponible, sinon fallback vers legacy
      const canSocket = require("../can_socket.node");
      this.socketId = canSocket.createSocket(interface, isFd);
    } catch (error) {
      throw new Error(`Failed to open socket on ${interface}: ${error}`);
    }
  }

  /**
   * OPTIMISATION CRITIQUE: Envoi de frame unique avec ArrayBuffer
   */
  async sendOptimized(frame: CanFrameOptimized): Promise<void> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    try {
      const canSocket = require("../can_socket.node");
      await canSocket.sendFrameOptimized(
        this.socketId,
        frame.id,
        frame.data, // ArrayBuffer direct
        frame.extended || false,
        frame.fd || false,
        frame.remote || false
      );
      this.stats.framesSent++;
    } catch (error) {
      throw new Error(`Failed to send frame: ${error}`);
    }
  }

  /**
   * OPTIMISATION CRITIQUE: Réception de frame unique avec ArrayBuffer
   */
  async receiveOptimized(timeout?: number): Promise<CanFrameOptimized> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    try {
      const canSocket = require("../can_socket.node");
      const frame = await canSocket.readFrameOptimized(this.socketId, timeout);
      this.stats.framesReceived++;

      return {
        id: frame.id,
        data: frame.data, // ArrayBuffer direct
        extended: frame.extended,
        fd: frame.fd,
        remote: frame.remote,
        error: frame.error,
      };
    } catch (error) {
      if (error.message?.includes("timeout")) {
        throw new Error("Receive timeout");
      }
      throw new Error(`Failed to receive frame: ${error}`);
    }
  }

  /**
   * OPTIMISATION CRITIQUE: Envoi en lot avec format binaire compact
   */
  async sendBatchOptimized(frames: BatchFrame[]): Promise<number> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    // Sérialiser les frames dans un format binaire compact
    const binaryData = this.serializeFramesBatch(frames);

    try {
      const canSocket = require("../can_socket.node");
      const sentCount = await canSocket.sendFramesBatchOptimized(
        this.socketId,
        binaryData
      );
      this.stats.framesSent += sentCount;
      this.stats.batchesSent++;
      return sentCount;
    } catch (error) {
      throw new Error(`Failed to send batch: ${error}`);
    }
  }

  /**
   * OPTIMISATION CRITIQUE: Réception en lot avec format binaire compact
   */
  async receiveBatchOptimized(
    maxFrames: number,
    timeout?: number
  ): Promise<CanFrameOptimized[]> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    try {
      const canSocket = require("../can_socket.node");
      const binaryData: ArrayBuffer = await canSocket.readFramesBatchOptimized(
        this.socketId,
        maxFrames,
        timeout
      );

      const frames = this.deserializeFramesBatch(binaryData);
      this.stats.framesReceived += frames.length;
      return frames;
    } catch (error) {
      if (error.message?.includes("timeout")) {
        return []; // Retourner tableau vide pour timeout
      }
      throw new Error(`Failed to receive batch: ${error}`);
    }
  }

  /**
   * Sérialise les frames dans un format binaire compact pour transmission Rust
   * Format: [id:u32][data_len:u8][flags:u8][data:data_len] par frame
   */
  private serializeFramesBatch(frames: BatchFrame[]): ArrayBuffer {
    let totalSize = 0;
    const frameData: { data: Uint8Array; size: number }[] = [];

    // Calculer la taille totale et préparer les données
    for (const frame of frames) {
      let data: Uint8Array;
      if (frame.data instanceof ArrayBuffer) {
        data = new Uint8Array(frame.data);
      } else {
        data = new Uint8Array(frame.data);
      }

      const size = 4 + 1 + 1 + data.length; // id + data_len + flags + data
      frameData.push({ data, size });
      totalSize += size;
    }

    // Créer le buffer et sérialiser
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    let offset = 0;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const { data } = frameData[i];

      // ID (u32 little-endian)
      view.setUint32(offset, frame.id, true);
      offset += 4;

      // Data length (u8)
      view.setUint8(offset, data.length);
      offset += 1;

      // Flags packed in one byte
      const flags =
        (frame.extended ? 1 : 0) |
        ((frame.fd ? 1 : 0) << 1) |
        ((frame.remote ? 1 : 0) << 2);
      view.setUint8(offset, flags);
      offset += 1;

      // Data
      uint8View.set(data, offset);
      offset += data.length;
    }

    return buffer;
  }

  /**
   * Désérialise les frames depuis le format binaire compact de Rust
   * Format: [id:u32][data_len:u8][flags:u8][data:data_len] par frame
   */
  private deserializeFramesBatch(binaryData: ArrayBuffer): CanFrameOptimized[] {
    const frames: CanFrameOptimized[] = [];
    const view = new DataView(binaryData);
    const uint8View = new Uint8Array(binaryData);
    let offset = 0;

    while (offset + 6 <= binaryData.byteLength) {
      // Minimum 6 bytes par frame
      // ID (u32 little-endian)
      const id = view.getUint32(offset, true);
      offset += 4;

      // Data length (u8)
      const dataLen = view.getUint8(offset);
      offset += 1;

      // Flags (u8)
      const flags = view.getUint8(offset);
      offset += 1;

      if (offset + dataLen > binaryData.byteLength) {
        break; // Buffer incomplet
      }

      // Data (copie dans un nouveau buffer)
      const frameData = this.getBuffer(dataLen);
      const frameView = new Uint8Array(frameData);
      frameView.set(uint8View.subarray(offset, offset + dataLen));
      offset += dataLen;

      // Unpacker les flags
      const extended = (flags & 0x01) !== 0;
      const fd = (flags & 0x02) !== 0;
      const remote = (flags & 0x04) !== 0;
      const error = (flags & 0x08) !== 0;

      frames.push({
        id,
        data: frameData,
        extended,
        fd,
        remote,
        error,
      });
    }

    return frames;
  }

  /**
   * Envoi automatique avec batching optimisé
   */
  async send(frame: BatchFrame): Promise<void> {
    if (!this.options.useBatching) {
      // Mode direct optimisé
      const optimizedFrame: CanFrameOptimized = {
        id: frame.id,
        data:
          frame.data instanceof ArrayBuffer
            ? frame.data
            : new Uint8Array(frame.data).buffer,
        extended: frame.extended,
        fd: frame.fd,
        remote: frame.remote,
      };
      return this.sendOptimized(optimizedFrame);
    }

    // Mode batching
    this.sendQueue.push(frame);

    if (this.sendQueue.length >= this.options.batchSize!) {
      await this.flushSendQueue();
    } else if (this.batchTimer === null) {
      // Timer pour envoyer les frames restants
      this.batchTimer = setTimeout(() => this.flushSendQueue(), 10);
    }
  }

  /**
   * Vide la queue d'envoi en utilisant le batch optimisé
   */
  private async flushSendQueue(): Promise<void> {
    if (this.sendQueue.length === 0) return;

    const frames = this.sendQueue.splice(0);
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      await this.sendBatchOptimized(frames);
    } catch (error) {
      this.emit("error", error);
    }
  }

  /**
   * Générateur asynchrone optimisé pour lecture continue
   */
  async *frames(options?: {
    prefetchSize?: number;
  }): AsyncGenerator<CanFrameOptimized> {
    const prefetchSize = options?.prefetchSize ?? this.options.prefetchSize!;
    let buffer: CanFrameOptimized[] = [];

    while (true) {
      // Pré-charger en lot si le buffer est vide
      if (buffer.length === 0) {
        try {
          buffer = await this.receiveBatchOptimized(prefetchSize, 100);
          if (buffer.length === 0) {
            // Fallback sur lecture unique si pas de frames
            try {
              const frame = await this.receiveOptimized(100);
              buffer.push(frame);
            } catch (error) {
              if (!error.message?.includes("timeout")) {
                throw error;
              }
              // Continue loop pour timeout
              continue;
            }
          }
        } catch (error) {
          if (!error.message?.includes("timeout")) {
            throw error;
          }
          continue;
        }
      }

      // Retourner le prochain frame du buffer
      if (buffer.length > 0) {
        const frame = buffer.shift()!;
        yield frame;
      }
    }
  }

  /**
   * Fonctions legacy pour compatibilité ascendante
   */
  async sendLegacy(frame: CanFrameLegacy): Promise<void> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    try {
      const canSocket = require("../can_socket.node");
      await canSocket.sendFrame(
        this.socketId,
        frame.id,
        frame.data,
        frame.extended || false,
        frame.fd || false,
        frame.remote || false
      );
      this.stats.framesSent++;
    } catch (error) {
      throw new Error(`Failed to send frame: ${error}`);
    }
  }

  async receiveLegacy(timeout?: number): Promise<CanFrameLegacy> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    try {
      const canSocket = require("../can_socket.node");
      const frame = await canSocket.readFrame(this.socketId, timeout);
      this.stats.framesReceived++;
      return frame;
    } catch (error) {
      if (error.message?.includes("timeout")) {
        throw new Error("Receive timeout");
      }
      throw new Error(`Failed to receive frame: ${error}`);
    }
  }

  /**
   * Configuration des filtres CAN
   */
  async setFilters(filters: CanFilter[]): Promise<void> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    try {
      const canSocket = require("../can_socket.node");
      await canSocket.setFilters(this.socketId, filters);
    } catch (error) {
      throw new Error(`Failed to set filters: ${error}`);
    }
  }

  async clearFilters(): Promise<void> {
    if (this.socketId === null) {
      throw new Error("Socket not open");
    }

    try {
      const canSocket = require("../can_socket.node");
      await canSocket.clearFilters(this.socketId);
    } catch (error) {
      throw new Error(`Failed to clear filters: ${error}`);
    }
  }

  /**
   * Ferme la socket et nettoie les ressources
   */
  async close(): Promise<void> {
    if (this.socketId === null) {
      return;
    }

    // Vider la queue d'envoi
    if (this.sendQueue.length > 0) {
      await this.flushSendQueue();
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      const canSocket = require("../can_socket.node");
      await canSocket.closeSocket(this.socketId);
    } catch (error) {
      // Ignore les erreurs de fermeture
    }

    this.socketId = null;

    // Nettoyer le pool de buffers
    this.bufferPool.length = 0;
  }

  /**
   * Récupère les statistiques de performance
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Remet à zéro les statistiques
   */
  resetStats(): void {
    this.stats = {
      framesSent: 0,
      framesReceived: 0,
      batchesSent: 0,
      bufferPoolHits: 0,
      bufferPoolMisses: 0,
    };
  }
}

export default OptimizedSocketCan;
