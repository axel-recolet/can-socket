#!/usr/bin/env node

/**
 * Benchmark complet des optimisations Neon critiques
 * Compare les performances entre:
 * - Legacy TypeScript (number[])
 * - Optimisé TypeScript (ArrayBuffer)
 * - Batch optimisé (Rust-level batching)
 * - Rust natif (référence)
 */

import { OptimizedSocketCan } from "./socketcan_ultra_optimized";
import { SocketCAN } from "./socketcan"; // Version legacy

interface BenchmarkResult {
  name: string;
  fps: number;
  improvement: number;
  errors: number;
  avgLatency: number;
}

class NeonOptimizationBenchmark {
  private results: BenchmarkResult[] = [];
  private readonly testDuration = 5000; // 5 secondes par test
  private readonly testData = new Uint8Array([
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  ]);

  /**
   * Teste la version legacy avec number[]
   */
  async benchmarkLegacy(): Promise<BenchmarkResult> {
    console.log("🔄 Test Legacy TypeScript (number[])...");

    const socket = new SocketCAN("vcan0");
    let frameCount = 0;
    let errorCount = 0;
    let totalLatency = 0;

    try {
      await socket.open();

      const startTime = Date.now();
      const endTime = startTime + this.testDuration;

      while (Date.now() < endTime) {
        const sendStart = Date.now();

        try {
          await socket.send(0x123, Array.from(this.testData));
          frameCount++;
          totalLatency += Date.now() - sendStart;
        } catch (error) {
          errorCount++;
        }
      }

      await socket.close();
    } catch (error) {
      console.error("Erreur test legacy:", error);
    }

    const fps = Math.round((frameCount / this.testDuration) * 1000);
    const avgLatency = totalLatency / frameCount;

    return {
      name: "Legacy TypeScript",
      fps,
      improvement: 100, // Référence
      errors: errorCount,
      avgLatency,
    };
  }

  /**
   * Teste la version optimisée avec ArrayBuffer
   */
  async benchmarkOptimizedSingle(): Promise<BenchmarkResult> {
    console.log("🔄 Test Optimisé Single (ArrayBuffer)...");

    const socket = new OptimizedSocketCan({
      useBatching: false,
      useArrayBuffers: true,
    });
    let frameCount = 0;
    let errorCount = 0;
    let totalLatency = 0;

    try {
      await socket.open("vcan0");

      const startTime = Date.now();
      const endTime = startTime + this.testDuration;

      while (Date.now() < endTime) {
        const sendStart = Date.now();

        try {
          await socket.sendOptimized({
            id: 0x123,
            data: this.testData.buffer.slice(0), // ArrayBuffer direct
            extended: false,
          });
          frameCount++;
          totalLatency += Date.now() - sendStart;
        } catch (error) {
          errorCount++;
        }
      }

      await socket.close();
    } catch (error) {
      console.error("Erreur test optimisé single:", error);
    }

    const fps = Math.round((frameCount / this.testDuration) * 1000);
    const baseFps =
      this.results.find((r) => r.name === "Legacy TypeScript")?.fps || 1;
    const improvement = Math.round((fps / baseFps) * 100);
    const avgLatency = totalLatency / frameCount;

    return {
      name: "Optimisé Single (ArrayBuffer)",
      fps,
      improvement,
      errors: errorCount,
      avgLatency,
    };
  }

  /**
   * Teste le batch optimisé avec traitement Rust-level
   */
  async benchmarkOptimizedBatch(): Promise<BenchmarkResult> {
    console.log("🔄 Test Batch Optimisé (Rust-level)...");

    const socket = new OptimizedSocketCan({
      useBatching: true,
      batchSize: 50,
      useArrayBuffers: true,
    });
    let frameCount = 0;
    let errorCount = 0;
    let totalLatency = 0;
    let batchCount = 0;

    try {
      await socket.open("vcan0");

      const startTime = Date.now();
      const endTime = startTime + this.testDuration;

      while (Date.now() < endTime) {
        const sendStart = Date.now();

        // Préparer un batch de frames
        const batch = [];
        for (let i = 0; i < 50; i++) {
          batch.push({
            id: 0x123 + i,
            data: this.testData.buffer.slice(0),
            extended: false,
          });
        }

        try {
          const sentCount = await socket.sendBatchOptimized(batch);
          frameCount += sentCount;
          batchCount++;
          totalLatency += Date.now() - sendStart;
        } catch (error) {
          errorCount++;
        }
      }

      await socket.close();
    } catch (error) {
      console.error("Erreur test batch optimisé:", error);
    }

    const fps = Math.round((frameCount / this.testDuration) * 1000);
    const baseFps =
      this.results.find((r) => r.name === "Legacy TypeScript")?.fps || 1;
    const improvement = Math.round((fps / baseFps) * 100);
    const avgLatency = totalLatency / batchCount; // Latence par batch

    return {
      name: "Batch Optimisé (Rust-level)",
      fps,
      improvement,
      errors: errorCount,
      avgLatency,
    };
  }

