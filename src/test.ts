import { SocketCAN, SocketCANError, SocketCANUtils } from "./socketcan";

/**
 * SocketCAN module tests in TypeScript
 */
async function testSocketCANTypeScript(): Promise<void> {
  console.log("=== SocketCAN TypeScript Module Test ===\n");

  // Replace 'can0' with your actual CAN interface
  const can = new SocketCAN("can0", { defaultTimeout: 1000 });

  try {
    // Test socket opening
    console.log("1. Opening CAN socket...");
    await can.open();

    console.log(`Interface: ${can.getInterface()}`);
    console.log(`Socket open: ${can.isOpen()}`);

    // Test frame sending
    console.log("\n2. Sending a CAN frame...");
    await can.send(0x123, [0x01, 0x02, 0x03, 0x04]);

    // Test utilities
    console.log("\n3. Testing utilities...");
    const testNumber = 0x12345678;
    const bytes = SocketCANUtils.numberToBytes(testNumber, 4);
    const backToNumber = SocketCANUtils.bytesToNumber(bytes);

    console.log(`Original number: 0x${testNumber.toString(16)}`);
    console.log(
      `Bytes: [${bytes.map((b) => `0x${b.toString(16)}`).join(", ")}]`
    );
    console.log(`Converted back: 0x${backToNumber.toString(16)}`);
    console.log(`Conversion correct: ${testNumber === backToNumber}`);

    // Test formatting
    console.log(`\nID formatting: ${SocketCANUtils.formatCanId(0x123)}`);
    console.log(
      `Data formatting: ${SocketCANUtils.formatCanData([
        0xde, 0xad, 0xbe, 0xef,
      ])}`
    );

    // Test frame reception (with timeout)
    console.log("\n4. Waiting for CAN frame reception (timeout: 1000ms)...");
    try {
      const frame = await can.receive(1000);
      console.log(
        `Frame received: ID=${SocketCANUtils.formatCanId(
          frame.id
        )}, Data=${SocketCANUtils.formatCanData(frame.data)}`
      );
    } catch (error) {
      if (error instanceof SocketCANError) {
        console.log(`SocketCAN Error [${error.code}]: ${error.message}`);
      } else {
        console.log("No frame received within timeout");
      }
    }

    // Test error validation
    console.log("\n5. Validation test...");
    try {
      // Try to send more than 8 bytes (should fail)
      await can.send(0x123, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    } catch (error) {
      if (error instanceof SocketCANError) {
        console.log(`✓ Validation OK [${error.code}]: ${error.message}`);
      }
    }

    try {
      // Try to send invalid ID (should fail)
      await can.send(0x800, [1, 2, 3]);
    } catch (error) {
      if (error instanceof SocketCANError) {
        console.log(`✓ Validation OK [${error.code}]: ${error.message}`);
      }
    }

    try {
      // Try to send invalid byte (should fail)
      await can.send(0x123, [1, 2, 256]);
    } catch (error) {
      if (error instanceof SocketCANError) {
        console.log(`✓ Validation OK [${error.code}]: ${error.message}`);
      }
    }

    // Close socket
    console.log("\n6. Closing CAN socket...");
    can.close();
    console.log(`Socket open after close: ${can.isOpen()}`);

    console.log("\n=== Test completed successfully ===");
  } catch (error) {
    if (error instanceof SocketCANError) {
      console.error(`SocketCAN Error [${error.code}]: ${error.message}`);
    } else {
      console.error(
        "Error during test:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    console.log("\nNote: This test requires:");
    console.log("- A configured CAN interface (e.g., can0)");
    console.log("- Appropriate permissions to access the CAN interface");
    console.log("- A Linux environment with SocketCAN enabled");
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSocketCANTypeScript().catch(console.error);
}

export { testSocketCANTypeScript };
