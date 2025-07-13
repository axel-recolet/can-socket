/**
 * Performance benchmarks for TypeScript SocketCAN wrapper
 * Compares performance with native Rust implementation
 */

import { SocketCAN } from "../src/socketcan";

interface BenchmarkResult {
  name: string;
  duration: number;
  frameCount: number;
  framesPerSecond: number;
  efficiency: number;
  success: boolean;
}

class SocketCANBenchmark {
  private interface: string = "vcan_ts_bench";
  private results: BenchmarkResult[] = [];

  constructor() {
    console.log("🧪 Starting TypeScript SocketCAN Benchmarks");
  }

  private async setupInterface(): Promise<void> {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    try {
      // Nettoyer l'interface existante
      await execAsync(
        `sudo ip link delete ${this.interface} 2>/dev/null || true`
      );

      // Créer l'interface
      await execAsync(`sudo ip link add dev ${this.interface} type vcan`);
      await execAsync(`sudo ip link set up ${this.interface}`);

      console.log(`✅ Interface ${this.interface} created and activated`);
    } catch (error) {
      console.error("❌ Failed to setup interface:", error);
      throw error;
    }
  }

  private async cleanupInterface(): Promise<void> {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);

    try {
      await execAsync(
        `sudo ip link delete ${this.interface} 2>/dev/null || true`
      );
      console.log(`🧹 Interface ${this.interface} cleaned up`);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  private recordResult(result: BenchmarkResult): void {
    this.results.push(result);
    console.log(`📊 ${result.name}:`);
    console.log(`   Duration: ${result.duration.toFixed(2)}ms`);
    console.log(`   Frames: ${result.frameCount}`);
    console.log(
      `   Throughput: ${result.framesPerSecond.toFixed(2)} frames/sec`
    );
    console.log(`   Efficiency: ${result.efficiency.toFixed(1)}%`);
    console.log(`   Status: ${result.success ? "✅ PASS" : "❌ FAIL"}`);
    console.log("");
  }

  /**
   * Benchmark unidirectional throughput (send only)
   */
  async benchmarkSendThroughput(): Promise<BenchmarkResult> {
    const frameCount = 1000;
    const testData = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];

    const sender = new SocketCAN(this.interface);
    await sender.open();

    try {
      const start = Date.now();

      for (let i = 0; i < frameCount; i++) {
        await sender.send(0x100 + (i % 100), testData);
      }

      const duration = Date.now() - start;
      const framesPerSecond = (frameCount / duration) * 1000;

      const result: BenchmarkResult = {
        name: "TypeScript Send Throughput",
        duration,
        frameCount,
        framesPerSecond,
        efficiency: 100, // All frames sent
        success: framesPerSecond > 100, // Minimum acceptable performance
      };

      await sender.close();
      return result;
    } catch (error) {
      await sender.close();
      throw error;
    }
  }

  /**
   * Benchmark bidirectional communication
   */
  async benchmarkBidirectional(): Promise<BenchmarkResult> {
    const frameCount = 500;
    const testData = [0xaa, 0xbb, 0xcc, 0xdd];

    const nodeA = new SocketCAN(this.interface);
    const nodeB = new SocketCAN(this.interface);

    await nodeA.open();
    await nodeB.open();

    try {
      const start = Date.now();

      // Setup frame collection
      const receivedA: any[] = [];
      const receivedB: any[] = [];

      nodeA.on("frame", (frame) => {
        if (frame.id >= 0x200 && frame.id < 0x200 + frameCount) {
          receivedA.push(frame);
        }
      });

      nodeB.on("frame", (frame) => {
        if (frame.id >= 0x100 && frame.id < 0x100 + frameCount) {
          receivedB.push(frame);
        }
      });

      // Send frames concurrently
      const sendPromises: Promise<void>[] = [];

      // Node A sends to Node B
      for (let i = 0; i < frameCount; i++) {
        const promise = nodeA.send(0x100 + i, testData).then(() => {
          // Small delay to avoid overwhelming
          return new Promise<void>((resolve) => setTimeout(resolve, 0.2));
        });
        sendPromises.push(promise);
      }

      // Node B sends to Node A
      for (let i = 0; i < frameCount; i++) {
        const promise = nodeB.send(0x200 + i, testData).then(() => {
          return new Promise<void>((resolve) => setTimeout(resolve, 0.2));
        });
        sendPromises.push(promise);
      }

      // Wait for all sends
      await Promise.all(sendPromises); // Wait a bit for reception
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));

      const duration = Date.now() - start;
      const totalSent = frameCount * 2;
      const totalReceived = receivedA.length + receivedB.length;
      const framesPerSecond = (totalSent / duration) * 1000;
      const efficiency = (totalReceived / totalSent) * 100;

      const result: BenchmarkResult = {
        name: "TypeScript Bidirectional",
        duration,
        frameCount: totalSent,
        framesPerSecond,
        efficiency,
        success: efficiency > 80, // At least 80% efficiency
      };

