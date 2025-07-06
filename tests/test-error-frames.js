#!/usr/bin/env node

/**
 * Test script for CAN error frames functionality
 * Tests the ability to detect and handle error frames
 */

const SocketCAN = require("../index.js");

async function testErrorFrames() {
  console.log("=== Testing CAN Error Frames ===\n");

  try {
    // Create a SocketCAN instance
    const canInterface = "vcan0"; // Virtual CAN interface for testing
    const socket = new SocketCAN(canInterface);

    console.log(`Attempting to open CAN socket on ${canInterface}...`);

    try {
      await socket.open();
      console.log("✓ Socket opened successfully\n");
    } catch (openError) {
      console.log(
        "✗ Failed to open socket (this is expected on non-Linux systems)"
      );
      console.log(`Error: ${openError.message}\n`);

      // Continue with API testing even if socket can't open
      console.log("Continuing with API validation tests...\n");
    }

    // Test 1: Frame type detection utilities
    console.log("Test 1: Testing error frame detection utilities");

    // Mock frames for testing
    const regularFrame = {
      id: 0x123,
      data: [1, 2, 3],
      extended: false,
      fd: false,
      remote: false,
      error: false,
    };

    const errorFrame = {
      id: 0x20000000, // Error frame ID (usually has special bits set)
      data: [0xff, 0x00, 0x08, 0x00, 0x00, 0x00, 0x60, 0x00], // Error data
      extended: false,
      fd: false,
      remote: false,
      error: true,
    };

    const remoteFrame = {
      id: 0x456,
      data: [],
      extended: false,
      fd: false,
      remote: true,
      error: false,
    };

    console.log(
      "Regular frame error detection:",
      SocketCAN.isErrorFrame(regularFrame) ? "✗" : "✓"
    );
    console.log(
      "Error frame detection:",
      SocketCAN.isErrorFrame(errorFrame) ? "✓" : "✗"
    );
    console.log(
      "Remote frame error detection:",
      SocketCAN.isErrorFrame(remoteFrame) ? "✗" : "✓"
    );

    // Test 2: Comprehensive frame type checking
    console.log("\nTest 2: Comprehensive frame type checking");

    const testFrames = [
      { name: "Regular CAN frame", frame: regularFrame },
      { name: "Error frame", frame: errorFrame },
      { name: "Remote frame", frame: remoteFrame },
      {
        name: "CAN FD frame",
        frame: {
          id: 0x789,
          data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          extended: false,
          fd: true,
          remote: false,
          error: false,
        },
      },
    ];

    testFrames.forEach(({ name, frame }) => {
      console.log(`\\n${name}:`);
      console.log(`  - Is Remote: ${SocketCAN.isRemoteFrame(frame)}`);
      console.log(`  - Is Error: ${SocketCAN.isErrorFrame(frame)}`);
      console.log(`  - Is CAN FD: ${SocketCAN.isCanFdFrame(frame)}`);
    });

    // Test 3: Error frame data interpretation (mock example)
    console.log("\\nTest 3: Error frame data interpretation example");

    function interpretErrorFrame(frame) {
      if (!SocketCAN.isErrorFrame(frame)) {
        return "Not an error frame";
      }

      const errorData = frame.data;
      if (errorData.length < 8) {
        return "Insufficient error data";
      }

      // This is a simplified interpretation - real error frames have complex bit patterns
      const errorClass = errorData[0];
      let interpretation = "Unknown error";

      switch (errorClass & 0xe0) {
        case 0x00:
          interpretation = "TX timeout error";
          break;
        case 0x20:
          interpretation = "Lost arbitration error";
          break;
        case 0x40:
          interpretation = "Controller error";
          break;
        case 0x80:
          interpretation = "Protocol violation error";
          break;
        case 0xa0:
          interpretation = "Transceiver error";
          break;
        case 0xc0:
          interpretation = "No acknowledgment error";
          break;
        default:
          interpretation = `Error class: 0x${errorClass.toString(16)}`;
      }

      return interpretation;
    }

    console.log("Error frame interpretation:", interpretErrorFrame(errorFrame));
    console.log(
      "Regular frame interpretation:",
      interpretErrorFrame(regularFrame)
    );

    // Test 4: Simulate receiving frames and processing them
    console.log("\\nTest 4: Frame processing simulation");

    const simulatedFrames = [regularFrame, errorFrame, remoteFrame];

    simulatedFrames.forEach((frame, index) => {
      console.log(`\\nProcessing frame ${index + 1}:`);
      console.log(`  ID: 0x${frame.id.toString(16)}`);
      console.log(`  Data length: ${frame.data.length}`);

      if (SocketCAN.isErrorFrame(frame)) {
        console.log("  🚨 Error frame detected:", interpretErrorFrame(frame));
      } else if (SocketCAN.isRemoteFrame(frame)) {
        console.log("  📡 Remote frame detected - data request");
      } else if (SocketCAN.isCanFdFrame(frame)) {
        console.log("  🚀 CAN FD frame detected - high bandwidth");
      } else {
        console.log("  📄 Regular CAN frame");
      }
    });

    await socket.close();
    console.log("\\n✓ Socket closed successfully");
  } catch (error) {
    console.error("Test failed:", error.message);
    process.exit(1);
  }

  console.log("\\n=== Error Frames Test Complete ===");
}

// Run the test
testErrorFrames().catch(console.error);
