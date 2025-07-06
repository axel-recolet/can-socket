/**
 * Ambient declarations for the native SocketCAN module
 * Allows TypeScript to recognize the .node module
 */

declare module "*.node" {
  const content: any;
  export = content;
}

declare module "../../socketcan_neon_rust.node" {
  import { NativeSocketCAN } from "../types/socketcan";
  const socketcan: NativeSocketCAN;
  export = socketcan;
}
