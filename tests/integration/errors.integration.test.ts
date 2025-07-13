/**
 * Integration tests for error handling and edge cases on vcan0
 */
import { SocketCAN, SocketCANError } from "../../src/socketcan";

describe("Integration: Error handling", () => {
  let can: SocketCAN;

  beforeAll(async () => {
    if (process.platform !== "linux") {
      console.warn("Skipping integration tests: not running on Linux");
      return;
    }
    can = new SocketCAN("vcan0");
  });

  afterEach(async () => {
    if (process.platform === "linux" && can?.isListening) {
      await can.stopListening();
    }
    if (process.platform === "linux" && can?.isOpen()) {
      await can.close();
    }
  });

  // Skip all tests if not on Linux
  if (process.platform !== "linux") {
    test("Error handling tests skipped on non-Linux platform", () => {
      expect(true).toBe(true);
    });
  } else {
    test("should handle timeout errors gracefully", async () => {
      await can.open();

      // Test receive with very short timeout should produce timeout error
      await expect(can.receive(1)).rejects.toThrow("timeout");
    });

    test("should handle invalid interface names", async () => {
      const invalidCan = new SocketCAN("nonexistent_interface_12345");
      await expect(invalidCan.open()).rejects.toThrow();
    });

    test("should reject operations on closed socket", async () => {
      const closedCan = new SocketCAN("vcan0");
      // Don't open it
      await expect(closedCan.send(0x123, [1, 2, 3])).rejects.toThrow(
        "not open"
      );
    });
  }
});
