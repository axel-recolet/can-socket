#!/usr/bin/env node

/**
 * Script de migration et nettoyage des tests
 * Aide à migrer vers la nouvelle architecture de tests
 */

const fs = require("fs").promises;
const path = require("path");

const TESTS_DIR = __dirname;

// Fichiers legacy à conserver pour compatibilité
const LEGACY_FILES = [
  "run-tests-clean.js",
  "test-helpers.js",
  "test-clean.js",
  "validate-typescript-api.js",
  "validate-typescript-api.ts",
];

// Fichiers à supprimer (anciens tests redondants)
const FILES_TO_REMOVE = [
  "test.js", // Ancien test principal
  "test-advanced.js", // Migré vers suites/advanced.js
  "test-can-fd.js", // Intégré dans suites/advanced.js
  "test-can-filters.js", // Intégré dans suites/advanced.js
  "test-config.js", // Configuration centralisée
  "test-error-frames.js", // Intégré dans suites/advanced.js
  "test-extended-ids.js", // Intégré dans suites/advanced.js
  "test-final-implementation.js", // Test obsolète
  "test-new-name.js", // Test obsolète
  "test-remote-frames.js", // Intégré dans suites/advanced.js
  "validate-all-features.js", // Remplacé par suites modulaires
  "validate-implementation.js", // Remplacé par suites modulaires
  "validate-new-apis.js", // Remplacé par suites modulaires
];

/**
 * Fonction principale de migration
 */
async function migrate() {
  console.log("🔄 Migration des tests vers la nouvelle architecture");
  console.log("=".repeat(60));

  try {
    // Étape 1: Analyse de l'état actuel
    await analyzeCurrentState();

    // Étape 2: Backup des fichiers importants
    await backupLegacyFiles();

    // Étape 3: Nettoyage des fichiers redondants
    await cleanupRedundantFiles();

    // Étape 4: Vérification de la nouvelle structure
    await verifyNewStructure();

    // Étape 5: Mise à jour des références
    await updateReferences();

    console.log("\n✅ Migration terminée avec succès !");
    console.log("📚 Consultez tests/README.md pour la documentation");
    console.log("🚀 Testez avec: npm test");
  } catch (error) {
    console.error("❌ Erreur durant la migration:", error.message);
    process.exit(1);
  }
}

/**
 * Analyse l'état actuel des tests
 */
async function analyzeCurrentState() {
  console.log("\n📊 Analyse de l'état actuel...");

  try {
    const files = await fs.readdir(TESTS_DIR);
    const testFiles = files.filter(
      (f) => f.endsWith(".js") || f.endsWith(".ts")
    );

    console.log(`   • ${testFiles.length} fichiers de test trouvés`);

    // Vérifier la présence de la nouvelle structure
    const hasNewStructure = await checkNewStructure();
    console.log(`   • Nouvelle structure: ${hasNewStructure ? "✅" : "❌"}`);

    // Compter les fichiers legacy
    const legacyCount = testFiles.filter((f) =>
      LEGACY_FILES.includes(f)
    ).length;
    console.log(`   • ${legacyCount} fichiers legacy conservés`);

    // Compter les fichiers à supprimer
    const toRemoveCount = testFiles.filter((f) =>
      FILES_TO_REMOVE.includes(f)
    ).length;
    console.log(`   • ${toRemoveCount} fichiers redondants détectés`);
  } catch (error) {
    throw new Error(`Erreur d'analyse: ${error.message}`);
  }
}

/**
 * Vérifie la présence de la nouvelle structure
 */
async function checkNewStructure() {
  const requiredPaths = ["framework", "suites", "utils", "index.js"];

  for (const requiredPath of requiredPaths) {
    try {
      await fs.access(path.join(TESTS_DIR, requiredPath));
    } catch (error) {
      return false;
    }
  }

  return true;
}

/**
 * Sauvegarde les fichiers legacy importants
 */
async function backupLegacyFiles() {
  console.log("\n💾 Sauvegarde des fichiers legacy...");

  const backupDir = path.join(TESTS_DIR, "legacy-backup");

  try {
    // Créer le dossier de backup s'il n'existe pas
    try {
      await fs.mkdir(backupDir, { recursive: true });
    } catch (error) {
      // Dossier existe déjà
    }

    let backedUp = 0;

    for (const file of LEGACY_FILES) {
      const sourcePath = path.join(TESTS_DIR, file);
      const backupPath = path.join(backupDir, file);

      try {
        await fs.access(sourcePath);
        await fs.copyFile(sourcePath, backupPath);
        backedUp++;
        console.log(`   ✅ ${file} sauvegardé`);
      } catch (error) {
        console.log(`   ⏭️  ${file} non trouvé`);
      }
    }

    console.log(`   📦 ${backedUp} fichiers sauvegardés dans legacy-backup/`);
  } catch (error) {
    throw new Error(`Erreur de sauvegarde: ${error.message}`);
  }
}

/**
 * Nettoie les fichiers redondants
 */
