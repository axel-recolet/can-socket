/**
 * Benchmark simple pour tester les optimisations TypeScript localement
 */

// Simulation du module natif pour tests locaux
const mockNative = {
  createSocket: () => 1,
  sendFrame: () => {},
  readFrame: () => ({
    id: 0x123,
    data: [1, 2, 3, 4],
    extended: false,
    fd: false,
    remote: false,
    error: false,
  }),
  closeSocket: () => {},
};

interface MockFrame {
  id: number;
  data: number[];
  extended: boolean;
  fd: boolean;
  remote: boolean;
  error: boolean;
}

// Test 1: Pool d'objets vs création d'objets
class FramePool {
  private pool: MockFrame[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    // Pré-allouer des objets
    for (let i = 0; i < 100; i++) {
      this.pool.push(this.createFrame());
    }
  }

  private createFrame(): MockFrame {
    return {
      id: 0,
      data: [],
      extended: false,
      fd: false,
      remote: false,
      error: false,
    };
  }

  getFrame(): MockFrame {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFrame();
  }

  returnFrame(frame: MockFrame): void {
    if (this.pool.length < this.maxSize) {
      // Reset frame
      frame.id = 0;
      frame.data.length = 0;
      frame.extended = false;
      frame.fd = false;
      frame.remote = false;
      frame.error = false;
      this.pool.push(frame);
    }
  }
}

// Benchmark sans pool d'objets
function benchmarkWithoutPool(iterations: number): number {
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Simuler création d'objet frame
    const frame: MockFrame = {
      id: i,
      data: [i & 0xff, (i >> 8) & 0xff],
      extended: false,
      fd: false,
      remote: false,
      error: false,
    };

    // Simuler traitement
    frame.id = frame.id + 1;

    // L'objet sera collecté par le GC
  }

  return Date.now() - start;
}

// Benchmark avec pool d'objets
function benchmarkWithPool(iterations: number): number {
  const pool = new FramePool();
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Récupérer depuis le pool
    const frame = pool.getFrame();

    frame.id = i;
    frame.data.push(i & 0xff, (i >> 8) & 0xff);

    // Simuler traitement
    frame.id = frame.id + 1;

    // Retourner au pool
    pool.returnFrame(frame);
  }

  return Date.now() - start;
}

// Test 2: Traitement par lots vs individuel
function benchmarkIndividualSend(iterations: number): number {
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Simuler envoi individuel
    mockNative.sendFrame(1, i, [i & 0xff], false, false, false);
  }

  return Date.now() - start;
}

function benchmarkBatchSend(iterations: number): number {
  const batchSize = 50;
  const start = Date.now();

  for (let i = 0; i < iterations; i += batchSize) {
    const batch = [];

    // Préparer le lot
    for (let j = 0; j < batchSize && i + j < iterations; j++) {
      batch.push({
        id: i + j,
        data: [(i + j) & 0xff],
        extended: false,
        fd: false,
        remote: false,
      });
    }

    // Simuler envoi par lot (plus efficace)
    for (const frame of batch) {
      mockNative.sendFrame(
        1,
        frame.id,
        frame.data,
        frame.extended,
        frame.fd,
        frame.remote
      );
    }
  }

  return Date.now() - start;
}

// Test 3: Buffer pooling vs allocations
class BufferPool {
  private buffers: Uint8Array[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    // Pré-allouer des buffers
    for (let i = 0; i < 100; i++) {
      this.buffers.push(new Uint8Array(64));
    }
  }

  getBuffer(): Uint8Array {
    if (this.buffers.length > 0) {
      return this.buffers.pop()!;
    }
    return new Uint8Array(64);
  }

  returnBuffer(buffer: Uint8Array): void {
    if (this.buffers.length < this.maxSize) {
      buffer.fill(0); // Reset
      this.buffers.push(buffer);
    }
  }
}

function benchmarkWithoutBufferPool(iterations: number): number {
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Créer nouveau buffer à chaque fois
    const buffer = new Uint8Array(8);
    buffer[0] = i & 0xff;
    buffer[1] = (i >> 8) & 0xff;

    // Simuler utilisation
    const sum = buffer.reduce((a, b) => a + b, 0);
  }

  return Date.now() - start;
}

