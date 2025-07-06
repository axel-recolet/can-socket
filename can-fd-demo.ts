import { SocketCAN } from "./src/index";
import { CanFdFrame, CanFrame, AnyCanFrame } from "./types/socketcan";

/**
 * Advanced CAN FD demonstration using TypeScript
 */
class CanFdDemo {
  private can: SocketCAN;

  constructor(interfaceName: string = "vcan0") {
    // Create CAN FD socket
    this.can = new SocketCAN(interfaceName, {
      canFd: true,
      defaultTimeout: 1000,
    });
  }

  /**
   * Demonstrate CAN FD frame sending with various payload sizes
   */
  async demonstratePayloadSizes(): Promise<void> {
    console.log("=== CAN FD Payload Size Demonstration ===");

    const payloadSizes = [0, 1, 8, 12, 16, 20, 24, 32, 48, 64];

    for (const size of payloadSizes) {
      const data = Array.from({ length: size }, (_, i) => (i * 3) % 256);

      try {
        await this.can.send(0x100 + size, data, { fd: true });
        console.log(`✓ Sent CAN FD frame with ${size} bytes`);
      } catch (error) {
        console.error(`✗ Failed to send ${size} byte frame:`, error);
      }
    }
  }

  /**
   * Demonstrate mixed CAN and CAN FD frame transmission
   */
  async demonstrateMixedFrames(): Promise<void> {
    console.log("\n=== Mixed CAN/CAN FD Frame Demonstration ===");

    const frames = [
      {
        id: 0x123,
        data: [1, 2, 3, 4],
        fd: false,
        description: "Regular CAN frame",
      },
      {
        id: 0x456,
        data: Array.from({ length: 16 }, (_, i) => i),
        fd: true,
        description: "CAN FD frame (16 bytes)",
      },
      {
        id: 0x12345678,
        data: [0xaa, 0xbb, 0xcc, 0xdd],
        fd: false,
        extended: true,
        description: "Regular CAN with extended ID",
      },
      {
        id: 0x1fedcba9,
        data: Array.from({ length: 32 }, (_, i) => i * 2),
        fd: true,
        extended: true,
        description: "CAN FD with extended ID (32 bytes)",
      },
    ];

    for (const frame of frames) {
      try {
        await this.can.send(frame.id, frame.data, {
          extended: frame.extended,
          fd: frame.fd,
        });
        console.log(`✓ ${frame.description}`);
      } catch (error) {
        console.error(`✗ Failed to send ${frame.description}:`, error);
      }
    }
  }

  /**
   * Demonstrate frame reception and type detection
   */
  async demonstrateReception(): Promise<void> {
    console.log("\n=== Frame Reception Demonstration ===");

    try {
      const frame: AnyCanFrame = await this.can.receive(100);

      this.analyzeFrame(frame);
    } catch (error) {
      console.log("ℹ No frames received within timeout");
    }
  }

  /**
   * Analyze and display frame information
   */
  private analyzeFrame(frame: AnyCanFrame): void {
    const frameType = this.isCanFdFrame(frame) ? "CAN FD" : "CAN";
    const idType = frame.extended ? "Extended" : "Standard";

    console.log(`📨 Received ${frameType} frame:`);
    console.log(`   ID: 0x${frame.id.toString(16)} (${idType})`);
    console.log(`   Data Length: ${frame.data.length} bytes`);
    console.log(
      `   Data: [${frame.data
        .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
        .join(", ")}]`
    );

    if (this.isCanFdFrame(frame)) {
      console.log(`   CAN FD Features: Higher bandwidth, larger payload`);
    }
  }

  /**
   * Type guard to check if frame is CAN FD
   */
  private isCanFdFrame(frame: AnyCanFrame): frame is CanFdFrame {
    return "fd" in frame && frame.fd === true;
  }

  /**
   * Demonstrate CAN FD data encoding patterns
   */
  async demonstrateDataPatterns(): Promise<void> {
    console.log("\n=== CAN FD Data Pattern Demonstration ===");

    const patterns = [
      {
        name: "Incremental",
        generator: (size: number) =>
          Array.from({ length: size }, (_, i) => i % 256),
      },
      {
        name: "Alternating",
        generator: (size: number) =>
          Array.from({ length: size }, (_, i) => (i % 2 ? 0xaa : 0x55)),
      },
      {
        name: "Powers of 2",
        generator: (size: number) =>
          Array.from({ length: size }, (_, i) => (1 << i % 8) % 256),
      },
      {
        name: "Random-like",
        generator: (size: number) =>
          Array.from({ length: size }, (_, i) => (i * 7 + 13) % 256),
      },
    ];

    for (const pattern of patterns) {
      const size = 24; // Medium CAN FD frame
      const data = pattern.generator(size);

      try {
        await this.can.send(0x200, data, { fd: true });
        console.log(
          `✓ Sent ${pattern.name} pattern (${size} bytes): [${data
            .slice(0, 8)
            .map((b) => `0x${b.toString(16)}`)
            .join(", ")}...]`
        );
      } catch (error) {
        console.error(`✗ Failed to send ${pattern.name} pattern:`, error);
      }
    }
  }

  /**
   * Run all demonstrations
   */
  async runDemo(): Promise<void> {
    try {
      console.log("🚀 Starting CAN FD Advanced Demo");

      await this.can.open();
      console.log("✓ CAN FD socket opened");

      await this.demonstratePayloadSizes();
      await this.demonstrateMixedFrames();
      await this.demonstrateDataPatterns();
      await this.demonstrateReception();

      this.can.close();
      console.log("\n✅ CAN FD demo completed successfully!");
    } catch (error) {
      console.error("❌ CAN FD demo failed:", error);

      if (
        error instanceof Error &&
        error.message.includes("only supported on Linux")
      ) {
        console.log(
          "ℹ Note: CAN FD is only available on Linux with proper kernel support"
        );
      }
    }
  }

  /**
   * Display CAN FD capabilities summary
   */
  static displayCapabilities(): void {
    console.log("\n📊 CAN FD Capabilities Summary:");
    console.log("┌─────────────────────────────────────────────┐");
    console.log("│ Feature               │ CAN 2.0 │ CAN FD   │");
    console.log("├─────────────────────────────────────────────┤");
    console.log("│ Max Data Length       │ 8 bytes │ 64 bytes │");
    console.log("│ Data Rate             │ 1 Mbps  │ 8+ Mbps  │");
    console.log("│ ID Length             │ 11/29   │ 11/29    │");
    console.log("│ Error Detection       │ Good    │ Better   │");
    console.log("│ Backward Compatibility│ N/A     │ Yes      │");
    console.log("└─────────────────────────────────────────────┘");
  }
}

// Run the demo if this file is executed directly
async function main(): Promise<void> {
  CanFdDemo.displayCapabilities();

  const demo = new CanFdDemo("vcan0");
  await demo.runDemo();
}

if (require.main === module) {
  main().catch(console.error);
}

export { CanFdDemo };