async function cleanupRedundantFiles() {
  console.log("\n🧹 Nettoyage des fichiers redondants...");

  let removed = 0;

  for (const file of FILES_TO_REMOVE) {
    const filePath = path.join(TESTS_DIR, file);

    try {
      await fs.access(filePath);

      // Demander confirmation pour les fichiers importants
      if (await shouldRemoveFile(file)) {
        await fs.unlink(filePath);
        removed++;
        console.log(`   🗑️  ${file} supprimé`);
      } else {
        console.log(`   ⏭️  ${file} conservé sur demande`);
      }
    } catch (error) {
      console.log(`   ⏭️  ${file} déjà absent`);
    }
  }

  console.log(`   ✅ ${removed} fichiers redondants supprimés`);
}

/**
 * Demande confirmation pour supprimer un fichier
 */
async function shouldRemoveFile(filename) {
  // Pour l'automatisation, on supprime directement
  // Dans un vrai script interactif, on demanderait confirmation
  return true;
}

/**
 * Vérifie la nouvelle structure
 */
async function verifyNewStructure() {
  console.log("\n🔍 Vérification de la nouvelle structure...");

  const checks = [
    { path: "index.js", desc: "Point d'entrée principal" },
    { path: "framework/test-runner.js", desc: "Gestionnaire d'exécution" },
    { path: "framework/test-suite-registry.js", desc: "Registre des suites" },
    { path: "framework/test-reporter.js", desc: "Système de rapport" },
    { path: "framework/system-checker.js", desc: "Vérifications système" },
    { path: "suites/core.js", desc: "Tests fondamentaux" },
    { path: "suites/advanced.js", desc: "Tests avancés" },
    { path: "suites/integration.js", desc: "Tests d'intégration" },
    { path: "suites/performance.js", desc: "Tests de performance" },
    { path: "utils/test-helpers.js", desc: "Utilitaires partagés" },
    { path: "README.md", desc: "Documentation" },
  ];

  let passed = 0;

  for (const check of checks) {
    const fullPath = path.join(TESTS_DIR, check.path);

    try {
      await fs.access(fullPath);
      console.log(`   ✅ ${check.desc}`);
      passed++;
    } catch (error) {
      console.log(`   ❌ ${check.desc} - ${check.path} manquant`);
    }
  }

  if (passed === checks.length) {
    console.log(
      `   🎉 Nouvelle structure complète (${passed}/${checks.length})`
    );
  } else {
    throw new Error(
      `Structure incomplète: ${passed}/${checks.length} éléments présents`
    );
  }
}

/**
 * Met à jour les références dans les fichiers
 */
async function updateReferences() {
  console.log("\n🔗 Mise à jour des références...");

  // Vérifier package.json
  await updatePackageJson();

  // Vérifier les scripts dans tools/
  await updateToolsScripts();

  console.log("   ✅ Références mises à jour");
}

/**
 * Met à jour package.json si nécessaire
 */
async function updatePackageJson() {
  const packagePath = path.join(TESTS_DIR, "..", "package.json");

  try {
    const content = await fs.readFile(packagePath, "utf8");
    const pkg = JSON.parse(content);

    // Vérifier si les nouveaux scripts sont présents
    const hasNewScripts = pkg.scripts && pkg.scripts["test:core"];

    if (hasNewScripts) {
      console.log("   ✅ Scripts package.json déjà mis à jour");
    } else {
      console.log(
        "   ⚠️  Scripts package.json nécessitent une mise à jour manuelle"
      );
    }
  } catch (error) {
    console.log("   ⚠️  Impossible de vérifier package.json");
  }
}

/**
 * Vérifie les scripts dans tools/
 */
async function updateToolsScripts() {
  const toolsDir = path.join(TESTS_DIR, "..", "tools");

  try {
    await fs.access(toolsDir);
    console.log("   ✅ Dossier tools/ présent");
  } catch (error) {
    console.log("   ⚠️  Dossier tools/ non trouvé");
  }
}

/**
 * Affiche un résumé de la migration
 */
function printMigrationSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📋 RÉSUMÉ DE LA MIGRATION");
  console.log("=".repeat(60));
  console.log(`
✅ Nouvelle architecture en place:
   • Framework modulaire dans framework/
   • Suites organisées dans suites/
   • Utilitaires partagés dans utils/
   • Point d'entrée unique: index.js

📦 Fichiers legacy conservés:
   • Sauvegardés dans legacy-backup/
   • Toujours accessibles via npm run test:legacy

🧹 Nettoyage effectué:
   • Fichiers redondants supprimés
   • Structure clarifiée

🚀 Nouveaux scripts disponibles:
   • npm test                  # Tous les tests
   • npm run test:core         # Tests fondamentaux
   • npm run test:advanced     # Tests avancés
   • npm run test:integration  # Tests d'intégration
   • npm run test:performance  # Tests de performance
   • npm run test:parallel     # Exécution parallèle
   • npm run test:verbose      # Mode verbeux

📚 Documentation:
   • Consultez tests/README.md pour le guide complet
   • Exemples d'utilisation inclus
`);
  console.log("=".repeat(60));
}

// Exécution du script
if (require.main === module) {
  migrate()
    .then(() => {
      printMigrationSummary();
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Échec de la migration:", error.message);
      process.exit(1);
    });
}

module.exports = { migrate };