  /**
   * Teste la réception optimisée avec batch
   */
  async benchmarkOptimizedReceive(): Promise<BenchmarkResult> {
    console.log("🔄 Test Réception Batch Optimisée...");

    const sender = new OptimizedSocketCan();
    const receiver = new OptimizedSocketCan();
    let frameCount = 0;
    let errorCount = 0;
    let totalLatency = 0;

    try {
      await sender.open("vcan0");
      await receiver.open("vcan0");

      // Envoyer des frames en arrière-plan
      const sendPromise = this.sendFramesBackground(sender);

      const startTime = Date.now();
      const endTime = startTime + this.testDuration;

      while (Date.now() < endTime) {
        const receiveStart = Date.now();

        try {
          const frames = await receiver.receiveBatchOptimized(20, 100);
          frameCount += frames.length;
          totalLatency += Date.now() - receiveStart;
        } catch (error) {
          errorCount++;
        }
      }

      await sender.close();
      await receiver.close();
    } catch (error) {
      console.error("Erreur test réception optimisée:", error);
    }

    const fps = Math.round((frameCount / this.testDuration) * 1000);
    const baseFps =
      this.results.find((r) => r.name === "Legacy TypeScript")?.fps || 1;
    const improvement = Math.round((fps / baseFps) * 100);
    const avgLatency = totalLatency > 0 ? totalLatency / (frameCount / 20) : 0;

    return {
      name: "Réception Batch Optimisée",
      fps,
      improvement,
      errors: errorCount,
      avgLatency,
    };
  }

  /**
   * Envoie des frames en arrière-plan pour les tests de réception
   */
  private async sendFramesBackground(
    socket: OptimizedSocketCan
  ): Promise<void> {
    const frames = [];
    for (let i = 0; i < 100; i++) {
      frames.push({
        id: 0x200 + i,
        data: this.testData.buffer.slice(0),
        extended: false,
      });
    }

    while (true) {
      try {
        await socket.sendBatchOptimized(frames);
        await new Promise((resolve) => setTimeout(resolve, 10));
      } catch (error) {
        break;
      }
    }
  }

  /**
   * Benchmark complet des générateurs optimisés
   */
  async benchmarkOptimizedGenerator(): Promise<BenchmarkResult> {
    console.log("🔄 Test Générateur Optimisé...");

    const sender = new OptimizedSocketCan();
    const receiver = new OptimizedSocketCan();
    let frameCount = 0;
    let errorCount = 0;
    let totalLatency = 0;

    try {
      await sender.open("vcan0");
      await receiver.open("vcan0");

      // Envoyer des frames en arrière-plan
      const sendPromise = this.sendFramesBackground(sender);

      const startTime = Date.now();
      const endTime = startTime + this.testDuration;

      const generator = receiver.frames({ prefetchSize: 20 });

      for await (const frame of generator) {
        frameCount++;

        if (Date.now() > endTime) {
          break;
        }
      }

      await sender.close();
      await receiver.close();
    } catch (error) {
      console.error("Erreur test générateur optimisé:", error);
    }

    const fps = Math.round((frameCount / this.testDuration) * 1000);
    const baseFps =
      this.results.find((r) => r.name === "Legacy TypeScript")?.fps || 1;
    const improvement = Math.round((fps / baseFps) * 100);

    return {
      name: "Générateur Optimisé",
      fps,
      improvement,
      errors: errorCount,
      avgLatency: 0,
    };
  }

