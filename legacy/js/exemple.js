const SocketCAN = require("./index");

/**
 * Advanced usage example of the SocketCAN module
 */
async function exempleAvance() {
  console.log("=== Advanced SocketCAN Example ===\n");

  const can = new SocketCAN("vcan0");

  try {
    // 1. Open the socket
    await can.open();

    // 2. Send multiple frames with different IDs
    const frames = [
      { id: 0x100, data: [0x01, 0x02, 0x03, 0x04] },
      { id: 0x200, data: [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff] },
      { id: 0x7ff, data: [0x12] }, // Maximum ID for 11-bit
    ];

    console.log("Sending multiple frames...");
    for (const frame of frames) {
      try {
        await can.send(frame.id, frame.data);
        console.log(`✓ Frame 0x${frame.id.toString(16)} sent`);
      } catch (error) {
        console.log(
          `✗ Frame error 0x${frame.id.toString(16)}: ${error.message}`
        );
      }
    }

    // 3. Try to receive frames in a loop
    console.log("\nListening for frames (500ms timeout per attempt)...");
    for (let i = 0; i < 3; i++) {
      try {
        const frame = await can.receive(500);
        console.log(
          `Frame received: ID=0x${frame.id.toString(
            16
          )}, Data=[${frame.data.join(", ")}]`
        );
      } catch (error) {
        console.log(`Attempt ${i + 1}: No frame received`);
      }
    }

    // 4. Data validation test
    console.log("\nValidation test...");
    try {
      // Try to send more than 8 bytes (should fail)
      await can.send(0x123, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    } catch (error) {
      console.log(`✓ Validation OK: ${error.message}`);
    }

    // 5. Close the socket
    can.close();
    console.log("\n=== End of example ===");
  } catch (error) {
    console.error("General error:", error.message);
    console.log(
      "\nNote: This example requires a Linux environment with SocketCAN."
    );
    console.log("To test on Linux:");
    console.log("1. sudo modprobe vcan");
    console.log("2. sudo ip link add dev vcan0 type vcan");
    console.log("3. sudo ip link set up vcan0");
    can.close();
  }
}

// Utility function to create a virtual CAN interface (Linux only)
function printLinuxSetup() {
  console.log("\n=== Virtual CAN Interface Setup (Linux) ===");
  console.log("# Load the vcan module");
  console.log("sudo modprobe vcan");
  console.log("");
  console.log("# Create a virtual CAN interface");
  console.log("sudo ip link add dev vcan0 type vcan");
  console.log("sudo ip link set up vcan0");
  console.log("");
  console.log("# Verify that the interface is active");
  console.log("ip link show vcan0");
  console.log("");
  console.log("# Optional: use can-utils for testing");
  console.log("# sudo apt-get install can-utils");
  console.log("# cansend vcan0 123#DEADBEEF");
  console.log("# candump vcan0");
  console.log("======================================================\n");
}

// Run the example if this file is executed directly
if (require.main === module) {
  printLinuxSetup();
  exempleAvance();
}

module.exports = { exempleAvance, printLinuxSetup };
