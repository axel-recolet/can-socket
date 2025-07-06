/**
 * Types for the native SocketCAN Rust module
 */

/**
 * Standard CAN ID (11-bit)
 */
export interface StandardCanId {
  type: "standard";
  id: number; // 0..=0x7FF
}

/**
 * Extended CAN ID (29-bit)
 */
export interface ExtendedCanId {
  type: "extended";
  id: number; // 0..=0x1FFFFFFF
}

/**
 * Union type for CAN IDs
 */
export type CanId = StandardCanId | ExtendedCanId | number; // number for backward compatibility

/**
 * Structure representing a regular CAN frame
 */
export interface CanFrame {
  /** CAN frame ID (11-bit standard or 29-bit extended) */
  id: number;
  /** Frame data (maximum 8 bytes for CAN 2.0) */
  data: number[];
  /** Whether this is an extended ID frame */
  extended?: boolean;
  /** Whether this is a CAN FD frame */
  fd?: false;
  /** Whether this is a remote frame */
  remote?: false;
  /** Whether this is an error frame */
  error?: false;
}

/**
 * Structure representing a CAN FD frame
 */
export interface CanFdFrame {
  /** CAN frame ID (11-bit standard or 29-bit extended) */
  id: number;
  /** Frame data (maximum 64 bytes for CAN FD) */
  data: number[];
  /** Whether this is an extended ID frame */
  extended?: boolean;
  /** CAN FD frame marker */
  fd: true;
  /** CAN FD frames don't support remote */
  remote?: false;
  /** Whether this is an error frame */
  error?: false;
}

/**
 * Structure representing a remote CAN frame
 */
export interface CanRemoteFrame {
  /** CAN frame ID (11-bit standard or 29-bit extended) */
  id: number;
  /** Remote frames have no data payload, but may indicate DLC */
  data: number[]; // Empty array, length indicates requested DLC
  /** Whether this is an extended ID frame */
  extended?: boolean;
  /** Remote frames are not CAN FD */
  fd?: false;
  /** Remote frame marker */
  remote: true;
  /** Remote frames are not error frames */
  error?: false;
}

/**
 * Structure representing a CAN error frame
 */
export interface CanErrorFrame {
  /** Error frame ID (usually contains error information) */
  id: number;
  /** Error data (interpretation depends on error type) */
  data: number[];
  /** Whether this is an extended ID frame */
  extended?: boolean;
  /** Error frames are not CAN FD */
  fd?: false;
  /** Error frames are not remote */
  remote?: false;
  /** Error frame marker */
  error: true;
}

/**
 * Union type for all frame types
 */
export type AnyCanFrame =
  | CanFrame
  | CanFdFrame
  | CanRemoteFrame
  | CanErrorFrame;

/**
 * Configuration options for CAN socket
 */
export interface CanSocketOptions {
  /** CAN interface name */
  interfaceName: string;
  /** Default timeout for read operations (ms) */
  defaultTimeout?: number;
  /** Non-blocking mode */
  nonBlocking?: boolean;
  /** Enable CAN FD support */
  canFd?: boolean;
}

/**
 * Native Rust module interface
 */
export interface NativeSocketCAN {
  /**
   * Create a new CAN socket
   * @param interfaceName CAN interface name (e.g., 'can0', 'vcan0')
   * @param canFd Whether to create a CAN FD socket (optional, default false)
   * @returns Created socket ID
   */
  createSocket(interfaceName: string, canFd?: boolean): number;

  /**
   * Send a CAN frame
   * @param socketId Socket ID
   * @param id CAN frame ID
   * @param data Data to send (max 8 bytes for CAN, 64 for CAN FD)
   * @param extended Whether to use extended ID (optional, default false)
   * @param fd Whether to send as CAN FD frame (optional, default false)
   * @param remote Whether to send as remote frame (optional, default false)
   */
  sendFrame(
    socketId: number,
    id: number,
    data: number[],
    extended?: boolean,
    fd?: boolean,
    remote?: boolean
  ): void;

  /**
   * Receive a CAN frame
   * @param socketId Socket ID
   * @param timeout Timeout in milliseconds (optional)
   * @returns Received CAN frame (can be regular, FD, remote, or error frame)
   */
  readFrame(socketId: number, timeout?: number): AnyCanFrame;

  /**
   * Set CAN filters for selective frame reception
   * @param socketId Socket ID
   * @param filters Array of CAN filters
   */
  setFilters(socketId: number, filters: CanFilter[]): void;

  /**
   * Clear all CAN filters (receive all frames)
   * @param socketId Socket ID
   */
  clearFilters(socketId: number): void;

  /**
   * Close a CAN socket and free resources
   * @param socketId Socket ID
   */
  closeSocket(socketId: number): void;
}

/**
 * CAN frame filter for selective reception
 */
export interface CanFilter {
  /** CAN ID to filter (11-bit standard or 29-bit extended) */
  id: number;
  /** Mask for the filter (bits set to 1 are relevant) */
  mask: number;
  /** Whether this filter applies to extended IDs */
  extended?: boolean;
  /** Whether to invert the filter (reject matching frames) */
  inverted?: boolean;
}

/**
 * SocketCAN module specific errors
 */
export class SocketCANError extends Error {
  constructor(message: string, public code?: SocketCANErrorCode) {
    super(message);
    this.name = "SocketCANError";
  }
}

/**
 * Error codes for SocketCAN operations
 */
export type SocketCANErrorCode =
  | "SOCKET_NOT_OPEN"
  | "SOCKET_OPEN_ERROR"
  | "SOCKET_CLOSE_ERROR"
  | "SEND_ERROR"
  | "RECEIVE_ERROR"
  | "RECEIVE_TIMEOUT"
  | "TIMEOUT_ERROR"
  | "INVALID_CAN_ID"
  | "INVALID_EXTENDED_ID"
  | "INVALID_STANDARD_ID"
  | "DATA_TOO_LONG"
  | "DATA_TOO_LONG_FD"
  | "INVALID_BYTE"
  | "INVALID_FORMAT"
  | "INVALID_PARAMETERS"
  | "INTERFACE_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "PLATFORM_NOT_SUPPORTED"
  | "CAN_FD_NOT_SUPPORTED"
  | "FILTER_ERROR"
  | "INVALID_FILTER"
  | "ALREADY_LISTENING"
  | "LISTENING_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Constants for CAN IDs and data
 */
export const CAN_CONSTANTS = {
  /** Maximum CAN ID for standard frames (11-bit) */
  MAX_STANDARD_ID: 0x7ff,
  /** Maximum CAN ID for extended frames (29-bit) */
  MAX_EXTENDED_ID: 0x1fffffff,
  /** Maximum CAN data size for CAN 2.0 */
  MAX_DATA_LENGTH: 8,
  /** Maximum CAN FD data size */
  MAX_FD_DATA_LENGTH: 64,
  /** Standard ID mask */
  STANDARD_ID_MASK: 0x7ff,
  /** Extended ID mask */
  EXTENDED_ID_MASK: 0x1fffffff,
} as const;

/**
 * Utility types
 */
export type CanData = number[];
export type SocketId = number;
