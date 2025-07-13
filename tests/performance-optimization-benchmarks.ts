/**
 * Advanced performance benchmarks comparing different optimization strategies
 */

import { SocketCAN } from "../src/socketcan";
// import { OptimizedSocketCAN } from "../src/socketcan_optimized";

interface BenchmarkResult {
  strategy: string;
  framesPerSecond: number;
  totalFrames: number;
  duration: number;
  averageLatency: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

class PerformanceBenchmarks {
  private interfaceName: string;
  private testDuration: number = 10000; // 10 seconds

  constructor(interfaceName: string = "vcan0") {
    this.interfaceName = interfaceName;
  }

  /**
   * Benchmark 1: Baseline individual send/receive
   */
  async benchmarkBaseline(): Promise<BenchmarkResult> {
    console.log("🔄 Running baseline benchmark (individual send/receive)...");

    const sender = new SocketCAN(this.interfaceName);
    const receiver = new SocketCAN(this.interfaceName);

    await sender.open();
    await receiver.open();

    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    let frameCount = 0;
    let totalLatency = 0;

    // Setup receiver
    const receivedFrames: Array<{ timestamp: number; latency: number }> = [];
    const receivePromise = (async () => {
      try {
        while (Date.now() - startTime < this.testDuration) {
          const receiveStart = Date.now();
          const frame = await receiver.receive(1000);
          const receiveEnd = Date.now();

          receivedFrames.push({
            timestamp: receiveEnd,
            latency: receiveEnd - receiveStart,
          });
        }
      } catch (error) {
        // Timeout or end of test
      }
    })();

    // Send frames as fast as possible
    const sendPromise = (async () => {
      while (Date.now() - startTime < this.testDuration) {
        try {
          await sender.send(0x123, [
            frameCount & 0xff,
            (frameCount >> 8) & 0xff,
          ]);
          frameCount++;
        } catch (error) {
          console.error("Send error:", error);
          break;
        }
      }
    })();

    await Promise.all([sendPromise, receivePromise]);

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;

    totalLatency = receivedFrames.reduce(
      (sum, frame) => sum + frame.latency,
      0
    );
    const averageLatency =
      receivedFrames.length > 0 ? totalLatency / receivedFrames.length : 0;

    await sender.close();
    await receiver.close();

    return {
      strategy: "Baseline Individual",
      framesPerSecond: (frameCount / duration) * 1000,
      totalFrames: frameCount,
      duration,
      averageLatency,
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      },
    };
  }

