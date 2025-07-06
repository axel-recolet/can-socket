const SocketCAN = require("../index");

async function testSocketCAN() {
  console.log("=== SocketCAN Module Test ===\n");

  // Replace 'can0' with your actual CAN interface
  const can = new SocketCAN("can0");

  try {
    // Test socket opening
    console.log("1. Opening CAN socket...");
    await can.open();

    // Test sending a frame
    console.log("\n2. Sending a CAN frame...");
    await can.send(0x123, [0x01, 0x02, 0x03, 0x04]);

    // Test receiving a frame (with timeout)
    console.log("\n3. Waiting for a CAN frame reception (timeout: 1000ms)...");
    try {
      const frame = await can.receive(1000);
      console.log(
        `Frame received: ID=0x${frame.id.toString(16)}, Data=${JSON.stringify(
          frame.data
        )}`
      );
    } catch (error) {
      console.log("No frame received within timeout");
    }

    // Close the socket
    console.log("\n4. Closing CAN socket...");
    can.close();

    console.log("\n=== Test completed successfully ===");
  } catch (error) {
    console.error("Error during test:", error.message);
    console.log("\nNote: This test requires:");
    console.log("- A configured CAN interface (e.g.: can0)");
    console.log("- Appropriate permissions to access the CAN interface");
    console.log("- A Linux environment with SocketCAN enabled");
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSocketCAN();
}

module.exports = testSocketCAN;
