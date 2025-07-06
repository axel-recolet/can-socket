#!/usr/bin/env ts-node

/**
 * Advanced demo showcasing all SocketCAN features:
 * - Regular CAN frames (standard and extended IDs)
 * - CAN FD frames (up to 64 bytes)
 * - Remote frames (data requests)
 * - Error frame detection
 * - Frame filtering
 * - Enhanced async API
 */

import { SocketCAN } from "./src/index";
import {
  AnyCanFrame,
  CanFrame,
  CanRemoteFrame,
  CanErrorFrame,
  CanFdFrame,
  CanFilter,
} from "./types/socketcan";

class AdvancedCANDemo {
  private socket: SocketCAN;
  private running: boolean = false;

  constructor(interfaceName: string = "vcan0") {
    this.socket = new SocketCAN(interfaceName, {
      canFd: true, // Enable CAN FD support
      defaultTimeout: 1000,
    });
  }

  /**
   * Initialize the demo
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing Advanced SocketCAN Demo\n");

    try {
      await this.socket.open();
      console.log("✅ Socket opened successfully\n");
    } catch (error) {
      console.log("⚠️  Failed to open socket (expected on non-Linux systems)");
      console.log(`   Error: ${error}\n`);
      console.log("📝 Continuing with API demonstration...\n");
    }
  }

  /**
   * Demonstrate sending various frame types
   */
  async demonstrateSending(): Promise<void> {
    console.log("📤 === SENDING DEMONSTRATIONS ===\n");

    // 1. Regular CAN frame with standard ID
    console.log("1️⃣  Sending regular CAN frame (standard ID)");
    try {
      await this.socket.send(0x123, [0x01, 0x02, 0x03, 0x04]);
      console.log("   ✅ Sent successfully\n");
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }

    // 2. CAN frame with extended ID
    console.log("2️⃣  Sending CAN frame (extended ID)");
    try {
      await this.socket.send(0x12345678, [0xaa, 0xbb, 0xcc, 0xdd], {
        extended: true,
      });
      console.log("   ✅ Sent successfully\n");
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }

    // 3. CAN FD frame with large payload
    console.log("3️⃣  Sending CAN FD frame (large payload)");
    try {
      const largeData = Array.from({ length: 32 }, (_, i) => i % 256);
      await this.socket.send(0x456, largeData, { fd: true });
      console.log("   ✅ Sent successfully\n");
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }

    // 4. Remote frame
    console.log("4️⃣  Sending remote frame");
    try {
      await this.socket.sendRemote(0x789, 8); // Request 8 bytes
      console.log("   ✅ Sent successfully\n");
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }

    // 5. Remote frame with extended ID
    console.log("5️⃣  Sending remote frame (extended ID)");
    try {
      await this.socket.sendRemote(0x1abcdef0, 4, { extended: true });
      console.log("   ✅ Sent successfully\n");
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }
  }

  /**
   * Demonstrate frame filtering
   */
  async demonstrateFiltering(): Promise<void> {
    console.log("🔍 === FILTERING DEMONSTRATIONS ===\n");

    // Create some example filters
    const filters: CanFilter[] = [
      {
        id: 0x100,
        mask: 0x700, // Match IDs 0x100-0x1FF
        extended: false,
      },
      {
        id: 0x12340000,
        mask: 0x1fff0000, // Match extended IDs 0x12340000-0x1234FFFF
        extended: true,
      },
    ];

    console.log("1️⃣  Setting CAN filters");
    try {
      await this.socket.setFilters(filters);
      console.log("   ✅ Filters set successfully");
      console.log("   📋 Active filters:");
      filters.forEach((filter, i) => {
        const idType = filter.extended ? "Extended" : "Standard";
        console.log(
          `      ${i + 1}. ${idType} ID: 0x${filter.id.toString(
            16
          )}, Mask: 0x${filter.mask.toString(16)}`
        );
      });
      console.log();
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }

    console.log("2️⃣  Clearing filters");
    try {
      await this.socket.clearFilters();
      console.log("   ✅ Filters cleared successfully\n");
    } catch (error) {
      console.log(`   ❌ Failed: ${error}\n`);
    }
  }

  /**
   * Demonstrate frame type detection and handling
   */
  demonstrateFrameDetection(): void {
    console.log("🔎 === FRAME TYPE DETECTION ===\n");

    // Create mock frames for demonstration
    const frames: AnyCanFrame[] = [
      {
        id: 0x123,
        data: [1, 2, 3, 4],
        extended: false,
        fd: false,
      },
      {
        id: 0x12345678,
        data: Array.from({ length: 16 }, (_, i) => i),
        extended: true,
        fd: true,
      } as CanFdFrame,
      {
        id: 0x456,
        data: [],
        extended: false,
        remote: true,
      } as CanRemoteFrame,
      {
        id: 0x20000000,
        data: [0xff, 0x00, 0x08, 0x00, 0x00, 0x00, 0x60, 0x00],
        extended: false,
        error: true,
      } as CanErrorFrame,
    ];

    frames.forEach((frame, index) => {
      console.log(`Frame ${index + 1}: ID 0x${frame.id.toString(16)}`);

      if (SocketCAN.isErrorFrame(frame)) {
        console.log("   🚨 ERROR FRAME detected");
        console.log(
          "   📊 Error data:",
          frame.data
            .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
            .join(" ")
        );
      } else if (SocketCAN.isRemoteFrame(frame)) {
        console.log("   📡 REMOTE FRAME detected");
        console.log("   📏 Requested DLC:", frame.data.length);
      } else if (SocketCAN.isCanFdFrame(frame)) {
        console.log("   🚀 CAN FD FRAME detected");
        console.log("   📦 Payload size:", frame.data.length, "bytes");
      } else {
        console.log("   📄 REGULAR CAN FRAME");
        console.log("   📦 Data size:", frame.data.length, "bytes");
      }

      if (frame.extended) {
        console.log("   🔢 Extended ID (29-bit)");
      } else {
        console.log("   🔢 Standard ID (11-bit)");
      }

      console.log();
    });
  }

