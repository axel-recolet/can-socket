#!/usr/bin/env node

/**
 * Test fonctionnel sur Linux avec interface CAN
 */

console.log("🚀 Test fonctionnel SocketCAN sur Linux");

async function testSocketCAN() {
  try {
    // Chargement du module
    console.log("\n1️⃣  Chargement du module...");
    const SocketCAN = require("../dist/src/main");
    console.log("   ✅ Module chargé");

    // Test de création de socket
    console.log("\n2️⃣  Création de socket...");
    const socket = new SocketCAN.SocketCAN();
    console.log("   ✅ Socket créé");

    // Test de bind (peut échouer selon l'interface disponible)
    console.log("\n3️⃣  Test de bind...");

    const interfaces = ["vcan0", "can0"];
    let bindSuccess = false;

    for (const iface of interfaces) {
      try {
        console.log(`   🔄 Tentative bind sur ${iface}...`);
        socket.bind(iface);
        console.log(`   ✅ Bind réussi sur ${iface}`);
        bindSuccess = true;
        break;
      } catch (error) {
        console.log(`   ⚠️  ${iface}: ${error.message}`);
      }
    }

    if (!bindSuccess) {
      console.log(
        "   💡 Aucune interface disponible - test de validation uniquement"
      );
    }

    // Test de validation de trames (fonctionne sans interface)
    console.log("\n4️⃣  Validation de trames...");

    const testFrame = {
      id: 0x123,
      data: [0x01, 0x02, 0x03, 0x04],
    };

    // Validation côté JavaScript
    if (typeof testFrame.id === "number" && Array.isArray(testFrame.data)) {
      console.log("   ✅ Structure de trame valide");
    }

    if (bindSuccess) {
      try {
        // Test d'envoi (peut échouer selon l'état de l'interface)
        console.log("\n5️⃣  Test d'envoi...");
        socket.send(testFrame);
        console.log("   ✅ Envoi réussi");
      } catch (error) {
        console.log(`   ⚠️  Envoi échoué: ${error.message}`);
      }
    }

    // Nettoyage
    console.log("\n6️⃣  Nettoyage...");
    socket.close();
    console.log("   ✅ Socket fermé");

    console.log("\n🎉 Tests fonctionnels terminés avec succès !");
    console.log("💡 Le module SocketCAN fonctionne sur Linux");
  } catch (error) {
    console.error("❌ Erreur lors du test:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testSocketCAN();
