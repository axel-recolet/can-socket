/**
 * can-socket - Modern CAN bus socket interface for Node.js
 *
 * High-performance Node.js module providing a clean, type-safe interface
 * to Linux SocketCAN, built with Rust and Neon for optimal performance.
 *
 * Supports both event-driven and async generator APIs for maximum flexibility.
 */

import {
  NativeSocketCAN,
  CanFrame,
  CanFdFrame,
  CanRemoteFrame,
  CanErrorFrame,
  AnyCanFrame,
  CanSocketOptions,
  SocketCANError,
  SocketCANErrorCode,
  CAN_CONSTANTS,
  CanId,
  CanData,
  SocketId,
  StandardCanId,
  ExtendedCanId,
  CanFilter,
} from "../types/socketcan";
import { EventEmitter } from "events";

// Load the native module
const socketcan: NativeSocketCAN = require("../../can_socket.node");

/**
 * Event interface for SocketCAN events
 */
export interface SocketCANEvents {
  frame: (frame: AnyCanFrame) => void;
  error: (error: SocketCANError) => void;
  close: () => void;
  listening: () => void;
  stopped: () => void;
}

/**
 * TypeScript wrapper class for easy use of the SocketCAN module
 * Extends EventEmitter for event-based frame receiving
 */
export class SocketCAN extends EventEmitter {
  private interfaceName: string;
  private socket: SocketId | null = null;
  private defaultTimeout?: number;
  private canFd: boolean;
  private _isListening: boolean = false;
  private _listenerAbortController?: AbortController;

  constructor(interfaceName: string, options?: Partial<CanSocketOptions>) {
    super();
    this.interfaceName = interfaceName;
    this.defaultTimeout = options?.defaultTimeout;
    this.canFd = options?.canFd ?? false;
    this._isListening = false;
  }

