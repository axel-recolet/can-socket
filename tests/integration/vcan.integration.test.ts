/**
 * Integration test: send and receive on vcan0 interface
 * Requires Linux and a configured vcan0 interface (sudo modprobe vcan; sudo ip link add dev vcan0 type vcan; sudo ip link set up vcan0)
 */
import { SocketCAN } from "../../src/socketcan";

describe("vcan0 integration", () => {
  let sender: SocketCAN;
  let receiver: SocketCAN;

  beforeAll(async () => {
    if (process.platform !== "linux") {
      console.warn("Skipping integration tests: not running on Linux");
      return;
    }
    sender = new SocketCAN("vcan0");
    receiver = new SocketCAN("vcan0");
    await sender.open();
    await receiver.open();
  });

  afterAll(async () => {
    if (process.platform !== "linux") return;
    await sender.close();
    await receiver.close();
  });

  it("should send and receive a CAN frame", async () => {
    if (process.platform !== "linux") {
      return;
    }
    const testId = 0x321;
    const payload = [1, 2, 3, 4];

    // Send frame
    await sender.send(testId, payload);
    // Receive frame
    const frame = await receiver.receive(2000);
    expect(frame).toBeDefined();
    expect(frame.id).toBe(testId);
    expect(frame.data).toEqual(payload);
  });
});
