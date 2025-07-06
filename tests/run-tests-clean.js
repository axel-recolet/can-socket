#!/usr/bin/env node

/**
 * Script principal de test nettoyé pour SocketCAN
 * Remplace l'ancien run-tests.js avec une approche plus propre
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");

const execAsync = promisify(exec);

// Configuration des tests organisés
const TEST_SUITES = {
  core: {
    name: "Tests Principaux",
    description: "Tests de base et API principale",
    tests: [
      { name: "test-clean.js", description: "Tests de base nettoyés" },
      {
        name: "validate-typescript-api.js",
        description: "Validation API TypeScript",
      },
    ],
  },
  advanced: {
    name: "Tests Avancés",
    description: "Fonctionnalités avancées (CAN FD, filtres, etc.)",
    tests: [
      {
        name: "test-advanced.js",
        description: "Tests des fonctionnalités avancées",
      },
      { name: "validate-all-features.js", description: "Validation complète" },
    ],
  },
  legacy: {
    name: "Tests de Compatibilité",
    description: "Tests pour vérifier la compatibilité",
    tests: [
      {
        name: "test-final-implementation.js",
        description: "Test d'implémentation finale",
      },
      { name: "test-new-name.js", description: "Test après renommage" },
    ],
  },
};

/**
 * Exécute un test individuel
 */
async function runSingleTest(testFile, description) {
  const testPath = path.join(__dirname, testFile);

  try {
    const { stdout, stderr } = await execAsync(`node "${testPath}"`, {
      cwd: path.join(__dirname, ".."),
      timeout: 30000, // 30 secondes timeout
    });

    return {
      success: true,
      output: stdout,
      error: stderr,
    };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || "",
      error: error.stderr || error.message,
      code: error.code,
    };
  }
}

/**
 * Exécute une suite de tests
 */
async function runTestSuite(suiteName, suite) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🧪 ${suite.name}`);
  console.log(`📋 ${suite.description}`);
  console.log(`${"=".repeat(80)}`);

  const results = [];

  for (const test of suite.tests) {
    console.log(`\n🔄 Exécution: ${test.description}...`);

    const result = await runSingleTest(test.name, test.description);

    if (result.success) {
      console.log(`✅ ${test.name} - Réussi`);
    } else {
      console.log(`❌ ${test.name} - Échec (code ${result.code || "unknown"})`);
      if (
        result.error &&
        !result.error.includes("Linux") &&
        !result.error.includes("interface")
      ) {
        console.log(`   Erreur: ${result.error.split("\n")[0]}`);
      }
    }

    results.push({
      name: test.name,
      description: test.description,
      success: result.success,
      error: result.error,
    });
  }

  return results;
}

/**
 * Affiche le résumé final
 */
function printSummary(allResults) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 RÉSUMÉ GÉNÉRAL DES TESTS`);
  console.log(`${"=".repeat(80)}`);

  let totalTests = 0;
  let passedTests = 0;

  for (const [suiteName, results] of Object.entries(allResults)) {
    const suiteTotal = results.length;
    const suitePassed = results.filter((r) => r.success).length;

    totalTests += suiteTotal;
    passedTests += suitePassed;

    console.log(`\n📋 ${TEST_SUITES[suiteName].name}:`);
    console.log(`   ✅ Réussis: ${suitePassed}/${suiteTotal}`);

    if (suitePassed < suiteTotal) {
      console.log(`   ❌ Échecs:`);
      results
        .filter((r) => !r.success)
        .forEach((test) => {
          console.log(`      - ${test.name}: ${test.description}`);
        });
    }
  }

  const successRate =
    totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  console.log(
    `\n🎯 TOTAL: ${passedTests}/${totalTests} tests réussis (${successRate}%)`
  );

  if (passedTests === totalTests) {
    console.log(`\n🎉 Tous les tests sont passés avec succès !`);
    console.log(`✨ Le module SocketCAN fonctionne parfaitement`);
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} test(s) ont échoué`);
    console.log(
      `💡 Note: Les échecs peuvent être normaux sur des systèmes non-Linux`
    );
    console.log(`   ou sans interface CAN configurée`);
  }

  console.log(`${"=".repeat(80)}`);

  return passedTests === totalTests;
}

/**
 * Fonction principale
 */
async function main() {
  console.log(`🚀 SocketCAN - Suite de Tests Nettoyée`);
  console.log(`📅 ${new Date().toLocaleString()}`);

  const allResults = {};

  // Exécuter les suites de tests par ordre de priorité
  const suiteOrder = ["core", "advanced", "legacy"];

  for (const suiteName of suiteOrder) {
    const suite = TEST_SUITES[suiteName];
    allResults[suiteName] = await runTestSuite(suiteName, suite);

    // Pause courte entre les suites
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Afficher le résumé final
  const allPassed = printSummary(allResults);

  process.exit(allPassed ? 0 : 1);
}

// Option pour exécuter une suite spécifique
if (process.argv[2]) {
  const requestedSuite = process.argv[2];
  if (TEST_SUITES[requestedSuite]) {
    console.log(
      `🎯 Exécution de la suite: ${TEST_SUITES[requestedSuite].name}`
    );
    runTestSuite(requestedSuite, TEST_SUITES[requestedSuite])
      .then((results) => {
        const passed = results.filter((r) => r.success).length;
        const total = results.length;
        console.log(
          `\n📊 Suite ${requestedSuite}: ${passed}/${total} tests réussis`
        );
        process.exit(passed === total ? 0 : 1);
      })
      .catch((error) => {
        console.error(
          `❌ Erreur lors de l'exécution de la suite ${requestedSuite}:`,
          error.message
        );
        process.exit(1);
      });
  } else {
    console.error(`❌ Suite de test inconnue: ${requestedSuite}`);
    console.log(`Suites disponibles: ${Object.keys(TEST_SUITES).join(", ")}`);
    process.exit(1);
  }
} else {
  // Exécuter toutes les suites
  main().catch((error) => {
    console.error("❌ Erreur lors de l'exécution des tests:", error.message);
    process.exit(1);
  });
}