  /**
   * Open the CAN socket
   * @throws {SocketCANError} If opening fails
   */
  public async open(): Promise<void> {
    try {
      this.socket = socketcan.createSocket(this.interfaceName, this.canFd);
      const socketType = this.canFd ? "CAN FD" : "CAN";
      console.log(
        `${socketType} socket opened on interface: ${this.interfaceName}`
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
   * Send a CAN frame
   * @param id CAN frame ID (number or CanId object)
   * @param data Data to send (max 8 bytes for CAN, 64 for CAN FD)
   * @param options Optional frame options
   * @throws {SocketCANError} If sending fails or parameters are invalid
   */
  public async send(
    id: CanId | number,
    data: CanData,
    options?: { extended?: boolean; fd?: boolean; remote?: boolean }
  ): Promise<void> {
    this.validateSocket();

    // Parse ID and determine if extended
    const { numericId, extended } = this.parseCanId(id, options?.extended);
    const isFd = options?.fd ?? false;
    const isRemote = options?.remote ?? false;

    if (isRemote && isFd) {
      throw new SocketCANError(
        "Remote frames are not supported with CAN FD",
        "INVALID_PARAMETERS"
      );
    }

    this.validateCanFrame(numericId, data, extended, isFd);

    try {
      socketcan.sendFrame(
        this.socket!,
        numericId,
        data,
        extended,
        isFd,
        isRemote
      );
      const idStr = extended
        ? `0x${numericId.toString(16)} (ext)`
        : `0x${numericId.toString(16)}`;
      const frameType = isFd ? "FD" : isRemote ? "Remote" : "";
      console.log(
        `CAN ${frameType} frame sent - ID: ${idStr}, Data: [${data.join(", ")}]`
      );
    } catch (error) {
      throw new SocketCANError(
        `Error during send: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "SEND_ERROR"
      );
    }
  }

  /**
   * Receive a CAN frame
   * @param timeout Timeout in milliseconds (optional)
   * @returns Received CAN frame (can be regular, FD, remote, or error frame)
   * @throws {SocketCANError} If receiving fails
   */
  public async receive(timeout?: number): Promise<AnyCanFrame> {
    this.validateSocket();

    const actualTimeout = timeout ?? this.defaultTimeout;

    try {
      const frame = socketcan.readFrame(this.socket!, actualTimeout);

      // Enhanced logging with frame type detection
      let frameType = "";
      if (frame.error) {
        frameType = "Error";
      } else if (frame.remote) {
        frameType = "Remote";
      } else if (frame.fd) {
        frameType = "FD";
      } else {
        frameType = "Standard";
      }

      console.log(
        `CAN ${frameType} frame received - ID: 0x${frame.id.toString(
          16
        )}, Data: [${frame.data.join(", ")}]`
      );
      return frame;
    } catch (error) {
      throw new SocketCANError(
        `Error during receive: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "RECEIVE_ERROR"
      );
    }
  }

  /**
   * Close the CAN socket
   */
  public async close(): Promise<void> {
    if (this.socket !== null) {
      try {
        socketcan.closeSocket(this.socket);
        this.socket = null;
        console.log("CAN socket closed");
      } catch (error) {
        throw new SocketCANError(
          `Error closing socket: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "SOCKET_CLOSE_ERROR"
        );
      }
    }
  }

  /**
   * Check if the socket is open
   */
  public isOpen(): boolean {
    return this.socket !== null;
  }

  /**
   * Get the interface name
   */
  public getInterface(): string {
    return this.interfaceName;
  }

  /**
   * Set CAN filters for selective frame reception
   * @param filters Array of CAN filters
   * @throws {SocketCANError} If setting filters fails
   */
  public async setFilters(filters: CanFilter[]): Promise<void> {
    this.validateSocket();

    // Validate filters
    for (const filter of filters) {
      this.validateFilter(filter);
    }

    try {
      socketcan.setFilters(this.socket!, filters);
      console.log(`Set ${filters.length} CAN filters`);
    } catch (error) {
      throw new SocketCANError(
        `Error setting filters: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "FILTER_ERROR"
      );
    }
  }

  /**
   * Clear all CAN filters (receive all frames)
   * @throws {SocketCANError} If clearing filters fails
   */
  public async clearFilters(): Promise<void> {
    this.validateSocket();

    try {
      socketcan.clearFilters(this.socket!);
      console.log("Cleared all CAN filters");
    } catch (error) {
      throw new SocketCANError(
        `Error clearing filters: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "FILTER_ERROR"
      );
    }
  }

  /**
   * Send a remote CAN frame (request for data)
   * @param id CAN frame ID (number or CanId object)
   * @param dlc Data Length Code (number of bytes requested)
   * @param options Optional frame options
   * @throws {SocketCANError} If sending fails or parameters are invalid
   */
  public async sendRemote(
    id: CanId | number,
    dlc: number = 0,
    options?: { extended?: boolean }
  ): Promise<void> {
    if (dlc < 0 || dlc > 8) {
      throw new SocketCANError(
        "DLC must be between 0 and 8 for remote frames",
        "INVALID_PARAMETERS"
      );
    }

    // Create empty data array with specified DLC length
    const data = new Array(dlc).fill(0);

    return this.send(id, data, {
      extended: options?.extended,
      fd: false, // Remote frames are not CAN FD
      remote: true,
    });
  }

  /**
   * Check if a received frame is a remote frame
   * @param frame The received frame
   * @returns True if it's a remote frame
   */
  public static isRemoteFrame(frame: AnyCanFrame): frame is CanRemoteFrame {
    return "remote" in frame && frame.remote === true;
  }

  /**
   * Check if a received frame is an error frame
   * @param frame The received frame
   * @returns True if it's an error frame
   */
  public static isErrorFrame(frame: AnyCanFrame): frame is CanErrorFrame {
    return "error" in frame && frame.error === true;
  }

  /**
   * Check if a received frame is a CAN FD frame
   * @param frame The received frame
   * @returns True if it's a CAN FD frame
   */
  public static isCanFdFrame(frame: AnyCanFrame): frame is CanFdFrame {
    return "fd" in frame && frame.fd === true;
  }

  /**
   * Validate that the socket is open
   * @private
   */
  private validateSocket(): void {
    if (this.socket === null) {
      throw new SocketCANError("CAN socket not open", "SOCKET_NOT_OPEN");
    }
  }

  /**
   * Validate a CAN frame
   * @private
   */
  private validateCanFrame(
    id: number,
    data: CanData,
    extended: boolean = false,
    isFd: boolean = false
  ): void {
    // ID validation
    const maxId = extended
      ? CAN_CONSTANTS.MAX_EXTENDED_ID
      : CAN_CONSTANTS.MAX_STANDARD_ID;
    if (id < 0 || id > maxId) {
      const idType = extended ? "extended" : "standard";
      throw new SocketCANError(
        `Invalid ${idType} CAN ID: ${id}. Must be between 0 and 0x${maxId.toString(
          16
        )}`,
        "INVALID_CAN_ID"
      );
    }

    // Data validation
    const maxDataLength = isFd
      ? CAN_CONSTANTS.MAX_FD_DATA_LENGTH
      : CAN_CONSTANTS.MAX_DATA_LENGTH;
    if (data.length > maxDataLength) {
      const frameType = isFd ? "CAN FD" : "CAN";
      throw new SocketCANError(
        `${frameType} data cannot exceed ${maxDataLength} bytes`,
        isFd ? "DATA_TOO_LONG_FD" : "DATA_TOO_LONG"
      );
    }

    // Validate each byte
    for (const byte of data) {
      if (byte < 0 || byte > 255 || !Number.isInteger(byte)) {
        throw new SocketCANError(
          `Invalid byte: ${byte}. Each byte must be an integer between 0 and 255`,
          "INVALID_BYTE"
        );
      }
    }
  }

  /**
   * Validate a CAN filter
   * @private
   */
  private validateFilter(filter: CanFilter): void {
    // ID validation
    const extended = filter.extended ?? false;
    const maxId = extended
      ? CAN_CONSTANTS.MAX_EXTENDED_ID
      : CAN_CONSTANTS.MAX_STANDARD_ID;

    if (filter.id < 0 || filter.id > maxId) {
      const idType = extended ? "extended" : "standard";
      throw new SocketCANError(
        `Invalid ${idType} CAN filter ID: ${
          filter.id
        }. Must be between 0 and 0x${maxId.toString(16)}`,
        "INVALID_FILTER"
      );
    }

    // Mask validation
    if (filter.mask < 0 || filter.mask > maxId) {
      const idType = extended ? "extended" : "standard";
      throw new SocketCANError(
        `Invalid ${idType} CAN filter mask: ${
          filter.mask
        }. Must be between 0 and 0x${maxId.toString(16)}`,
        "INVALID_FILTER"
      );
    }
  }

  /**
   * Parse CAN ID and determine if extended
   * @private
   */
  private parseCanId(
    id: CanId | number,
    forceExtended?: boolean
  ): { numericId: number; extended: boolean } {
    if (typeof id === "number") {
      return {
        numericId: id,
        extended: forceExtended ?? id > CAN_CONSTANTS.MAX_STANDARD_ID,
      };
    } else if (typeof id === "object") {
      if (id.type === "standard") {
        return { numericId: id.id, extended: false };
      } else if (id.type === "extended") {
        return { numericId: id.id, extended: true };
      }
    }

    throw new SocketCANError("Invalid CAN ID format", "INVALID_CAN_ID");
  }

  // ===== EVENT-BASED API =====

  /**
   * Start listening for CAN frames and emit events
   * @param options Listening options
   */
  async startListening(options: { interval?: number } = {}): Promise<void> {
    if (this._isListening) {
      throw new SocketCANError(
        "Already listening for frames",
        "ALREADY_LISTENING"
      );
    }

    this.validateSocket();

    this._isListening = true;
    this._listenerAbortController = new AbortController();
    const interval = options.interval || 10; // 10ms default

    this.emit("listening");

    try {
      while (
        this._isListening &&
        !this._listenerAbortController.signal.aborted
      ) {
        try {
          const frame = await this.receive(interval);
          if (frame) {
            this.emit("frame", frame);
          }
        } catch (error) {
          if (
            error instanceof SocketCANError &&
            error.code === "RECEIVE_TIMEOUT"
          ) {
            // Timeout is expected, continue listening
            continue;
          }
          this.emit(
            "error",
            error instanceof SocketCANError
              ? error
              : new SocketCANError(
                  `Listening error: ${error}`,
                  "LISTENING_ERROR"
                )
          );
          break;
        }

        // Small delay to prevent CPU spinning
        if (!this._listenerAbortController.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }
    } finally {
      this._isListening = false;
      this.emit("stopped");
    }
  }

  /**
   * Stop listening for CAN frames
   */
  stopListening(): void {
    if (this._isListening) {
      this._isListening = false;
      this._listenerAbortController?.abort();
    }
  }

  /**
   * Check if currently listening for frames
   */
  get isListening(): boolean {
    return this._isListening;
  }

  // ===== ASYNC GENERATOR API =====

  /**
   * Async generator that yields CAN frames
   * @param options Generator options
   */
  async *frames(
    options: {
      timeout?: number;
      maxFrames?: number;
      filter?: (frame: AnyCanFrame) => boolean;
    } = {}
  ): AsyncGenerator<AnyCanFrame, void, unknown> {
    this.validateSocket();

    const timeout = options.timeout || 1000;
    const maxFrames = options.maxFrames || Infinity;
    const filter = options.filter;
    let frameCount = 0;

    while (frameCount < maxFrames) {
      try {
        const frame = await this.receive(timeout);
        if (frame) {
          // Apply filter if provided
          if (!filter || filter(frame)) {
            yield frame;
            frameCount++;
          }
        }
      } catch (error) {
        if (
          error instanceof SocketCANError &&
          error.code === "RECEIVE_TIMEOUT"
        ) {
          // Continue on timeout
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Async generator that yields frames with specific CAN ID
   * @param canId Target CAN ID
   * @param options Generator options
   */
  async *framesWithId(
    canId: number | CanId,
    options: { timeout?: number; maxFrames?: number } = {}
  ): AsyncGenerator<AnyCanFrame, void, unknown> {
    const { numericId } = this.parseCanId(canId);

    const filter = (frame: AnyCanFrame) => frame.id === numericId;

    for await (const frame of this.frames({ ...options, filter })) {
      yield frame;
    }
  }

  /**
   * Async generator that yields frames of specific type
   * @param frameType Type of frames to yield
   * @param options Generator options
   */
  async *framesOfType<T extends AnyCanFrame>(
    frameType: "data" | "remote" | "error" | "fd",
    options: { timeout?: number; maxFrames?: number } = {}
  ): AsyncGenerator<T, void, unknown> {
    const filter = (frame: AnyCanFrame): frame is T => {
      switch (frameType) {
        case "data":
          return !frame.remote && !frame.error && !frame.fd;
        case "remote":
          return !!frame.remote;
        case "error":
          return !!frame.error;
        case "fd":
          return !!frame.fd;
        default:
          return false;
      }
    };

    for await (const frame of this.frames({ ...options, filter })) {
      if (filter(frame)) {
        yield frame;
      }
    }
  }

  /**
   * Collect frames into an array
   * @param options Collection options
   */
  async collectFrames(options: {
    maxFrames: number;
    timeout?: number;
    filter?: (frame: AnyCanFrame) => boolean;
  }): Promise<AnyCanFrame[]> {
    const frames: AnyCanFrame[] = [];

    for await (const frame of this.frames(options)) {
      frames.push(frame);
    }

    return frames;
  }

  // ===== EVENT EMITTER TYPING =====

  /**
   * Enhanced event emitter typing
   */
  on<K extends keyof SocketCANEvents>(
    event: K,
    listener: SocketCANEvents[K]
  ): this {
    return super.on(event, listener);
  }

  emit<K extends keyof SocketCANEvents>(
    event: K,
    ...args: Parameters<SocketCANEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  once<K extends keyof SocketCANEvents>(
    event: K,
    listener: SocketCANEvents[K]
  ): this {
    return super.once(event, listener);
  }

  off<K extends keyof SocketCANEvents>(
    event: K,
    listener: SocketCANEvents[K]
  ): this {
    return super.off(event, listener);
  }
}

/**
 * SocketCAN utility functions for ID and data conversion
 */
export class SocketCANUtils {
  /**
   * Convert a number to byte array (little-endian)
   */
  static numberToBytes(value: number, length: number = 4): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < length; i++) {
      bytes.push((value >> (i * 8)) & 0xff);
    }
    return bytes;
  }

  /**
   * Convert byte array to number (little-endian)
   */
  static bytesToNumber(bytes: number[]): number {
    let value = 0;
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        value |= (byte & 0xff) << (i * 8);
      }
    }
    return value;
  }

  /**
   * Format CAN ID as hexadecimal string
   */
  static formatCanId(id: number, extended?: boolean): string {
    // Auto-detect if not specified
    if (extended === undefined) {
      extended = id > CAN_CONSTANTS.MAX_STANDARD_ID;
    }

    const hexId = id
      .toString(16)
      .toUpperCase()
      .padStart(extended ? 8 : 3, "0");
    return extended ? `0x${hexId} (ext)` : `0x${hexId}`;
  }

  /**
   * Format CAN data as hexadecimal string
   */
  static formatCanData(data: number[]): string {
    return data
      .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
      .join(" ");
  }

  /**
   * Create a standard CAN ID
   * @param id ID value (0..=0x7FF)
   * @returns StandardCanId object
   */
  static createStandardId(id: number): StandardCanId {
    if (id < 0 || id > CAN_CONSTANTS.MAX_STANDARD_ID) {
      throw new SocketCANError(
        `Invalid standard CAN ID: ${id}. Must be between 0 and 0x${CAN_CONSTANTS.MAX_STANDARD_ID.toString(
          16
        )}`,
        "INVALID_CAN_ID"
      );
    }
    return { type: "standard", id };
  }

  /**
   * Create an extended CAN ID
   * @param id ID value (0..=0x1FFFFFFF)
   * @returns ExtendedCanId object
   */
  static createExtendedId(id: number): ExtendedCanId {
    if (id < 0 || id > CAN_CONSTANTS.MAX_EXTENDED_ID) {
      throw new SocketCANError(
        `Invalid extended CAN ID: ${id}. Must be between 0 and 0x${CAN_CONSTANTS.MAX_EXTENDED_ID.toString(
          16
        )}`,
        "INVALID_CAN_ID"
      );
    }
    return { type: "extended", id };
  }

  /**
   * Check if an ID requires extended format
   * @param id Numeric ID
   * @returns True if extended ID is required
   */
  static isExtendedId(id: number): boolean {
    return id > CAN_CONSTANTS.MAX_STANDARD_ID;
  }

  /**
   * Parse a CAN frame from different input formats
   * @param input String in candump format or frame object
   * @returns Parsed CAN frame
   */
  static parseCanFrame(input: string | CanFrame): CanFrame {
    if (typeof input === "object") {
      return input;
    }

    // Parse candump format: "123#DEADBEEF" or "12345678#01020304"
    const match = input.match(/^([0-9A-Fa-f]+)#([0-9A-Fa-f]*)$/);
    if (!match) {
      throw new SocketCANError("Invalid CAN frame format", "INVALID_FORMAT");
    }

    const id = parseInt(match[1], 16);
    const dataStr = match[2];
    const data: number[] = [];

    // Parse data bytes (2 hex digits each)
    for (let i = 0; i < dataStr.length; i += 2) {
      const byteStr = dataStr.substr(i, 2);
      if (byteStr.length === 2) {
        data.push(parseInt(byteStr, 16));
      }
    }

    return {
      id,
      data,
      extended: id > CAN_CONSTANTS.MAX_STANDARD_ID,
    };
  }

  /**
   * Convert a CAN frame to candump format
   * @param frame CAN frame to convert
   * @returns String in candump format
   */
  static formatCanFrame(frame: CanFrame): string {
    const id = frame.id.toString(16).toUpperCase();
    const data = frame.data
      .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
      .join("");
    return `${id}#${data}`;
  }

  /**
   * Create a random CAN frame for testing
   * @param options Frame generation options
   * @returns Generated CAN frame
   */
  static createRandomFrame(options?: {
    extended?: boolean;
    dataLength?: number;
    idRange?: { min: number; max: number };
  }): CanFrame {
    const extended = options?.extended ?? Math.random() > 0.8;
    const maxId = extended
      ? CAN_CONSTANTS.MAX_EXTENDED_ID
      : CAN_CONSTANTS.MAX_STANDARD_ID;
    const minId = options?.idRange?.min ?? 1;
    const maxIdRange = Math.min(options?.idRange?.max ?? maxId, maxId);

    const id = Math.floor(Math.random() * (maxIdRange - minId + 1)) + minId;
    const dataLength = options?.dataLength ?? Math.floor(Math.random() * 8) + 1;
    const data = Array.from({ length: dataLength }, () =>
      Math.floor(Math.random() * 256)
    );

    return { id, data, extended };
  }
}

// Default and named exports
export default SocketCAN;
export { SocketCANError, CAN_CONSTANTS };
export type { CanFrame, CanSocketOptions, CanId, CanData, SocketId };
