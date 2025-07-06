import { SocketCAN } from "./src/index";
import { CanFilter } from "./types/socketcan";

/**
 * Advanced CAN filtering demonstration using TypeScript
 */
class CanFilterDemo {
  private can: SocketCAN;

  constructor(interfaceName: string = "vcan0") {
    this.can = new SocketCAN(interfaceName, {
      defaultTimeout: 1000,
    });
  }

  /**
   * Demonstrate basic CAN filtering concepts
   */
  async demonstrateBasicFiltering(): Promise<void> {
    console.log("=== Basic CAN Filtering ===");

    // Single exact ID filter
    const exactFilter: CanFilter[] = [
      { id: 0x123, mask: 0x7ff }, // Accept only ID 0x123
    ];

    await this.can.setFilters(exactFilter);
    console.log("✓ Set exact ID filter (0x123)");

    // Range filter using mask
    const rangeFilter: CanFilter[] = [
      { id: 0x100, mask: 0x700 }, // Accept IDs 0x100-0x1FF
    ];

    await this.can.setFilters(rangeFilter);
    console.log("✓ Set range filter (0x100-0x1FF)");
  }

  /**
   * Demonstrate automotive-specific filtering patterns
   */
  async demonstrateAutomotiveFiltering(): Promise<void> {
    console.log("\n=== Automotive CAN Filtering ===");

    // OBD-II diagnostic filtering
    const obdFilters: CanFilter[] = [
      { id: 0x7e0, mask: 0x7f8 }, // Diagnostic requests (0x7E0-0x7E7)
      { id: 0x7e8, mask: 0x7f8 }, // Diagnostic responses (0x7E8-0x7EF)
    ];

    await this.can.setFilters(obdFilters);
    console.log("✓ Set OBD-II diagnostic filters");

    // J1939 filtering (heavy-duty vehicles)
    const j1939Filters: CanFilter[] = [
      { id: 0x18fef100, mask: 0x1ffffff00, extended: true }, // Engine data
      { id: 0x18fef200, mask: 0x1ffffff00, extended: true }, // Transmission data
    ];

    await this.can.setFilters(j1939Filters);
    console.log("✓ Set J1939 vehicle filters");
  }

  /**
   * Demonstrate multi-ECU filtering
   */
  async demonstrateMultiEcuFiltering(): Promise<void> {
    console.log("\n=== Multi-ECU Filtering ===");

    const ecuFilters: CanFilter[] = [
      // Engine Control Unit
      { id: 0x100, mask: 0x7f0 }, // Engine data (0x100-0x10F)

      // Transmission Control Unit
      { id: 0x200, mask: 0x7f0 }, // Transmission data (0x200-0x20F)

      // Body Control Module
      { id: 0x300, mask: 0x7f0 }, // Body systems (0x300-0x30F)

      // Anti-lock Braking System
      { id: 0x400, mask: 0x7f0 }, // ABS data (0x400-0x40F)

      // Airbag Control Unit
      { id: 0x500, mask: 0x7f0 }, // Airbag data (0x500-0x50F)
    ];

    await this.can.setFilters(ecuFilters);
    console.log("✓ Set multi-ECU filters for comprehensive vehicle monitoring");
  }

  /**
   * Demonstrate advanced filtering techniques
   */
  async demonstrateAdvancedFiltering(): Promise<void> {
    console.log("\n=== Advanced Filtering Techniques ===");

    // Priority-based filtering
    const priorityFilters: CanFilter[] = [
      // High priority (safety-critical)
      { id: 0x000, mask: 0x700 }, // Emergency systems (0x000-0x0FF)

      // Medium priority (control systems)
      { id: 0x100, mask: 0x600 }, // Control data (0x100-0x1FF)

      // Low priority (comfort/info)
      { id: 0x600, mask: 0x600 }, // Information systems (0x600-0x7FF)
    ];

    await this.can.setFilters(priorityFilters);
    console.log("✓ Set priority-based filters");

    // Protocol-specific filtering
    const protocolFilters: CanFilter[] = [
      // ISO-TP (Transport Protocol)
      { id: 0x7e0, mask: 0x7f0 }, // ISO-TP range

      // Custom application protocol
      { id: 0x200, mask: 0x700 }, // Application-specific range

      // Network management
      { id: 0x7ff, mask: 0x7ff }, // Network management frame
    ];

    await this.can.setFilters(protocolFilters);
    console.log("✓ Set protocol-specific filters");
  }

