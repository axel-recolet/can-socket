/**
 * Main entry point for SocketCAN Neon Rust module
 * This file is compiled from TypeScript source in src/
 */

// Export the main SocketCAN class and utilities
export { SocketCAN } from "./socketcan";

// Export all types for TypeScript users
export * from "../types/socketcan";

// For CommonJS compatibility (Node.js require())
import { SocketCAN as SocketCANClass } from "./socketcan";
import * as types from "../types/socketcan";

// Default export for require() usage
const SocketCAN = SocketCANClass;

// Named exports for ES6 imports
const namedExports = {
  SocketCAN: SocketCANClass,
  ...types,
};

// CommonJS module.exports
module.exports = SocketCAN;
module.exports.SocketCAN = SocketCANClass;
module.exports.default = SocketCANClass;

// Copy all named exports
Object.assign(module.exports, namedExports);
