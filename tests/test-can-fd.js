#!/usr/bin/env node

/**
 * Test script for CAN FD support
 * This script demonstrates the usage of CAN FD frames with extended data length.
 */

const SocketCAN = require("../index.js");

async function testCanFd() {
  console.log("=== CAN FD Test ===");

  try {
    // Create a CAN FD socket
    const can = new SocketCAN("vcan0", { canFd: true });
    console.log("1. Creating CAN FD socket...");

    // Open the socket
    await can.open();
    console.log("2. CAN FD socket opened successfully");

    // Test 1: Send regular CAN frame through FD socket
    console.log("\n--- Test 1: Regular CAN frame on FD socket ---");
    const regularData = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
    await can.send(0x123, regularData, false, false);
    console.log("✓ Regular CAN frame sent successfully");

    // Test 2: Send CAN FD frame with standard ID
    console.log("\n--- Test 2: CAN FD frame with standard ID ---");
    const fdData16 = Array.from({ length: 16 }, (_, i) => i + 1);
    await can.send(0x456, fdData16, false, true);
    console.log("✓ CAN FD frame (16 bytes) sent successfully");

    // Test 3: Send CAN FD frame with extended ID
    console.log("\n--- Test 3: CAN FD frame with extended ID ---");
    const fdData32 = Array.from({ length: 32 }, (_, i) => i % 256);
    await can.send(0x12345678, fdData32, true, true);
    console.log("✓ CAN FD frame (32 bytes) with extended ID sent successfully");

    // Test 4: Send maximum size CAN FD frame
    console.log("\n--- Test 4: Maximum size CAN FD frame ---");
    const fdData64 = Array.from({ length: 64 }, (_, i) => (i * 2) % 256);
    await can.send(0x789, fdData64, false, true);
    console.log("✓ CAN FD frame (64 bytes) sent successfully");

    // Test 5: Error handling - Data too long for regular CAN
    console.log(
      "\n--- Test 5: Error handling - Data too long for regular CAN ---"
    );
    try {
      const longData = Array.from({ length: 16 }, (_, i) => i);
      await can.send(0x999, longData, false, false); // Regular CAN with 16 bytes
      console.log("✗ Should have failed");
    } catch (error) {
      console.log(
        "✓ Correctly rejected long data for regular CAN:",
        error.message
      );
    }

    // Test 6: Error handling - Data too long for CAN FD
    console.log("\n--- Test 6: Error handling - Data too long for CAN FD ---");
    try {
      const tooLongData = Array.from({ length: 65 }, (_, i) => i); // 65 bytes
      await can.send(0x888, tooLongData, false, true); // CAN FD with 65 bytes
      console.log("✗ Should have failed");
    } catch (error) {
      console.log(
        "✓ Correctly rejected too long data for CAN FD:",
        error.message
      );
    }

    // Test 7: Receive frames (if any)
    console.log("\n--- Test 7: Trying to receive frames ---");
    try {
      const frame = await can.receive(100); // 100ms timeout
      console.log("✓ Frame received:", {
        id: `0x${frame.id.toString(16)}`,
        data: frame.data,
        extended: frame.extended,
        fd: frame.fd,
        dataLength: frame.data.length,
      });
    } catch (error) {
      console.log("ℹ No frames received (timeout):", error.message);
    }

    can.close();
    console.log("\n✓ CAN FD test completed successfully!");
  } catch (error) {
    console.error("❌ CAN FD test failed:", error.message);
    if (error.message.includes("only supported on Linux")) {
      console.log("ℹ Note: This is expected on non-Linux platforms");
    }
  }
}

async function demonstrateCanFdFeatures() {
  console.log("\n=== CAN FD Features Demonstration ===");

  // CAN FD allows variable data rates and larger payloads
  const fdPayloads = [
    { name: "Minimal", size: 0 },
    { name: "Classic CAN equivalent", size: 8 },
    { name: "CAN FD short", size: 12 },
    { name: "CAN FD medium", size: 24 },
    { name: "CAN FD long", size: 48 },
    { name: "CAN FD maximum", size: 64 },
  ];

  fdPayloads.forEach((payload) => {
    const data = Array.from({ length: payload.size }, (_, i) => i % 256);
    console.log(
      `${payload.name}: ${payload.size} bytes - [${data
        .slice(0, 8)
        .join(", ")}${payload.size > 8 ? "..." : ""}]`
    );
  });

  console.log("\nCAN FD Benefits:");
  console.log("• Higher data rates (up to 8 Mbps)");
  console.log("• Larger payloads (up to 64 bytes vs 8 bytes)");
  console.log("• Better error detection");
  console.log("• Backward compatibility with classic CAN");
}

// Run the tests
async function main() {
  await testCanFd();
  await demonstrateCanFdFeatures();
}

if (require.main === module) {
  main();
}

module.exports = { testCanFd, demonstrateCanFdFeatures };
