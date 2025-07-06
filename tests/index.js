#!/usr/bin/env node

/**
 * Point d'entrée principal pour tous les tests SocketCAN
 * Nouveau système de tests organisé et modulaire
 */

async function main() {
  console.log("🚀 SocketCAN - Suite de Tests Complète");
  console.log("📅", new Date().toLocaleString());
  console.log("=".repeat(80));

  // Configuration des options depuis les arguments de ligne de commande
  const args = process.argv.slice(2);
  const options = parseArguments(args);

  // Affichage de l'aide si demandé
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  try {
    // Chargement dynamique pour éviter les problèmes de mémoire
    const { TestRunner } = require("./framework/test-runner");
    const { TestSuiteRegistry } = require("./framework/test-suite-registry");

    // Chargement des suites demandées uniquement
    await loadRequiredSuites(options);

    const runner = new TestRunner();
    const results = await runner.runSuites(options);

    // Affichage du résumé
    runner.printSummary(results);

    // Code de sortie basé sur les résultats
    const allPassed = results.every((suite) => suite.passed === suite.total);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error(
      "❌ Erreur critique lors de l'exécution des tests:",
      error.message
    );
    if (process.env.NODE_ENV === "development") {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Charge uniquement les suites nécessaires
 */
async function loadRequiredSuites(options) {
  const suitesToLoad =
    options.suites.length > 0
      ? options.suites
      : ["core", "advanced", "integration", "performance"];

  for (const suiteName of suitesToLoad) {
    try {
      switch (suiteName) {
        case "core":
          require("./suites/core");
          break;
        case "advanced":
          require("./suites/advanced");
          break;
        case "integration":
          require("./suites/integration");
          break;
        case "performance":
          require("./suites/performance");
          break;
        default:
          console.warn(`⚠️  Suite inconnue: ${suiteName}`);
      }
    } catch (error) {
      console.warn(`⚠️  Erreur chargement suite ${suiteName}:`, error.message);
    }
  }
}

/**
 * Parse les arguments de ligne de commande
 */
function parseArguments(args) {
  const options = {
    suites: [], // Suites spécifiques à exécuter
    parallel: false, // Exécution en parallèle
    verbose: false, // Mode verbeux
    skipSetup: false, // Ignorer la configuration initiale
    timeout: 30000, // Timeout par défaut
    filter: null, // Filtre pour les noms de tests
    help: false, // Afficher l'aide
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--suite":
      case "-s":
        if (args[i + 1]) {
          options.suites.push(args[++i]);
        }
        break;

      case "--parallel":
      case "-p":
        options.parallel = true;
        break;

      case "--verbose":
      case "-v":
        options.verbose = true;
        break;

      case "--skip-setup":
        options.skipSetup = true;
        break;

      case "--timeout":
      case "-t":
        if (args[i + 1]) {
          options.timeout = parseInt(args[++i], 10);
        }
        break;

      case "--filter":
      case "-f":
        if (args[i + 1]) {
          options.filter = args[++i];
        }
        break;

      case "--help":
      case "-h":
        options.help = true;
        break;
    }
  }

  return options;
}

/**
 * Affiche l'aide
 */
function printHelp() {
  console.log(`
🧪 SocketCAN Test Runner

Usage:
  npm test                           # Exécute tous les tests
  node tests/index.js                # Même chose
  node tests/index.js --suite core   # Exécute une suite spécifique
  node tests/index.js --verbose      # Mode verbeux
  node tests/index.js --parallel     # Exécution en parallèle

Options:
  -s, --suite <name>     Exécute une suite spécifique (core, advanced, integration, performance)
  -p, --parallel         Exécute les tests en parallèle (plus rapide)
  -v, --verbose          Mode verbeux avec plus de détails
  --skip-setup          Ignore la configuration initiale
  -t, --timeout <ms>     Timeout pour chaque test (défaut: 30000ms)
  -f, --filter <pattern> Filtre les tests par nom
  -h, --help            Affiche cette aide

Suites disponibles:
  • core         - Tests de base et API principale
  • advanced     - Fonctionnalités avancées (CAN FD, filtres)
  • integration  - Tests d'intégration avec interfaces réelles
  • performance  - Tests de performance et charge

Examples:
  node tests/index.js --suite core --verbose
  node tests/index.js --parallel --filter "basic"
  node tests/index.js --suite advanced --timeout 60000
`);
}

// Démarrage du programme principal
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Erreur fatale:", error.message);
    if (process.env.NODE_ENV === "development") {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { main, parseArguments };
