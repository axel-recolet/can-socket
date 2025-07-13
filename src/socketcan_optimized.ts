/**
 * Optimized SocketCAN TypeScript wrapper with performance enhancements
 */

import {
  NativeSocketCAN,
  CanFrame,
  CanFdFrame,
  AnyCanFrame,
  CanSocketOptions,
  SocketCANError,
  CanId,
  CanData,
  SocketId,
} from "../types/socketcan";
import { EventEmitter } from "events";

// Load the native module
const socketcan: NativeSocketCAN = require("../../can_socket.node");

/**
 * Performance optimization: Object pool for frame reuse
 */
class FramePool {
  private pool: AnyCanFrame[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    // Pre-allocate some frames
    for (let i = 0; i < Math.min(100, maxSize); i++) {
      this.pool.push({
        id: 0,
        data: new Array(64).fill(0),
        extended: false,
        fd: false,
        remote: false,
        error: false,
      });
    }
  }

  getFrame(): AnyCanFrame {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return {
      id: 0,
      data: new Array(64).fill(0),
      extended: false,
      fd: false,
      remote: false,
      error: false,
    };
  }

  returnFrame(frame: AnyCanFrame): void {
    if (this.pool.length < this.maxSize) {
      // Reset frame data
      frame.id = 0;
      frame.data.length = 0;
      frame.data.push(...new Array(64).fill(0));
      frame.extended = false;
      frame.fd = false;
      frame.remote = false;
      frame.error = false;
      this.pool.push(frame);
    }
  }
}

/**
 * Optimized SocketCAN class with performance enhancements
 */
export class OptimizedSocketCAN extends EventEmitter {
  private interfaceName: string;
  private socket: SocketId | null = null;
  private defaultTimeout?: number;
  private canFd: boolean;
  private _isListening: boolean = false;
  private _listenerAbortController?: AbortController;

  // Performance optimizations
  private framePool: FramePool;
  private sendBuffer: Array<{
    id: number;
    data: number[];
    extended: boolean;
    fd: boolean;
    remote: boolean;
  }> = [];
  private batchSize: number = 50;
  private sendTimer: NodeJS.Timeout | null = null;
  private readBuffer: AnyCanFrame[] = [];
  private maxReadBuffer: number = 100;

  constructor(
    interfaceName: string,
    options?: Partial<
      CanSocketOptions & {
        batchSize?: number;
        maxReadBuffer?: number;
        framePoolSize?: number;
      }
    >
  ) {
    super();
    this.interfaceName = interfaceName;
    this.defaultTimeout = options?.defaultTimeout;
    this.canFd = options?.canFd ?? false;
    this.batchSize = options?.batchSize ?? 50;
    this.maxReadBuffer = options?.maxReadBuffer ?? 100;
    this.framePool = new FramePool(options?.framePoolSize ?? 1000);
    this._isListening = false;
  }

