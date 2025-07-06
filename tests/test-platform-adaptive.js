#!/usr/bin/env node

/**
 * Test adaptatif selon la plateforme
 */

console.log("🧪 Test SocketCAN adaptatif");
console.log(`🖥️  Plateforme: ${process.platform}`);

if (process.platform !== "linux") {
  console.log("⚠️  SocketCAN nécessite Linux - Tests adaptés pour macOS");

  try {
    console.log("\n1. Test de structure des fichiers...");
    const fs = require("fs");
    const path = require("path");

    // Vérification des fichiers essentiels
    const essentialFiles = [
      "can_socket.node",
      "dist/src/main.js",
      "dist/src/main.d.ts",
      "dist/src/socketcan.js",
      "package.json",
    ];

    let filesOk = 0;
    for (const file of essentialFiles) {
      const fullPath = path.join(__dirname, "..", file);
      if (fs.existsSync(fullPath)) {
        filesOk++;
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} manquant`);
      }
    }

    console.log(
      `\n2. Résultats: ${filesOk}/${essentialFiles.length} fichiers présents`
    );

    if (filesOk === essentialFiles.length) {
      console.log("\n🎉 Structure du projet correcte !");
      console.log("💡 Module prêt pour les tests sur Linux");
      console.log("\n📋 Pour tester complètement:");
      console.log("   • Déployez sur un système Linux");
      console.log("   • Exécutez: npm test");
      console.log("   • Ou: npm run test:core");
    } else {
      console.log("\n⚠️  Structure incomplète - vérifiez la compilation");
    }
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  }
} else {
  console.log("🐧 Système Linux détecté - Tests complets disponibles");

  try {
    // Sur Linux, on peut tester le chargement
    console.log("\n1. Test de chargement du module...");
    const SocketCAN = require("../dist/src/main");
    console.log("   ✅ Module chargé avec succès");

    // Tests basiques sans interface CAN
    console.log("\n2. Tests de validation...");

    // Test de création (peut échouer sans interface)
    try {
      const socket = new SocketCAN.SocketCAN();
      console.log("   ✅ Socket créé");
      socket.close();
      console.log("   ✅ Socket fermé");
    } catch (error) {
      if (
        error.message.includes("interface") ||
        error.message.includes("device")
      ) {
        console.log("   ⚠️  Interface CAN non disponible (normal)");
      } else {
        throw error;
      }
    }

    console.log("\n🎉 Tests Linux basiques réussis !");
  } catch (error) {
    console.error("❌ Erreur sur Linux:", error.message);
    process.exit(1);
  }
}
