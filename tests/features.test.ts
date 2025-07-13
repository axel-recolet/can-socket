// Unit tests for additional SocketCAN features

// Mock the native SocketCAN module
jest.mock(
  "../../can_socket.node",
  () => ({
    createSocket: jest.fn().mockReturnValue(42),
    sendFrame: jest.fn(),
    readFrame: jest.fn(),
    setFilters: jest.fn(),
    clearFilters: jest.fn(),
    closeSocket: jest.fn(),
  }),
  { virtual: true }
);

import { SocketCAN } from "../src/socketcan";
const native = require("../../can_socket.node");

describe("SocketCAN feature methods", () => {
  let can: SocketCAN;

  beforeEach(async () => {
    jest.clearAllMocks();
    can = new SocketCAN("can0");
    await can.open();
  });

  afterEach(async () => {
    await can.close();
  });

  it("isOpen returns true when socket is opened", () => {
    expect(can.isOpen()).toBe(true);
  });

  it("getInterface returns the interface name", () => {
    expect(can.getInterface()).toBe("can0");
  });

  it("setFilters calls native.setFilters with correct args", async () => {
    const filters = [{ id: 0x100, mask: 0x7ff }];
    await can.setFilters(filters as any);
    expect(native.setFilters).toHaveBeenCalledWith(42, filters);
  });

  it("clearFilters calls native.clearFilters with correct socket id", async () => {
    await can.clearFilters();
    expect(native.clearFilters).toHaveBeenCalledWith(42);
  });

  it("collectFrames yields maxFrames number of frames", async () => {
    // Stub readFrame to return a fixed frame
    native.readFrame.mockReturnValue({
      id: 1,
      data: [0],
      fd: false,
      remote: false,
      error: false,
    });
    const result = await can.collectFrames({ maxFrames: 3, timeout: 10 });
    expect(result).toHaveLength(3);
    expect(native.readFrame).toHaveBeenCalledTimes(3);
  });
});
