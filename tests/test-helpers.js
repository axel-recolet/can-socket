/**
 * Helper functions for SocketCAN tests
 * Provides common utilities and test patterns
 */

const SocketCAN = require("../dist/src/main");

/**
 * Standard test configuration
 */
const TEST_CONFIG = {
  interface: "vcan0", // Virtual CAN interface for testing
  timeout: 1000,
  testFrames: {
    standard: { id: 0x123, data: [0x01, 0x02, 0x03, 0x04] },
    extended: { id: 0x1fffffff, data: [0xde, 0xad, 0xbe, 0xef] },
    remote: { id: 0x456, dlc: 4 },
    canFd: { id: 0x789, data: new Array(64).fill(0).map((_, i) => i % 256) },
  },
};

/**
 * Test result tracker
 */
class TestTracker {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  test(name, testFn) {
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        console.log(`✅ ${name}`);
        this.passed++;
      } else {
        console.log(`❌ ${name}: ${result}`);
        this.failed++;
        this.errors.push(`${name}: ${result}`);
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.failed++;
      this.errors.push(`${name}: ${error.message}`);
    }
  }

  async asyncTest(name, testFn) {
    try {
      const result = await testFn();
      if (result === true || result === undefined) {
        console.log(`✅ ${name}`);
        this.passed++;
      } else {
        console.log(`❌ ${name}: ${result}`);
        this.failed++;
        this.errors.push(`${name}: ${result}`);
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      this.failed++;
      this.errors.push(`${name}: ${error.message}`);
    }
  }

  summary() {
    const total = this.passed + this.failed;
    const successRate = total > 0 ? Math.round((this.passed / total) * 100) : 0;

    console.log(`\n📊 === RÉSUMÉ DES TESTS ===`);
    console.log(`✅ Réussis: ${this.passed}/${total}`);
    console.log(`❌ Échecs: ${this.failed}/${total}`);
    console.log(`📈 Taux de réussite: ${successRate}%`);

    if (this.failed > 0) {
      console.log(`\n⚠️  Erreurs détectées:`);
      this.errors.forEach((error) => console.log(`   - ${error}`));
    }

    return this.failed === 0;
  }
}

/**
 * Create a SocketCAN instance with standard test configuration
 */
function createTestSocket(options = {}) {
  const config = { ...TEST_CONFIG, ...options };
  return new SocketCAN(config.interface, options);
}

/**
 * Test basic socket operations
 */
async function testBasicOperations(socket) {
  console.log("🔧 Test des opérations de base");

  const tracker = new TestTracker();

  tracker.test("Instance créée", () => socket !== null);
  tracker.test("Socket initialement fermé", () => !socket.isOpen());

  await tracker.asyncTest("Ouverture du socket", async () => {
    await socket.open();
    return socket.isOpen();
  });

  await tracker.asyncTest("Envoi d'une frame standard", async () => {
    const frame = TEST_CONFIG.testFrames.standard;
    await socket.send(frame.id, frame.data);
    return true;
  });

  await tracker.asyncTest("Fermeture du socket", async () => {
    socket.close();
    return !socket.isOpen();
  });

  return tracker.summary();
}

/**
 * Test parameter validation
 */
async function testValidation(socket) {
  console.log("\n🛡️  Test de validation des paramètres");

  const tracker = new TestTracker();

  await tracker.asyncTest("ID invalide rejeté", async () => {
    try {
      await socket.send(0x800, [0x01]); // Invalid standard ID
      return "Should have thrown error";
    } catch (error) {
      return true; // Expected error
    }
  });

  await tracker.asyncTest("Données trop longues rejetées", async () => {
    try {
      await socket.send(0x123, new Array(9).fill(0)); // Too long for standard CAN
      return "Should have thrown error";
    } catch (error) {
      return true; // Expected error
    }
  });

  await tracker.asyncTest("Byte invalide rejeté", async () => {
    try {
      await socket.send(0x123, [256]); // Invalid byte value
      return "Should have thrown error";
    } catch (error) {
      return true; // Expected error
    }
  });

  return tracker.summary();
}

/**
 * Test frame type detection
 */
function testFrameTypes() {
  console.log("\n📋 Test de détection des types de frames");

  const tracker = new TestTracker();

  tracker.test("Frame standard détectée", () => {
    const frame = {
      id: 0x123,
      data: [1, 2, 3],
      remote: false,
      error: false,
      fd: false,
    };
    return (
      !SocketCAN.isRemoteFrame(frame) &&
      !SocketCAN.isErrorFrame(frame) &&
      !SocketCAN.isCanFdFrame(frame)
    );
  });

  tracker.test("Frame remote détectée", () => {
    const frame = { id: 0x123, remote: true, error: false, fd: false };
    return SocketCAN.isRemoteFrame(frame);
  });

  tracker.test("Frame d'erreur détectée", () => {
    const frame = { id: 0x123, error: true, remote: false, fd: false };
    return SocketCAN.isErrorFrame(frame);
  });

  tracker.test("Frame CAN FD détectée", () => {
    const frame = { id: 0x123, fd: true, remote: false, error: false };
    return SocketCAN.isCanFdFrame(frame);
  });

  return tracker.summary();
}

/**
 * Print test header
 */
function printTestHeader(testName) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 ${testName}`);
  console.log(`${"=".repeat(60)}`);
}

/**
 * Handle graceful test execution with error handling
 */
async function runTest(testName, testFn) {
  try {
    printTestHeader(testName);
    const result = await testFn();
    return result;
  } catch (error) {
    console.log(`❌ Test ${testName} failed: ${error.message}`);
    if (
      error.message.includes("Interface") ||
      error.message.includes("Linux")
    ) {
      console.log(
        `💡 Note: Ce test nécessite une interface CAN configurée sur Linux`
      );
    }
    return false;
  }
}

module.exports = {
  TEST_CONFIG,
  TestTracker,
  createTestSocket,
  testBasicOperations,
  testValidation,
  testFrameTypes,
  printTestHeader,
  runTest,
  SocketCAN,
};