      await nodeA.close();
      await nodeB.close();
      return result;
    } catch (error) {
      await nodeA.close();
      await nodeB.close();
      throw error;
    }
  }

  /**
   * Benchmark async iterator performance
   */
  async benchmarkAsyncIterator(): Promise<BenchmarkResult> {
    const frameCount = 200;
    const testData = [0x11, 0x22, 0x33, 0x44];

    const sender = new SocketCAN(this.interface);
    const receiver = new SocketCAN(this.interface);

    await sender.open();
    await receiver.open();

    try {
      const start = Date.now();
      let received = 0;

      // Start async iteration
      const iteratorPromise = (async () => {
        for await (const frame of receiver.frames({ timeout: 5000 })) {
          if (frame.id >= 0x300 && frame.id < 0x300 + frameCount) {
            received++;
            if (received >= frameCount) break;
          }
        }
      })();

      // Send frames after a small delay
      setTimeout(async () => {
        for (let i = 0; i < frameCount; i++) {
          await sender.send(0x300 + i, testData);
          if (i % 10 === 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, 1));
          }
        }
      }, 100);

      await iteratorPromise;

      const duration = Date.now() - start;
      const framesPerSecond = (received / duration) * 1000;
      const efficiency = (received / frameCount) * 100;

      const result: BenchmarkResult = {
        name: "TypeScript Async Iterator",
        duration,
        frameCount: received,
        framesPerSecond,
        efficiency,
        success: efficiency > 90 && received === frameCount,
      };

      await sender.close();
      await receiver.close();
      return result;
    } catch (error) {
      await sender.close();
      await receiver.close();
      throw error;
    }
  }

  /**
   * Benchmark filter performance
   */
  async benchmarkFilters(): Promise<BenchmarkResult> {
    const frameCount = 100;
    const testData = [0x55, 0x66];

    const sender = new SocketCAN(this.interface);
    const receiver = new SocketCAN(this.interface);

    await sender.open();
    await receiver.open();

    try {
      // Set restrictive filter (only accept ID 0x150)
      await receiver.setFilters([{ id: 0x150, mask: 0x7ff }]);

      const start = Date.now();

      // Send frames with different IDs
      let sentFiltered = 0;
      for (let i = 0; i < frameCount; i++) {
        const id = 0x100 + i;
        await sender.send(id, testData);
        if (id === 0x150) sentFiltered++;
      }

      // Collect received frames
      const received = await receiver.collectFrames({
        maxFrames: sentFiltered,
        timeout: 2000,
      });

      const duration = Date.now() - start;
      const framesPerSecond = (frameCount / duration) * 1000;
      const efficiency = (received.length / sentFiltered) * 100;

      const result: BenchmarkResult = {
        name: "TypeScript Filter Performance",
        duration,
        frameCount: received.length,
        framesPerSecond,
        efficiency,
        success: received.length === sentFiltered && received.length > 0,
      };

      await sender.close();
      await receiver.close();
      return result;
    } catch (error) {
      await sender.close();
      await receiver.close();
      throw error;
    }
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks(): Promise<void> {
    if (process.platform !== "linux") {
      console.log("⚠️  Skipping benchmarks: Not running on Linux");
      return;
    }

    try {
      await this.setupInterface();

      // Run all benchmarks
      console.log("🚀 Running TypeScript SocketCAN Performance Benchmarks\n");

      const sendResult = await this.benchmarkSendThroughput();
      this.recordResult(sendResult);

      const bidirResult = await this.benchmarkBidirectional();
      this.recordResult(bidirResult);

      const iteratorResult = await this.benchmarkAsyncIterator();
      this.recordResult(iteratorResult);

      const filterResult = await this.benchmarkFilters();
      this.recordResult(filterResult);

      // Summary
      this.printSummary();
    } catch (error) {
      console.error("❌ Benchmark failed:", error);
    } finally {
      await this.cleanupInterface();
    }
  }

  private printSummary(): void {
    console.log("📈 BENCHMARK SUMMARY");
    console.log("=".repeat(50));

    const passed = this.results.filter((r) => r.success).length;
    const total = this.results.length;

    console.log(`Overall: ${passed}/${total} benchmarks passed`);
    console.log("");

    // Performance comparison with Rust benchmarks
    const sendBench = this.results.find((r) => r.name.includes("Send"));
    const bidirBench = this.results.find((r) =>
      r.name.includes("Bidirectional")
    );

    if (sendBench) {
      console.log(
        `TypeScript Send Performance: ${sendBench.framesPerSecond.toFixed(
          0
        )} frames/sec`
      );
      console.log(`Rust Send Performance:       ~157,000 frames/sec`);
      console.log(
        `TypeScript/Rust Ratio:       ${(
          (sendBench.framesPerSecond / 157000) *
          100
        ).toFixed(1)}%`
      );
      console.log("");
    }

    if (bidirBench) {
      console.log(
        `TypeScript Bidirectional:    ${bidirBench.framesPerSecond.toFixed(
          0
        )} frames/sec`
      );
      console.log(`Rust Bidirectional:          ~7,279 frames/sec`);
      console.log(
        `TypeScript/Rust Ratio:       ${(
          (bidirBench.framesPerSecond / 7279) *
          100
        ).toFixed(1)}%`
      );
      console.log("");
    }

    // Verdict
    if (passed === total) {
      console.log("🎉 All TypeScript benchmarks PASSED!");
      console.log("✅ Neon binding performance is acceptable");
    } else {
      console.log("⚠️  Some TypeScript benchmarks FAILED");
      console.log("🔍 Consider optimizing the Neon bindings");
    }
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const benchmark = new SocketCANBenchmark();
  benchmark.runAllBenchmarks().catch(console.error);
}

export { SocketCANBenchmark };