  /**
   * Benchmark 2: Async generator with prefetching
   */
  async benchmarkAsyncGenerator(): Promise<BenchmarkResult> {
    console.log("🔄 Running async generator benchmark...");

    const sender = new SocketCAN(this.interfaceName);
    const receiver = new SocketCAN(this.interfaceName);

    await sender.open();
    await receiver.open();

    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    let frameCount = 0;
    let receivedCount = 0;
    let totalLatency = 0;

    // Send frames continuously
    const sendPromise = (async () => {
      while (Date.now() - startTime < this.testDuration) {
        try {
          await sender.send(0x123, [
            frameCount & 0xff,
            (frameCount >> 8) & 0xff,
          ]);
          frameCount++;

          // Small delay to prevent overwhelming
          if (frameCount % 100 === 0) {
            await new Promise((resolve) => setImmediate(resolve));
          }
        } catch (error) {
          console.error("Send error:", error);
          break;
        }
      }
    })();

    // Receive using async generator
    const receivePromise = (async () => {
      try {
        for await (const frame of receiver.frames({ timeout: 1000 })) {
          receivedCount++;
          totalLatency += 1; // Placeholder latency

          if (Date.now() - startTime >= this.testDuration) {
            break;
          }
        }
      } catch (error) {
        // End of test
      }
    })();

    await Promise.all([sendPromise, receivePromise]);

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;

    await sender.close();
    await receiver.close();

    return {
      strategy: "Async Generator",
      framesPerSecond: (Math.min(frameCount, receivedCount) / duration) * 1000,
      totalFrames: Math.min(frameCount, receivedCount),
      duration,
      averageLatency: receivedCount > 0 ? totalLatency / receivedCount : 0,
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      },
    };
  }

  /**
   * Benchmark 3: Batched operations (simulated)
   */
  async benchmarkBatchedOperations(): Promise<BenchmarkResult> {
    console.log("🔄 Running batched operations benchmark...");

    const sender = new SocketCAN(this.interfaceName);
    const receiver = new SocketCAN(this.interfaceName);

    await sender.open();
    await receiver.open();

    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    let frameCount = 0;
    let receivedCount = 0;
    let totalLatency = 0;

    const batchSize = 50;
    const frames: Array<{ id: number; data: number[] }> = [];

    // Prepare batch
    for (let i = 0; i < batchSize; i++) {
      frames.push({
        id: 0x123,
        data: [i & 0xff, (i >> 8) & 0xff],
      });
    }

    // Send batches
    const sendPromise = (async () => {
      while (Date.now() - startTime < this.testDuration) {
        try {
          // Simulate batch send by sending quickly in sequence
          for (const frame of frames) {
            await sender.send(frame.id, frame.data);
            frameCount++;
          }

          // Small delay between batches
          await new Promise((resolve) => setTimeout(resolve, 1));
        } catch (error) {
          console.error("Batch send error:", error);
          break;
        }
      }
    })();

    // Receive frames
    const receivePromise = (async () => {
      try {
        while (Date.now() - startTime < this.testDuration) {
          const receiveStart = Date.now();
          await receiver.receive(100);
          const receiveEnd = Date.now();

          receivedCount++;
          totalLatency += receiveEnd - receiveStart;
        }
      } catch (error) {
        // Timeout or end of test
      }
    })();

    await Promise.all([sendPromise, receivePromise]);

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;

    await sender.close();
    await receiver.close();

    return {
      strategy: "Batched Operations",
      framesPerSecond: (Math.min(frameCount, receivedCount) / duration) * 1000,
      totalFrames: Math.min(frameCount, receivedCount),
      duration,
      averageLatency: receivedCount > 0 ? totalLatency / receivedCount : 0,
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      },
    };
  }

  /**
   * Benchmark 4: Memory-optimized with object pooling (simulated)
   */
  async benchmarkMemoryOptimized(): Promise<BenchmarkResult> {
    console.log("🔄 Running memory-optimized benchmark...");

    const sender = new SocketCAN(this.interfaceName);
    const receiver = new SocketCAN(this.interfaceName);

    await sender.open();
    await receiver.open();

    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    let frameCount = 0;
    let receivedCount = 0;
    let totalLatency = 0;

    // Simulate object pooling by reusing data arrays
    const dataPool: Uint8Array[] = [];
    for (let i = 0; i < 100; i++) {
      dataPool.push(new Uint8Array(8));
    }
    let poolIndex = 0;

    // Send frames with pooled data
    const sendPromise = (async () => {
      while (Date.now() - startTime < this.testDuration) {
        try {
          const data = dataPool[poolIndex % dataPool.length];
          data[0] = frameCount & 0xff;
          data[1] = (frameCount >> 8) & 0xff;

          await sender.send(0x123, Array.from(data.slice(0, 2)));
          frameCount++;
          poolIndex++;
        } catch (error) {
          console.error("Send error:", error);
          break;
        }
      }
    })();

    // Receive frames
    const receivePromise = (async () => {
      try {
        while (Date.now() - startTime < this.testDuration) {
          const receiveStart = Date.now();
          await receiver.receive(1000);
          const receiveEnd = Date.now();

          receivedCount++;
          totalLatency += receiveEnd - receiveStart;
        }
      } catch (error) {
        // Timeout or end of test
      }
    })();

    await Promise.all([sendPromise, receivePromise]);

    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - startTime;

    await sender.close();
    await receiver.close();

    return {
      strategy: "Memory Optimized",
      framesPerSecond: (Math.min(frameCount, receivedCount) / duration) * 1000,
      totalFrames: Math.min(frameCount, receivedCount),
      duration,
      averageLatency: receivedCount > 0 ? totalLatency / receivedCount : 0,
      memoryUsage: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      },
    };
  }

  /**
   * Run all benchmarks and compare results
   */
  async runAllBenchmarks(): Promise<void> {
    console.log("🚀 Starting comprehensive performance benchmarks...\n");

    const results: BenchmarkResult[] = [];

    try {
      results.push(await this.benchmarkBaseline());
      console.log("✅ Baseline benchmark completed\n");

      results.push(await this.benchmarkAsyncGenerator());
      console.log("✅ Async generator benchmark completed\n");

      results.push(await this.benchmarkBatchedOperations());
      console.log("✅ Batched operations benchmark completed\n");

      results.push(await this.benchmarkMemoryOptimized());
      console.log("✅ Memory optimized benchmark completed\n");
    } catch (error) {
      console.error("❌ Benchmark error:", error);
    }

    // Display results
    this.displayResults(results);
  }

  private displayResults(results: BenchmarkResult[]): void {
    console.log("📊 Performance Benchmark Results");
    console.log("================================\n");

    // Sort by frames per second
    results.sort((a, b) => b.framesPerSecond - a.framesPerSecond);

    for (const result of results) {
      console.log(`Strategy: ${result.strategy}`);
      console.log(`  Frames/sec: ${result.framesPerSecond.toFixed(2)}`);
      console.log(`  Total frames: ${result.totalFrames}`);
      console.log(`  Duration: ${result.duration}ms`);
      console.log(`  Avg latency: ${result.averageLatency.toFixed(2)}ms`);
      console.log(`  Memory usage:`);
      console.log(
        `    Heap used: ${(result.memoryUsage.heapUsed / 1024 / 1024).toFixed(
          2
        )} MB`
      );
      console.log(
        `    Heap total: ${(result.memoryUsage.heapTotal / 1024 / 1024).toFixed(
          2
        )} MB`
      );
      console.log(
        `    External: ${(result.memoryUsage.external / 1024 / 1024).toFixed(
          2
        )} MB`
      );
      console.log("");
    }

    // Calculate improvements
    if (results.length > 1) {
      const baseline = results.find(
        (r) => r.strategy === "Baseline Individual"
      );
      if (baseline) {
        console.log("🎯 Performance Improvements vs Baseline:");
        for (const result of results) {
          if (result.strategy !== "Baseline Individual") {
            const improvement =
              ((result.framesPerSecond - baseline.framesPerSecond) /
                baseline.framesPerSecond) *
              100;
            console.log(
              `  ${result.strategy}: ${
                improvement > 0 ? "+" : ""
              }${improvement.toFixed(1)}%`
            );
          }
        }
        console.log("");
      }
    }

    // Best strategy recommendation
    if (results.length > 0) {
      const best = results[0];
      console.log(`🏆 Best performing strategy: ${best.strategy}`);
      console.log(
        `   Peak performance: ${best.framesPerSecond.toFixed(2)} frames/sec`
      );
    }
  }
}

// Export for use in tests
export { PerformanceBenchmarks, BenchmarkResult };