  /**
   * Demonstrate filter validation and error handling
   */
  async demonstrateFilterValidation(): Promise<void> {
    console.log("\n=== Filter Validation ===");

    // Test invalid standard ID
    try {
      const invalidStandardFilter: CanFilter[] = [
        { id: 0x800, mask: 0x7ff, extended: false }, // Too large for standard
      ];
      await this.can.setFilters(invalidStandardFilter);
      console.log("✗ Should have failed");
    } catch (error) {
      console.log("✓ Caught invalid standard ID:", error.message);
    }

    // Test invalid extended ID
    try {
      const invalidExtendedFilter: CanFilter[] = [
        { id: 0x20000000, mask: 0x1fffffff, extended: true }, // Too large for extended
      ];
      await this.can.setFilters(invalidExtendedFilter);
      console.log("✗ Should have failed");
    } catch (error) {
      console.log("✓ Caught invalid extended ID:", error.message);
    }

    // Test valid complex filter
    const validComplexFilter: CanFilter[] = [
      { id: 0x123, mask: 0x7ff, extended: false },
      { id: 0x12345678, mask: 0x1ffffff0, extended: true },
    ];
    await this.can.setFilters(validComplexFilter);
    console.log("✓ Complex filter validation passed");
  }

  /**
   * Demonstrate frame reception with filtering
   */
  async demonstrateFilteredReception(): Promise<void> {
    console.log("\n=== Filtered Frame Reception ===");

    // Set up a specific filter
    const testFilter: CanFilter[] = [
      { id: 0x123, mask: 0x7ff }, // Only accept frames with ID 0x123
    ];

    await this.can.setFilters(testFilter);
    console.log("✓ Filter set for ID 0x123");

    // Try to receive frames
    try {
      const frame = await this.can.receive(100);
      console.log("📨 Filtered frame received:", {
        id: `0x${frame.id.toString(16)}`,
        data: frame.data.map((b) => `0x${b.toString(16).padStart(2, "0")}`),
        extended: frame.extended,
        fd: frame.fd,
      });
    } catch (error) {
      console.log(
        "ℹ No matching frames received (expected on test environment)"
      );
    }

    // Clear filters to receive all frames
    await this.can.clearFilters();
    console.log("✓ All filters cleared");
  }

  /**
   * Run all filter demonstrations
   */
  async runDemo(): Promise<void> {
    try {
      console.log("🚀 Starting CAN Filter Advanced Demo");

      await this.can.open();
      console.log("✓ CAN socket opened");

      await this.demonstrateBasicFiltering();
      await this.demonstrateAutomotiveFiltering();
      await this.demonstrateMultiEcuFiltering();
      await this.demonstrateAdvancedFiltering();
      await this.demonstrateFilterValidation();
      await this.demonstrateFilteredReception();

      this.can.close();
      console.log("\n✅ CAN filter demo completed successfully!");
    } catch (error) {
      console.error("❌ CAN filter demo failed:", error);

      if (
        error instanceof Error &&
        error.message.includes("only supported on Linux")
      ) {
        console.log(
          "ℹ Note: CAN filtering is only available on Linux with proper kernel support"
        );
      }
    }
  }

  /**
   * Display filter concepts summary
   */
  static displayFilterConcepts(): void {
    console.log("\n📊 CAN Filter Concepts Summary:");
    console.log("┌─────────────────────────────────────────────────────────┐");
    console.log("│ Filter Type       │ Example                │ Use Case    │");
    console.log("├─────────────────────────────────────────────────────────┤");
    console.log(
      "│ Exact ID          │ {id: 0x123, mask: 0x7FF} │ Specific   │"
    );
    console.log(
      "│ Range             │ {id: 0x100, mask: 0x700} │ ECU Range  │"
    );
    console.log(
      "│ Protocol          │ {id: 0x7E0, mask: 0x7F8} │ OBD-II     │"
    );
    console.log(
      "│ Priority          │ {id: 0x000, mask: 0x700} │ Safety     │"
    );
    console.log(
      "│ Extended Range    │ {id: 0x1234000, ...}     │ J1939      │"
    );
    console.log("└─────────────────────────────────────────────────────────┘");

    console.log("\n💡 Filter Benefits:");
    console.log("• Reduce CPU load by filtering at kernel level");
    console.log("• Selective monitoring of specific ECUs/protocols");
    console.log("• Improved real-time performance");
    console.log("• Simplified application logic");
    console.log("• Better diagnostics and debugging");
  }
}

// Run the demo if this file is executed directly
async function main(): Promise<void> {
  CanFilterDemo.displayFilterConcepts();

  const demo = new CanFilterDemo("vcan0");
  await demo.runDemo();
}

if (require.main === module) {
  main().catch(console.error);
}

export { CanFilterDemo };
