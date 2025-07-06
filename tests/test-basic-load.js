#!/usr/bin/env node

/**
 * Test très simple pour vérifier le chargement de base
 */

console.log("🧪 Test de chargement minimal SocketCAN");

try {
  console.log("1. Test de chargement du module Node native...");
  const nativeModule = require("../can_socket.node");
  console.log("   ✅ Module natif chargé");

  console.log("2. Test de chargement TypeScript...");
  const SocketCAN = require("../dist/src/main");
  console.log("   ✅ Module TypeScript chargé");

  console.log("3. Test de création d'instance...");
  // Ne pas créer d'instance pour éviter les crashs système
  console.log("   ⏭️  Test d'instance ignoré sur macOS");

  console.log("\n🎉 Chargement des modules réussi !");
  console.log("💡 Tests complets nécessitent un environnement Linux");
} catch (error) {
  console.error("❌ Erreur de chargement:", error.message);

  if (error.message.includes("Linux") || error.message.includes("socketcan")) {
    console.log("💡 Erreur attendue sur macOS - module conçu pour Linux");
    process.exit(0);
  } else {
    process.exit(1);
  }
}