  /**
   * Simulate receiving and processing frames
   */
  async demonstrateReceiving(): Promise<void> {
    console.log("📥 === RECEIVING DEMONSTRATION ===\n");

    console.log("⏱️  Starting frame reception (simulated timeout)...");

    try {
      // Try to receive a frame with a short timeout
      const frame = await this.socket.receive(100); // 100ms timeout
      console.log("📨 Frame received!");
      this.processReceivedFrame(frame);
    } catch (error) {
      console.log(
        "⏰ Timeout - no frames received (expected in demo environment)"
      );
      console.log(`   Error: ${error}\n`);
    }
  }

  /**
   * Process a received frame based on its type
   */
  private processReceivedFrame(frame: AnyCanFrame): void {
    console.log(`📋 Processing frame ID: 0x${frame.id.toString(16)}`);

    if (SocketCAN.isErrorFrame(frame)) {
      console.log("🚨 Error frame detected - investigating...");
      this.handleErrorFrame(frame);
    } else if (SocketCAN.isRemoteFrame(frame)) {
      console.log("📡 Remote frame detected - preparing response...");
      this.handleRemoteFrame(frame);
    } else if (SocketCAN.isCanFdFrame(frame)) {
      console.log("🚀 CAN FD frame detected - processing large payload...");
      this.handleCanFdFrame(frame);
    } else {
      console.log("📄 Regular frame detected - standard processing...");
      this.handleRegularFrame(frame);
    }
  }

  private handleErrorFrame(frame: CanErrorFrame): void {
    console.log("   🔍 Error analysis:");
    console.log(
      "   📊 Error data:",
      frame.data.map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(" ")
    );
    // In a real application, you would decode the error data
    console.log("   💡 Recommended action: Check CAN bus status\n");
  }

  private handleRemoteFrame(frame: CanRemoteFrame): void {
    console.log("   📏 Requested data length:", frame.data.length);
    console.log("   💡 Action: Send response with requested data\n");
  }

  private handleCanFdFrame(frame: CanFdFrame): void {
    console.log("   📦 Large payload size:", frame.data.length, "bytes");
    console.log("   💡 Action: Process high-bandwidth data\n");
  }

  private handleRegularFrame(frame: CanFrame): void {
    console.log(
      "   📦 Data:",
      frame.data.map((b) => `0x${b.toString(16).padStart(2, "0")}`).join(" ")
    );
    console.log("   💡 Action: Standard frame processing\n");
  }

  /**
   * Demonstrate error handling
   */
  async demonstrateErrorHandling(): Promise<void> {
    console.log("⚠️  === ERROR HANDLING DEMONSTRATIONS ===\n");

    // 1. Invalid ID
    console.log("1️⃣  Testing invalid ID validation");
    try {
      await this.socket.send(0x800, [1, 2, 3]); // Too large for standard ID
      console.log("   ❌ Should have failed!");
    } catch (error) {
      console.log(
        "   ✅ Correctly caught invalid ID:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // 2. Data too long
    console.log("\n2️⃣  Testing data length validation");
    try {
      const tooMuchData = new Array(9).fill(0xff); // 9 bytes for regular CAN
      await this.socket.send(0x123, tooMuchData);
      console.log("   ❌ Should have failed!");
    } catch (error) {
      console.log(
        "   ✅ Correctly caught data too long:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // 3. Invalid remote + FD combination
    console.log("\n3️⃣  Testing incompatible options");
    try {
      await this.socket.send(0x123, [1, 2, 3], { fd: true, remote: true });
      console.log("   ❌ Should have failed!");
    } catch (error) {
      console.log(
        "   ✅ Correctly caught incompatible options:",
        error instanceof Error ? error.message : String(error)
      );
    }

    console.log();
  }

  /**
   * Run the complete demo
   */
  async run(): Promise<void> {
    try {
      await this.initialize();
      await this.demonstrateSending();
      await this.demonstrateFiltering();
      this.demonstrateFrameDetection();
      await this.demonstrateReceiving();
      await this.demonstrateErrorHandling();

      console.log("🎉 === DEMO COMPLETE ===");
      console.log("✨ All SocketCAN features demonstrated successfully!\n");
    } catch (error) {
      console.error("❌ Demo failed:", error);
    } finally {
      try {
        await this.socket.close();
        console.log("🔒 Socket closed cleanly");
      } catch (error) {
        console.log("⚠️  Error closing socket:", error);
      }
    }
  }
}

// Run the demo
if (require.main === module) {
  const demo = new AdvancedCANDemo();
  demo.run().catch(console.error);
}

export { AdvancedCANDemo };
