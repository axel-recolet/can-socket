const socketcan = require("./socketcan_neon_rust.node");

/**
 * JavaScript wrapper class to facilitate usage of the SocketCAN module
 */
class SocketCAN {
  constructor(interfaceName, options = {}) {
    this.interfaceName = interfaceName;
    this.socket = null;
    this.canFd = options.canFd || false;
  }

  /**
   * Open the CAN socket
   * @returns {Promise<void>}
   */
  async open() {
    try {
      this.socket = socketcan.createSocket(this.interfaceName, this.canFd);
      const socketType = this.canFd ? "CAN FD" : "CAN";
      console.log(
        `${socketType} socket opened on interface: ${this.interfaceName}`
      );
    } catch (error) {
      throw new Error(`Cannot open CAN socket: ${error.message}`);
    }
  }

  /**
   * Send a CAN frame
   * @param {number} id - CAN frame ID (11-bit standard or 29-bit extended)
   * @param {Array<number>} data - Data to send (max 8 bytes for CAN, 64 for CAN FD)
   * @param {boolean} extended - Whether to use extended ID (optional, default false)
   * @param {boolean} fd - Whether to send as CAN FD frame (optional, default false)
   * @param {boolean} remote - Whether to send as remote frame (optional, default false)
   * @returns {Promise<void>}
   */
  async send(id, data, extended = null, fd = false, remote = false) {
    if (!this.socket) {
      throw new Error("CAN socket not open");
    }

    if (remote && fd) {
      throw new Error("Remote frames are not supported with CAN FD");
    }

    // Auto-detect extended ID if not specified
    if (extended === null) {
      extended = id > 0x7ff;
    }

    // Validate ID based on type
    const maxId = extended ? 0x1fffffff : 0x7ff;
    if (id < 0 || id > maxId) {
      const idType = extended ? "extended" : "standard";
      throw new Error(
        `Invalid ${idType} CAN ID: ${id}. Must be between 0 and 0x${maxId.toString(
          16
        )}`
      );
    }

    // Validate data length based on frame type
    const maxDataLength = fd ? 64 : 8;
    if (data.length > maxDataLength) {
      const frameType = fd ? "CAN FD" : "CAN";
      throw new Error(`${frameType} data cannot exceed ${maxDataLength} bytes`);
    }

    try {
      socketcan.sendFrame(this.socket, id, data, extended, fd, remote);
      const idStr = extended
        ? `0x${id.toString(16)} (ext)`
        : `0x${id.toString(16)}`;
      const frameType = fd ? "FD" : remote ? "Remote" : "";
      console.log(
        `CAN ${frameType} frame sent - ID: ${idStr}, Data: [${data.join(", ")}]`
      );
    } catch (error) {
      throw new Error(`Send error: ${error.message}`);
    }
  }

  /**
   * Receive a CAN frame
   * @param {number} timeout - Timeout in milliseconds (optional)
   * @returns {Promise<{id: number, data: Array<number>, extended: boolean, fd: boolean, remote: boolean, error: boolean}>}
   */
  async receive(timeout = null) {
    if (!this.socket) {
      throw new Error("CAN socket not open");
    }

    try {
      const frame = socketcan.readFrame(this.socket, timeout);
      const idStr = frame.extended
        ? `0x${frame.id.toString(16)} (ext)`
        : `0x${frame.id.toString(16)}`;

      // Enhanced frame type detection
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
        `CAN ${frameType} frame received - ID: ${idStr}, Data: [${frame.data.join(
          ", "
        )}]`
      );
      return frame;
    } catch (error) {
      throw new Error(`Receive error: ${error.message}`);
    }
  }

  /**
   * Set CAN filters for selective frame reception
   * @param {Array<{id: number, mask: number, extended?: boolean}>} filters - Array of CAN filters
   * @returns {Promise<void>}
   */
  async setFilters(filters) {
    if (!this.socket) {
      throw new Error("CAN socket not open");
    }

    // Validate filters
    for (const filter of filters) {
      const extended = filter.extended || false;
      const maxId = extended ? 0x1fffffff : 0x7ff;

      if (filter.id < 0 || filter.id > maxId) {
        const idType = extended ? "extended" : "standard";
        throw new Error(
          `Invalid ${idType} CAN filter ID: ${
            filter.id
          }. Must be between 0 and 0x${maxId.toString(16)}`
        );
      }

      if (filter.mask < 0 || filter.mask > maxId) {
        const idType = extended ? "extended" : "standard";
        throw new Error(
          `Invalid ${idType} CAN filter mask: ${
            filter.mask
          }. Must be between 0 and 0x${maxId.toString(16)}`
        );
      }
    }

    try {
      socketcan.setFilters(this.socket, filters);
      console.log(`Set ${filters.length} CAN filters`);
    } catch (error) {
      throw new Error(`Filter error: ${error.message}`);
    }
  }

  /**
   * Clear all CAN filters (receive all frames)
   * @returns {Promise<void>}
   */
  async clearFilters() {
    if (!this.socket) {
      throw new Error("CAN socket not open");
    }

    try {
      socketcan.clearFilters(this.socket);
      console.log("Cleared all CAN filters");
    } catch (error) {
      throw new Error(`Filter error: ${error.message}`);
    }
  }

  /**
   * Send a remote CAN frame (request for data)
   * @param {number} id - CAN frame ID
   * @param {number} dlc - Data Length Code (number of bytes requested, 0-8)
   * @param {boolean} extended - Whether to use extended ID (optional, default: auto-detect)
   * @returns {Promise<void>}
   */
  async sendRemote(id, dlc = 0, extended = null) {
    if (dlc < 0 || dlc > 8) {
      throw new Error("DLC must be between 0 and 8 for remote frames");
    }

    // Create empty data array with specified DLC length
    const data = new Array(dlc).fill(0);

    return this.send(id, data, extended, false, true);
  }

  /**
   * Close the CAN socket
   */
  async close() {
    if (this.socket) {
      try {
        socketcan.closeSocket(this.socket);
        this.socket = null;
        console.log("CAN socket closed");
      } catch (error) {
        throw new Error(`Close error: ${error.message}`);
      }
    }
  }

  /**
   * Check if a frame is a remote frame
   * @param {Object} frame - The frame to check
   * @returns {boolean} True if it's a remote frame
   */
  static isRemoteFrame(frame) {
    return frame.remote === true;
  }

  /**
   * Check if a frame is an error frame
   * @param {Object} frame - The frame to check
   * @returns {boolean} True if it's an error frame
   */
  static isErrorFrame(frame) {
    return frame.error === true;
  }

  /**
   * Check if a frame is a CAN FD frame
   * @param {Object} frame - The frame to check
   * @returns {boolean} True if it's a CAN FD frame
   */
  static isCanFdFrame(frame) {
    return frame.fd === true;
  }

  /**
   * Check if the socket is open
   * @returns {boolean} True if socket is open
   */
  isOpen() {
    return this.socket !== null;
  }

  /**
   * Get the interface name
   * @returns {string} The interface name
   */
  getInterface() {
    return this.interfaceName;
  }
}

module.exports = SocketCAN;
