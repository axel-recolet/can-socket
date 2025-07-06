#!/usr/bin/env node

/**
 * Script pour exécuter tous les tests du projet can-socket
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const testsDir = path.join(__dirname, "tests");

// Liste des tests à exécuter
const tests = [
  "test.js",
  "test-can-fd.js",
  "test-can-filters.js",
  "test-error-frames.js",
  "test-extended-ids.js",
  "test-remote-frames.js",
  "test-final-implementation.js",
  "test-new-name.js",
];

// Liste des validations à exécuter
const validations = [
  "validate-all-features.js",
  "validate-implementation.js",
  "validate-new-apis.js",
  "validate-typescript-api.js",
];

async function runTest(testFile) {
  return new Promise((resolve) => {
    const testPath = path.join(testsDir, testFile);
    if (!fs.existsSync(testPath)) {
      console.log(`❌ ${testFile} - fichier non trouvé`);
      resolve(false);
      return;
    }

    console.log(`🧪 Exécution de ${testFile}...`);
    const child = spawn("node", [testPath], {
      stdio: "pipe",
      cwd: __dirname,
    });

    let output = "";
    let error = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      error += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${testFile} - réussi`);
      } else {
        console.log(`❌ ${testFile} - échec (code ${code})`);
        if (error) {
          console.log(`   Erreur: ${error.trim()}`);
        }
      }
      resolve(code === 0);
    });
  });
}

async function runAllTests() {
  console.log("=== Exécution des tests can-socket ===\n");

  console.log("📋 Tests de base:");
  let successCount = 0;
  let totalCount = 0;

  for (const test of tests) {
    totalCount++;
    const success = await runTest(test);
    if (success) successCount++;
  }

  console.log("\n📋 Validations:");
  for (const validation of validations) {
    totalCount++;
    const success = await runTest(validation);
    if (success) successCount++;
  }

  console.log(`\n=== Résumé ===`);
  console.log(`✅ Tests réussis: ${successCount}/${totalCount}`);
  console.log(`❌ Tests échoués: ${totalCount - successCount}/${totalCount}`);

  if (successCount === totalCount) {
    console.log("🎉 Tous les tests sont passés !");
  } else {
    console.log(
      "⚠️  Certains tests ont échoué. Vérifiez les détails ci-dessus."
    );
    console.log(
      "\nNote: Les tests nécessitent un environnement Linux avec SocketCAN configuré."
    );
  }
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, runTest };