  /**
   * Open the CAN socket with optimizations
   */
  public async open(): Promise<void> {
    try {
      this.socket = socketcan.createSocket(this.interfaceName, this.canFd);
      const socketType = this.canFd ? "CAN FD" : "CAN";
      console.log(
        `Optimized ${socketType} socket opened on interface: ${this.interfaceName}`
      );
    } catch (error) {
      throw new SocketCANError(
        `Unable to open CAN socket: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "SOCKET_OPEN_ERROR"
      );
    }
  }

  /**
   * Optimized send with automatic batching
   */
  public async send(
    id: CanId | number,
    data: CanData,
    options?: {
      extended?: boolean;
      fd?: boolean;
      remote?: boolean;
      immediate?: boolean;
    }
  ): Promise<void> {
    this.validateSocket();

    const { numericId, extended } = this.parseCanId(id, options?.extended);

    // Convert data to array efficiently
    let dataArray: number[];
    if (data instanceof Uint8Array) {
      dataArray = Array.from(data);
    } else if (Array.isArray(data)) {
      dataArray = data;
    } else {
      dataArray = [];
    }

    const frameData = {
      id: numericId,
      data: dataArray,
      extended: extended,
      fd: options?.fd ?? false,
      remote: options?.remote ?? false,
    };

    if (options?.immediate) {
      // Send immediately for time-critical frames
      await this.sendImmediate(frameData);
    } else {
      // Add to batch
      this.sendBuffer.push(frameData);

      if (this.sendBuffer.length >= this.batchSize) {
        await this.flushSendBuffer();
      } else if (!this.sendTimer) {
        // Auto-flush after short delay
        this.sendTimer = setTimeout(() => this.flushSendBuffer(), 1);
      }
    }
  }

  /**
   * Flush pending send operations
   */
  public async flushSendBuffer(): Promise<void> {
    if (this.sendBuffer.length === 0) return;

    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
      this.sendTimer = null;
    }

    const frames = this.sendBuffer.splice(0); // Clear buffer

    try {
      // Use batch send if available in native module
      if ((socketcan as any).sendFramesBatch) {
        (socketcan as any).sendFramesBatch(this.socket!, frames);
      } else {
        // Fallback to individual sends
        for (const frame of frames) {
          socketcan.sendFrame(
            this.socket!,
            frame.id,
            frame.data,
            frame.extended,
            frame.fd,
            frame.remote
          );
        }
      }
    } catch (error) {
      throw new SocketCANError(
        `Failed to send frames: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "SEND_ERROR"
      );
    }
  }

  private async sendImmediate(frameData: any): Promise<void> {
    try {
      socketcan.sendFrame(
        this.socket!,
        frameData.id,
        frameData.data,
        frameData.extended,
        frameData.fd,
        frameData.remote
      );
    } catch (error) {
      throw new SocketCANError(
        `Failed to send frame: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "SEND_ERROR"
      );
    }
  }

  /**
   * Optimized receive with pre-allocated buffers
   */
  public async receive(timeout?: number): Promise<AnyCanFrame> {
    this.validateSocket();

    // Check buffered frames first
    if (this.readBuffer.length > 0) {
      return this.readBuffer.shift()!;
    }

    try {
      const actualTimeout = timeout ?? this.defaultTimeout;

      // Try batch read if available
      if ((socketcan as any).readFramesBatch) {
        const frames = (socketcan as any).readFramesBatch(
          this.socket!,
          this.batchSize,
          actualTimeout
        );
        if (frames.length > 0) {
          // Convert to pooled frames
          for (let i = 1; i < frames.length; i++) {
            const pooledFrame = this.framePool.getFrame();
            this.populateFrame(pooledFrame, frames[i]);
            this.readBuffer.push(pooledFrame);
          }

          // Return first frame immediately
          const firstFrame = this.framePool.getFrame();
          this.populateFrame(firstFrame, frames[0]);
          return firstFrame;
        }
      }

      // Fallback to single frame read
      const rawFrame = socketcan.readFrame(this.socket!, actualTimeout);
      const frame = this.framePool.getFrame();
      this.populateFrame(frame, rawFrame);
      return frame;
    } catch (error) {
      throw new SocketCANError(
        `Failed to receive frame: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "RECEIVE_ERROR"
      );
    }
  }

  private populateFrame(frame: AnyCanFrame, rawFrame: any): void {
    frame.id = rawFrame.id;
    frame.extended = rawFrame.extended;
    frame.fd = rawFrame.fd;
    frame.remote = rawFrame.remote;
    frame.error = rawFrame.error;

    // Efficient data copy
    const dataLength = Math.min(rawFrame.data.length, frame.data.length);
    for (let i = 0; i < dataLength; i++) {
      frame.data[i] = rawFrame.data[i];
    }
  }

  /**
   * Release a frame back to the pool
   */
  public releaseFrame(frame: AnyCanFrame): void {
    this.framePool.returnFrame(frame);
  }

