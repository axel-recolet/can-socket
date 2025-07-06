const SocketCAN = require("../index");

/**
 * Extended ID support example
 */
async function testExtendedIds() {
  console.log("=== Extended CAN ID Support Example ===\n");

  const can = new SocketCAN("vcan0");

  try {
    await can.open();

    // Test standard IDs (11-bit)
    console.log("Testing Standard IDs (11-bit):");
    const standardIds = [0x123, 0x456, 0x7ff]; // Max standard ID

    for (const id of standardIds) {
      try {
        await can.send(id, [0x01, 0x02, 0x03, 0x04], false);
        console.log(`✓ Standard ID 0x${id.toString(16)} sent successfully`);
      } catch (error) {
        console.log(
          `✗ Standard ID 0x${id.toString(16)} failed: ${error.message}`
        );
      }
    }

    console.log("\nTesting Extended IDs (29-bit):");
    const extendedIds = [0x12345678, 0x1fffffff, 0x800]; // Including max extended ID

    for (const id of extendedIds) {
      try {
        await can.send(id, [0xaa, 0xbb, 0xcc, 0xdd], true);
        console.log(`✓ Extended ID 0x${id.toString(16)} sent successfully`);
      } catch (error) {
        console.log(
          `✗ Extended ID 0x${id.toString(16)} failed: ${error.message}`
        );
      }
    }

    // Test automatic detection
    console.log("\nTesting Automatic Extended ID Detection:");
    const autoIds = [0x123, 0x800, 0x12345678]; // Mix of standard and extended

    for (const id of autoIds) {
      try {
        await can.send(id, [0xff]);
        const isExtended = id > 0x7ff;
        console.log(
          `✓ ID 0x${id.toString(16)} sent as ${
            isExtended ? "extended" : "standard"
          }`
        );
      } catch (error) {
        console.log(`✗ ID 0x${id.toString(16)} failed: ${error.message}`);
      }
    }

    // Test validation errors
    console.log("\nTesting ID Validation:");
    const invalidIds = [
      { id: -1, extended: false, desc: "Negative standard ID" },
      { id: 0x800, extended: false, desc: "Standard ID too large" },
      { id: 0x20000000, extended: true, desc: "Extended ID too large" },
    ];

    for (const test of invalidIds) {
      try {
        await can.send(test.id, [0x12], test.extended);
        console.log(`✗ ${test.desc} should have failed`);
      } catch (error) {
        console.log(`✓ ${test.desc} correctly rejected: ${error.message}`);
      }
    }

    can.close();
    console.log("\n=== Extended ID Test Complete ===");
  } catch (error) {
    console.error("Test error:", error.message);
    console.log(
      "\nNote: This test requires a Linux environment with SocketCAN."
    );
    can.close();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testExtendedIds();
}

module.exports = testExtendedIds;