function benchmarkWithBufferPool(iterations: number): number {
  const pool = new BufferPool();
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Réutiliser buffer du pool
    const buffer = pool.getBuffer();
    buffer[0] = i & 0xff;
    buffer[1] = (i >> 8) & 0xff;

    // Simuler utilisation
    const sum = buffer.reduce((a, b) => a + b, 0);

    // Retourner au pool
    pool.returnBuffer(buffer);
  }

  return Date.now() - start;
}

// Exécuter tous les benchmarks
function runOptimizationBenchmarks(): void {
  console.log("🚀 Benchmarks d'optimisation TypeScript");
  console.log("=======================================\n");

  const iterations = 100000;

  // Test 1: Pool d'objets
  console.log("📦 Test 1: Pool d'objets");
  const timeWithoutPool = benchmarkWithoutPool(iterations);
  const timeWithPool = benchmarkWithPool(iterations);
  const poolImprovement =
    ((timeWithoutPool - timeWithPool) / timeWithoutPool) * 100;

  console.log(`  Sans pool: ${timeWithoutPool}ms`);
  console.log(`  Avec pool: ${timeWithPool}ms`);
  console.log(`  Amélioration: ${poolImprovement.toFixed(1)}%\n`);

  // Test 2: Traitement par lots
  console.log("📋 Test 2: Traitement par lots");
  const timeIndividual = benchmarkIndividualSend(iterations);
  const timeBatch = benchmarkBatchSend(iterations);
  const batchImprovement =
    ((timeIndividual - timeBatch) / timeIndividual) * 100;

  console.log(`  Envoi individuel: ${timeIndividual}ms`);
  console.log(`  Envoi par lots: ${timeBatch}ms`);
  console.log(`  Amélioration: ${batchImprovement.toFixed(1)}%\n`);

  // Test 3: Pool de buffers
  console.log("💾 Test 3: Pool de buffers");
  const timeWithoutBufferPool = benchmarkWithoutBufferPool(iterations);
  const timeWithBufferPool = benchmarkWithBufferPool(iterations);
  const bufferImprovement =
    ((timeWithoutBufferPool - timeWithBufferPool) / timeWithoutBufferPool) *
    100;

  console.log(`  Sans pool de buffers: ${timeWithoutBufferPool}ms`);
  console.log(`  Avec pool de buffers: ${timeWithBufferPool}ms`);
  console.log(`  Amélioration: ${bufferImprovement.toFixed(1)}%\n`);

  // Calcul de l'amélioration combinée
  const totalCurrentTime =
    timeWithoutPool + timeIndividual + timeWithoutBufferPool;
  const totalOptimizedTime = timeWithPool + timeBatch + timeWithBufferPool;
  const totalImprovement =
    ((totalCurrentTime - totalOptimizedTime) / totalCurrentTime) * 100;

  console.log("🎯 Résumé des optimisations");
  console.log(`  Amélioration totale estimée: ${totalImprovement.toFixed(1)}%`);
  console.log(
    `  Facteur d'accélération: ${(
      totalCurrentTime / totalOptimizedTime
    ).toFixed(1)}x`
  );

  // Projection sur les performances réelles
  const currentRealPerf = 217; // fps actuels
  const projectedPerf =
    currentRealPerf * (totalCurrentTime / totalOptimizedTime);

  console.log(`\n📈 Projection sur performances réelles:`);
  console.log(`  Performance actuelle: ${currentRealPerf} fps`);
  console.log(`  Performance projetée: ${projectedPerf.toFixed(0)} fps`);
  console.log(
    `  Gain estimé: ${(projectedPerf - currentRealPerf).toFixed(0)} fps`
  );

  if (projectedPerf > 500) {
    console.log("✅ Performance suffisante pour CAN 2.0 (500 fps max)");
  }
  if (projectedPerf > 5000) {
    console.log("✅ Performance suffisante pour CAN FD (5000 fps max)");
  }
}

// Lancer les benchmarks si ce fichier est exécuté directement
if (require.main === module) {
  runOptimizationBenchmarks();
}

export { runOptimizationBenchmarks };