  /**
   * Optimized async generator with pre-fetching
   */
  public async *frames(options?: {
    timeout?: number;
    prefetch?: number;
    filter?: (frame: AnyCanFrame) => boolean;
  }): AsyncGenerator<AnyCanFrame, void, unknown> {
    const prefetchSize = options?.prefetch ?? 10;
    const filter = options?.filter;

    while (true) {
      try {
        // Pre-fetch frames in batch if possible
        if (
          this.readBuffer.length < prefetchSize &&
          (socketcan as any).readFramesBatch
        ) {
          try {
            const frames = (socketcan as any).readFramesBatch(
              this.socket!,
              prefetchSize - this.readBuffer.length,
              1 // Short timeout for non-blocking
            );

            for (const rawFrame of frames) {
              const frame = this.framePool.getFrame();
              this.populateFrame(frame, rawFrame);

              if (!filter || filter(frame)) {
                this.readBuffer.push(frame);
              } else {
                this.releaseFrame(frame);
              }
            }
          } catch (e) {
            // Ignore batch read errors, fall back to single reads
          }
        }

        // Get next frame
        const frame = await this.receive(options?.timeout);

        if (!filter || filter(frame)) {
          yield frame;
        } else {
          this.releaseFrame(frame);
        }
      } catch (error) {
        if (
          error instanceof SocketCANError &&
          error.code === "RECEIVE_TIMEOUT"
        ) {
          continue; // Continue on timeout
        }
        throw error;
      }
    }
  }

  /**
   * High-performance burst send
   */
  public async sendBurst(
    frames: Array<{
      id: CanId | number;
      data: CanData;
      options?: { extended?: boolean; fd?: boolean; remote?: boolean };
    }>
  ): Promise<void> {
    this.validateSocket();

    const processedFrames = frames.map((frame) => {
      const { numericId, extended } = this.parseCanId(
        frame.id,
        frame.options?.extended
      );

      let dataArray: number[];
      if (frame.data instanceof Uint8Array) {
        dataArray = Array.from(frame.data);
      } else if (Array.isArray(frame.data)) {
        dataArray = frame.data;
      } else {
        dataArray = [];
      }

      return {
        id: numericId,
        data: dataArray,
        extended: extended,
        fd: frame.options?.fd ?? false,
        remote: frame.options?.remote ?? false,
      };
    });

    try {
      if ((socketcan as any).sendFramesBatch) {
        (socketcan as any).sendFramesBatch(this.socket!, processedFrames);
      } else {
        for (const frame of processedFrames) {
          socketcan.sendFrame(
            this.socket!,
            frame.id,
            frame.data,
            frame.extended,
            frame.fd,
            frame.remote
          );
        }
      }
    } catch (error) {
      throw new SocketCANError(
        `Failed to send frame burst: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "SEND_ERROR"
      );
    }
  }

  private validateSocket(): void {
    if (this.socket === null) {
      throw new SocketCANError("Socket not open", "SOCKET_NOT_OPEN");
    }
  }

  private parseCanId(
    id: CanId | number,
    forceExtended?: boolean
  ): { numericId: number; extended: boolean } {
    if (typeof id === "number") {
      const extended = forceExtended ?? id > 0x7ff;
      return { numericId: id, extended };
    }

    if (id.type === "standard") {
      return {
        numericId: id.id,
        extended: false,
      };
    } else {
      return {
        numericId: id.id,
        extended: true,
      };
    }
  }

  /**
   * Close socket and cleanup resources
   */
  public async close(): Promise<void> {
    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
      this.sendTimer = null;
    }

    // Flush any pending sends
    await this.flushSendBuffer();

    if (this.socket !== null) {
      socketcan.closeSocket(this.socket);
      this.socket = null;
    }

    // Clear buffers
    this.readBuffer.forEach((frame) => this.releaseFrame(frame));
    this.readBuffer.length = 0;

    this.emit("close");
  }
}

export { OptimizedSocketCAN as SocketCAN };
