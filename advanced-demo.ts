import {
  SocketCAN,
  SocketCANUtils,
  SocketCANError,
  CAN_CONSTANTS,
} from "./src/index";

/**
 * Advanced features demonstration
 */
async function demonstrateAdvancedFeatures(): Promise<void> {
  console.log("=== Advanced SocketCAN Features Demo ===\n");

  const can = new SocketCAN("vcan0");

  try {
    await can.open();

    // 1. Demonstrate extended ID utilities
    console.log("1. Extended ID Utilities:");

    const standardId = SocketCANUtils.createStandardId(0x123);
    const extendedId = SocketCANUtils.createExtendedId(0x12345678);

    console.log(`Standard ID: ${JSON.stringify(standardId)}`);
    console.log(`Extended ID: ${JSON.stringify(extendedId)}`);
    console.log(`Is 0x800 extended? ${SocketCANUtils.isExtendedId(0x800)}`);
    console.log(`Is 0x123 extended? ${SocketCANUtils.isExtendedId(0x123)}`);

    // 2. Test frame formatting and parsing
    console.log("\n2. Frame Formatting and Parsing:");

    const testFrames = [
      { id: 0x123, data: [0xde, 0xad, 0xbe, 0xef] },
      { id: 0x12345678, data: [0x01, 0x02, 0x03], extended: true },
    ];

    for (const frame of testFrames) {
      const formatted = SocketCANUtils.formatCanFrame(frame);
      console.log(`Frame: ${JSON.stringify(frame)} -> ${formatted}`);

      try {
        const parsed = SocketCANUtils.parseCanFrame(formatted);
        console.log(`Parsed back: ${JSON.stringify(parsed)}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.log(`Parse error: ${err.message}`);
      }
    }

    // 3. Generate random frames
    console.log("\n3. Random Frame Generation:");

    for (let i = 0; i < 3; i++) {
      const randomFrame = SocketCANUtils.createRandomFrame({
        extended: i === 2, // Last one is extended
        dataLength: Math.min(i + 1, 8),
      });
      console.log(
        `Random frame ${i + 1}: ${SocketCANUtils.formatCanFrame(randomFrame)}`
      );
    }

    // 4. Advanced ID formatting
    console.log("\n4. Advanced ID Formatting:");

    const testIds = [0x123, 0x800, 0x12345678, 0x1fffffff];
    for (const id of testIds) {
      console.log(`ID ${id}: ${SocketCANUtils.formatCanId(id)}`);
    }

    // 5. Test data conversion utilities
    console.log("\n5. Data Conversion:");

    const testNumber = 0x12345678;
    const bytes4 = SocketCANUtils.numberToBytes(testNumber, 4);
    const bytes8 = SocketCANUtils.numberToBytes(testNumber, 8);

    console.log(
      `Number 0x${testNumber.toString(16)} -> 4 bytes: [${bytes4
        .map((b) => `0x${b.toString(16)}`)
        .join(", ")}]`
    );
    console.log(
      `Number 0x${testNumber.toString(16)} -> 8 bytes: [${bytes8
        .map((b) => `0x${b.toString(16)}`)
        .join(", ")}]`
    );

    const backToNumber = SocketCANUtils.bytesToNumber(bytes4);
    console.log(`Back to number: 0x${backToNumber.toString(16)}`);

    // 6. Test sending with different ID types
    console.log("\n6. Sending with Different ID Types:");

    try {
      // Standard ID as object
      await can.send(standardId, [0x01, 0x02]);
      console.log("✓ Standard ID object sent");
    } catch (error) {
      if (error instanceof SocketCANError) {
        console.log(`Standard ID error [${error.code}]: ${error.message}`);
      }
    }

    try {
      // Extended ID as object
      await can.send(extendedId, [0x03, 0x04]);
      console.log("✓ Extended ID object sent");
    } catch (error) {
      if (error instanceof SocketCANError) {
        console.log(`Extended ID error [${error.code}]: ${error.message}`);
      }
    }

    try {
      // Automatic detection
      await can.send(0x12345678, [0x05, 0x06]);
      console.log("✓ Auto-detected extended ID sent");
    } catch (error) {
      if (error instanceof SocketCANError) {
        console.log(`Auto-detection error [${error.code}]: ${error.message}`);
      }
    }

    // 7. Test error handling
    console.log("\n7. Error Handling:");

    const errorTests = [
      { id: -1, data: [0x01], desc: "Negative ID" },
      {
        id: 0x800,
        data: [0x01],
        options: { extended: false },
        desc: "Standard ID too large",
      },
      {
        id: 0x20000000,
        data: [0x01],
        options: { extended: true },
        desc: "Extended ID too large",
      },
      { id: 0x123, data: new Array(9).fill(0xff), desc: "Data too long" },
    ];

    for (const test of errorTests) {
      try {
        await can.send(test.id, test.data, test.options);
        console.log(`✗ ${test.desc} should have failed`);
      } catch (error) {
        if (error instanceof SocketCANError) {
          console.log(
            `✓ ${test.desc} correctly rejected [${error.code}]: ${error.message}`
          );
        }
      }
    }

    can.close();
    console.log("\n=== Advanced Features Demo Complete ===");
  } catch (error) {
    if (error instanceof SocketCANError) {
      console.error(`SocketCAN Error [${error.code}]: ${error.message}`);
    } else {
      console.error(
        "Unexpected error:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    console.log(
      "\nNote: This demo requires a Linux environment with SocketCAN."
    );
    can.close();
  }
}

// Run if executed directly
if (require.main === module) {
  demonstrateAdvancedFeatures().catch(console.error);
}

export { demonstrateAdvancedFeatures };
