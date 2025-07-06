#!/usr/bin/env node

/**
 * Test rapide de la nouvelle architecture
 * Vérifie que tout fonctionne correctement
 */

async function quickTest() {
  console.log("🧪 Test rapide de la nouvelle architecture de tests");
  console.log("=".repeat(60));

  try {
    // Test 1: Vérification du chargement des modules
    console.log("\n1️⃣  Vérification du chargement...");

    const { TestRunner } = require("./framework/test-runner");
    const { TestSuiteRegistry } = require("./framework/test-suite-registry");
    const { TestReporter } = require("./framework/test-reporter");
    const { SystemChecker } = require("./framework/system-checker");

    console.log("   ✅ Framework modules chargés");

    // Test 2: Chargement des suites
    console.log("\n2️⃣  Chargement des suites...");

    require("./suites/core");
    require("./suites/advanced");
    require("./suites/integration");
    require("./suites/performance");

    const registry = TestSuiteRegistry.getInstance();
    const suites = registry.getAllSuites();

    console.log(`   ✅ ${suites.length} suites chargées:`);
    suites.forEach((suite) => {
      console.log(`      • ${suite.name}: ${suite.tests.length} tests`);
    });

    // Test 3: Utilitaires
    console.log("\n3️⃣  Vérification des utilitaires...");

    const {
      FrameValidator,
      FrameGenerator,
      AsyncHelper,
      MetricsCollector,
    } = require("./utils/test-helpers");

    // Test de validation
    const testFrame = FrameGenerator.generateStandardFrame();
    FrameValidator.validateStandardFrame(testFrame);

    console.log("   ✅ Utilitaires fonctionnels");

    // Test 4: Vérifications système
    console.log("\n4️⃣  Vérifications système...");

    const systemChecker = new SystemChecker();
    const systemInfo = await systemChecker.performChecks();

    console.log(`   🖥️  Plateforme: ${systemInfo.platform}`);
    console.log(`   🔌  Support CAN: ${systemInfo.canSupport ? "✅" : "❌"}`);
    console.log(`   📡  Interfaces: ${systemInfo.interfaces.length}`);

    // Test 5: Test runner basique
    console.log("\n5️⃣  Test du runner...");

    const runner = new TestRunner();
    const reporter = new TestReporter();

    console.log("   ✅ Runner et reporter initialisés");

    console.log("\n🎉 Tous les tests de vérification sont passés !");
    console.log("✨ La nouvelle architecture est fonctionnelle");
    console.log("\n🚀 Commandes disponibles:");
    console.log("   npm test                    # Tous les tests");
    console.log("   npm run test:core           # Tests core uniquement");
    console.log("   node tests/index.js --help  # Aide complète");

    return true;
  } catch (error) {
    console.error("\n❌ Erreur lors du test rapide:", error.message);
    console.error("📋 Stack trace:", error.stack);
    return false;
  }
}

// Exécution si appelé directement
if (require.main === module) {
  quickTest()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Erreur fatale:", error.message);
      process.exit(1);
    });
}

module.exports = { quickTest };
