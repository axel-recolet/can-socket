#!/usr/bin/env node

/**
 * Test script for CAN frame filtering support
 * This script demonstrates selective frame reception using CAN filters.
 */

const SocketCAN = require("../index.js");

async function testCanFilters() {
  console.log("=== CAN Frame Filtering Test ===");

  try {
    // Create a CAN socket
    const can = new SocketCAN("vcan0");
    console.log("1. Creating CAN socket...");

    // Open the socket
    await can.open();
    console.log("2. CAN socket opened successfully");

    // Test 1: Set a single filter for standard ID
    console.log("\n--- Test 1: Single standard ID filter ---");
    const standardFilter = [
      { id: 0x123, mask: 0x7ff }, // Accept only frames with ID 0x123
    ];
    await can.setFilters(standardFilter);
    console.log("✓ Standard ID filter set (ID: 0x123, mask: 0x7FF)");

    // Test 2: Set multiple filters
    console.log("\n--- Test 2: Multiple filters ---");
    const multipleFilters = [
      { id: 0x100, mask: 0x700 }, // Accept IDs 0x100-0x1FF (mask filters upper bits)
      { id: 0x200, mask: 0x7f0 }, // Accept IDs 0x200-0x20F
      { id: 0x456, mask: 0x7ff }, // Accept only ID 0x456
    ];
    await can.setFilters(multipleFilters);
    console.log("✓ Multiple filters set successfully");

    // Test 3: Extended ID filter
    console.log("\n--- Test 3: Extended ID filter ---");
    const extendedFilter = [
      { id: 0x12345678, mask: 0x1fffffff, extended: true }, // Accept only this extended ID
    ];
    await can.setFilters(extendedFilter);
    console.log("✓ Extended ID filter set (ID: 0x12345678)");

    // Test 4: Mixed standard and extended filters
    console.log("\n--- Test 4: Mixed ID type filters ---");
    const mixedFilters = [
      { id: 0x123, mask: 0x7ff, extended: false }, // Standard ID
      { id: 0x12340000, mask: 0x1fff0000, extended: true }, // Extended ID range
    ];
    await can.setFilters(mixedFilters);
    console.log("✓ Mixed ID type filters set successfully");

    // Test 5: Range filter using mask
    console.log("\n--- Test 5: Range filter with mask ---");
    const rangeFilter = [
      { id: 0x100, mask: 0x700 }, // Accept IDs 0x100-0x1FF (100 in binary: 000100000000, mask filters bits 8-10)
    ];
    await can.setFilters(rangeFilter);
    console.log("✓ Range filter set (accepts IDs 0x100-0x1FF)");

    // Demonstrate filter logic
    console.log("\nFilter Logic Explanation:");
    console.log("ID 0x100 = 0001 0000 0000 (binary)");
    console.log("Mask 0x700 = 0111 0000 0000 (binary)");
    console.log(
      "This filter accepts any ID where (ID & mask) == (filter_id & mask)"
    );
    console.log("Range: 0x100-0x1FF will match this filter");

    // Test 6: Clear filters
    console.log("\n--- Test 6: Clear all filters ---");
    await can.clearFilters();
    console.log("✓ All filters cleared (will now receive all frames)");

    // Test 7: Error handling - Invalid filter ID
    console.log("\n--- Test 7: Error handling - Invalid filter ID ---");
    try {
      const invalidFilter = [
        { id: 0x800, mask: 0x7ff, extended: false }, // Standard ID too large
      ];
      await can.setFilters(invalidFilter);
      console.log("✗ Should have failed");
    } catch (error) {
      console.log("✓ Correctly rejected invalid standard ID:", error.message);
    }

    // Test 8: Error handling - Invalid extended filter ID
    console.log(
      "\n--- Test 8: Error handling - Invalid extended filter ID ---"
    );
    try {
      const invalidExtFilter = [
        { id: 0x20000000, mask: 0x1fffffff, extended: true }, // Extended ID too large
      ];
      await can.setFilters(invalidExtFilter);
      console.log("✗ Should have failed");
    } catch (error) {
      console.log("✓ Correctly rejected invalid extended ID:", error.message);
    }

    // Test 9: Practical example - ECU filtering
    console.log("\n--- Test 9: Practical ECU filtering example ---");
    const ecuFilters = [
      { id: 0x7e0, mask: 0x7f8 }, // OBD-II diagnostic request range (0x7E0-0x7E7)
      { id: 0x7e8, mask: 0x7f8 }, // OBD-II diagnostic response range (0x7E8-0x7EF)
      { id: 0x100, mask: 0x7f0 }, // Engine data range (0x100-0x10F)
      { id: 0x200, mask: 0x7f0 }, // Transmission data range (0x200-0x20F)
    ];
    await can.setFilters(ecuFilters);
    console.log("✓ ECU-specific filters set for automotive diagnostics");

    // Test 10: Attempt to receive frames (if any)
    console.log("\n--- Test 10: Frame reception with filters ---");
    try {
      const frame = await can.receive(100); // 100ms timeout
      console.log("✓ Frame received (passed filter):", {
        id: `0x${frame.id.toString(16)}`,
        data: frame.data,
        extended: frame.extended,
      });
    } catch (error) {
      console.log("ℹ No frames received (timeout or platform limitation)");
    }

    can.close();
    console.log("\n✓ CAN filtering test completed successfully!");
  } catch (error) {
    console.error("❌ CAN filtering test failed:", error.message);
    if (error.message.includes("only supported on Linux")) {
      console.log("ℹ Note: This is expected on non-Linux platforms");
    }
  }
}

async function demonstrateFilterConcepts() {
  console.log("\n=== CAN Filter Concepts ===");

  console.log("\n1. Basic Filter Operation:");
  console.log("   Frame ID & Mask == Filter ID & Mask");
  console.log("   Example: Frame 0x123 with filter {id: 0x120, mask: 0x7F0}");
  console.log("   0x123 & 0x7F0 = 0x120, 0x120 & 0x7F0 = 0x120 → MATCH");

  console.log("\n2. Range Filtering:");
  console.log("   Filter: {id: 0x100, mask: 0x700}");
  console.log("   Accepts: 0x100-0x1FF (any ID with bits 8-10 = 001)");

  console.log("\n3. Exact ID Filtering:");
  console.log("   Filter: {id: 0x123, mask: 0x7FF}");
  console.log("   Accepts: Only 0x123 (all bits must match)");

  console.log("\n4. Multiple Filters:");
  console.log("   Multiple filters act as OR logic");
  console.log("   Frame passes if it matches ANY filter");

  console.log("\n5. Common Use Cases:");
  console.log(
    "   • ECU-specific filtering: Only receive frames from specific modules"
  );
  console.log("   • Protocol filtering: Only OBD-II, J1939, etc.");
  console.log("   • Performance: Reduce CPU load by filtering at kernel level");
  console.log("   • Diagnostics: Monitor specific CAN ID ranges");
}

// Run the tests
async function main() {
  await testCanFilters();
  await demonstrateFilterConcepts();
}

if (require.main === module) {
  main();
}

module.exports = { testCanFilters, demonstrateFilterConcepts };
