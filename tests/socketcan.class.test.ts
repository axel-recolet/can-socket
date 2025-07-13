// Mock the native SocketCAN module
jest.mock(
  "../../can_socket.node",
  () => ({
    createSocket: jest.fn().mockReturnValue(99),
    sendFrame: jest.fn(),
    readFrame: jest
      .fn()
      .mockReturnValue({
        id: 0x123,
        data: [1, 2],
        fd: false,
        remote: false,
        error: false,
      }),
    closeSocket: jest.fn(),
  }),
  { virtual: true }
);

import { SocketCAN } from "../src/socketcan";
const native = require("../../can_socket.node");

describe("SocketCAN class", () => {
  let can: SocketCAN;
  beforeEach(() => {
    can = new SocketCAN("vcan0", { canFd: false });
    jest.clearAllMocks();
  });

  it("open() calls native.createSocket with interface and mode", async () => {
    await can.open();
    expect(native.createSocket).toHaveBeenCalledWith("vcan0", false);
  });

  it("send() rejects when remote and fd flags are both true", async () => {
    await can.open();
    await expect(can.send(1, [0], { fd: true, remote: true })).rejects.toThrow(
      "Remote frames are not supported with CAN FD"
    );
  });

  it("send() calls native.sendFrame with correct parameters", async () => {
    await can.open();
    await can.send(0x1a, [1, 2, 3], {
      extended: true,
      fd: false,
      remote: false,
    });
    expect(native.sendFrame).toHaveBeenCalledWith(
      99,
      0x1a,
      [1, 2, 3],
      true,
      false,
      false
    );
  });

  it("receive() calls native.readFrame and returns its result", async () => {
    await can.open();
    const frame = await can.receive(1234);
    expect(native.readFrame).toHaveBeenCalledWith(99, 1234);
    expect(frame).toEqual({
      id: 0x123,
      data: [1, 2],
      fd: false,
      remote: false,
      error: false,
    });
  });

  it("close() calls native.closeSocket", async () => {
    await can.open();
    await can.close();
    expect(native.closeSocket).toHaveBeenCalledWith(99);
  });
});
