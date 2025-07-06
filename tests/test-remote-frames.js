#!/usr/bin/env node

/**
 * Test script for CAN remote frames functionality
 * Tests the ability to send and identify remote frames
 */

const SocketCAN = require("../index.js");

async function testRemoteFrames() {
  console.log("=== Testing CAN Remote Frames ===\n");

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

    // Test 1: Send a remote frame with standard ID
    console.log("Test 1: Sending remote frame with standard ID");
    try {
      await socket.sendRemote(0x123, 8); // Request 8 bytes from ID 0x123
      console.log("✓ Remote frame sent successfully");
    } catch (error) {
      console.log(`✗ Remote frame send failed: ${error.message}`);
    }

    // Test 2: Send a remote frame with extended ID
    console.log("\nTest 2: Sending remote frame with extended ID");
    try {
      await socket.sendRemote(0x12345678, 4, true); // Request 4 bytes from extended ID
      console.log("✓ Remote frame with extended ID sent successfully");
    } catch (error) {
      console.log(
        `✗ Remote frame with extended ID send failed: ${error.message}`
      );
    }

    // Test 3: Test invalid DLC
    console.log("\nTest 3: Testing invalid DLC validation");
    try {
      await socket.sendRemote(0x123, 9); // Invalid DLC (>8)
      console.log("✗ Should have failed with invalid DLC");
    } catch (error) {
      console.log("✓ Correctly rejected invalid DLC:", error.message);
    }

    // Test 4: Test frame type detection utilities
    console.log("\nTest 4: Testing frame type detection utilities");

    // Mock frames for testing
    const regularFrame = {
      id: 0x123,
      data: [1, 2, 3],
      extended: false,
      fd: false,
    };
    const remoteFrame = {
      id: 0x123,
      data: [],
      extended: false,
      fd: false,
      remote: true,
    };
    const errorFrame = {
      id: 0x123,
      data: [0xff],
      extended: false,
      fd: false,
      error: true,
    };
    const fdFrame = {
      id: 0x123,
      data: [1, 2, 3, 4],
      extended: false,
      fd: true,
    };

    console.log(
      "Regular frame detection:",
      SocketCAN.isRemoteFrame(regularFrame) ? "✗" : "✓"
    );
    console.log(
      "Remote frame detection:",
      SocketCAN.isRemoteFrame(remoteFrame) ? "✓" : "✗"
    );
    console.log(
      "Error frame detection:",
      SocketCAN.isErrorFrame(errorFrame) ? "✓" : "✗"
    );
    console.log(
      "CAN FD frame detection:",
      SocketCAN.isCanFdFrame(fdFrame) ? "✓" : "✗"
    );

    // Test 5: Test parameter validation in regular send with remote flag
    console.log("\nTest 5: Testing remote flag in regular send method");
    try {
      await socket.send(0x456, [], false, false, true); // Empty data, remote=true
      console.log("✓ Send with remote flag successful");
    } catch (error) {
      console.log(`✗ Send with remote flag failed: ${error.message}`);
    }

    // Test 6: Test incompatible options (CAN FD + remote)
    console.log("\nTest 6: Testing incompatible options (CAN FD + remote)");
    try {
      await socket.send(0x789, [1, 2, 3], false, true, true); // fd=true, remote=true
      console.log("✗ Should have failed with incompatible options");
    } catch (error) {
      console.log("✓ Correctly rejected CAN FD + remote:", error.message);
    }

    await socket.close();
    console.log("\n✓ Socket closed successfully");
  } catch (error) {
    console.error("Test failed:", error.message);
    process.exit(1);
  }

  console.log("\n=== Remote Frames Test Complete ===");
}

// Run the test
testRemoteFrames().catch(console.error);