  /**
   * Exécute tous les benchmarks et affiche les résultats
   */
  async runAllBenchmarks(): Promise<void> {
    console.log("🚀 Benchmark des Optimisations Neon Critiques\n");

    // Tests en séquence pour éviter les interférences
    this.results.push(await this.benchmarkLegacy());
    this.results.push(await this.benchmarkOptimizedSingle());
    this.results.push(await this.benchmarkOptimizedBatch());
    this.results.push(await this.benchmarkOptimizedReceive());
    this.results.push(await this.benchmarkOptimizedGenerator());

    this.displayResults();
    this.analyzeOptimizations();
  }

  /**
   * Affiche les résultats sous forme de tableau
   */
  private displayResults(): void {
    console.log("\n📊 RÉSULTATS DES BENCHMARKS");
    console.log("=".repeat(80));
    console.log(
      "| Test                      | FPS      | Amélioration | Erreurs | Latence |"
    );
    console.log(
      "|---------------------------|----------|--------------|---------|---------|"
    );

    for (const result of this.results) {
      const fps = result.fps.toString().padStart(8);
      const improvement = `${result.improvement}%`.padStart(10);
      const errors = result.errors.toString().padStart(7);
      const latency = `${result.avgLatency.toFixed(1)}ms`.padStart(7);

      console.log(
        `| ${result.name.padEnd(
          25
        )} | ${fps} | ${improvement} | ${errors} | ${latency} |`
      );
    }

    console.log("=".repeat(80));
  }

  /**
   * Analyse les optimisations et fournit des recommandations
   */
  private analyzeOptimizations(): void {
    console.log("\n🔍 ANALYSE DES OPTIMISATIONS");
    console.log("=".repeat(50));

    const legacy = this.results.find((r) => r.name === "Legacy TypeScript");
    const single = this.results.find(
      (r) => r.name === "Optimisé Single (ArrayBuffer)"
    );
    const batch = this.results.find(
      (r) => r.name === "Batch Optimisé (Rust-level)"
    );

    if (legacy && single && batch) {
      const singleGain = ((single.fps - legacy.fps) / legacy.fps) * 100;
      const batchGain = ((batch.fps - legacy.fps) / legacy.fps) * 100;
      const batchVsSingle = ((batch.fps - single.fps) / single.fps) * 100;

      console.log(`✅ ArrayBuffer vs Legacy: +${singleGain.toFixed(1)}%`);
      console.log(`✅ Batch vs Legacy: +${batchGain.toFixed(1)}%`);
      console.log(`✅ Batch vs Single: +${batchVsSingle.toFixed(1)}%`);

      console.log("\n💡 RECOMMANDATIONS:");

      if (singleGain > 100) {
        console.log("🎯 ArrayBuffer: Gain significatif détecté!");
      } else if (singleGain > 20) {
        console.log("🎯 ArrayBuffer: Amélioration modérée");
      } else {
        console.log("⚠️  ArrayBuffer: Gain limité, vérifier l'implémentation");
      }

      if (batchGain > 500) {
        console.log(
          "🎯 Batch: Excellent gain! Utiliser pour haute performance"
        );
      } else if (batchGain > 200) {
        console.log(
          "🎯 Batch: Bon gain, recommandé pour applications intensives"
        );
      } else {
        console.log("⚠️  Batch: Gain limité, overhead batch trop important");
      }

      console.log("\n📈 PROJECTION THÉORIQUE:");
      console.log(`Rust natif: ~157,000 fps (référence)`);
      console.log(`Objectif 10x: ${legacy.fps * 10} fps`);
      console.log(`Objectif 50x: ${legacy.fps * 50} fps`);
      console.log(`Meilleur actuel: ${Math.max(single.fps, batch.fps)} fps`);

      const bestFps = Math.max(single.fps, batch.fps);
      const gapToRust = 157000 / bestFps;
      console.log(`Écart vs Rust: ${gapToRust.toFixed(0)}x restant`);
    }

    console.log("\n🎯 PROCHAINES OPTIMISATIONS:");
    console.log("1. Cache de frames pré-compilées (Rust-level)");
    console.log("2. Zero-copy total avec SharedArrayBuffer");
    console.log("3. Workers threads parallèles");
    console.log("4. Optimisations système (buffers noyau)");
  }
}

// Exécution du benchmark si appelé directement
if (require.main === module) {
  const benchmark = new NeonOptimizationBenchmark();
  benchmark.runAllBenchmarks().catch(console.error);
}

export { NeonOptimizationBenchmark };
