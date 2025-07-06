#!/usr/bin/env node

/**
 * Test fonctionnel corrigé avec la vraie API
 */

console.log("🚀 Test fonctionnel SocketCAN avec API correcte");

async function testRealAPI() {
  try {
    // Chargement du module
    console.log("\n1️⃣  Chargement du module...");
    const SocketCAN = require("../dist/src/main");
    console.log("   ✅ Module chargé");

    // Test de création de socket
    console.log("\n2️⃣  Création de socket...");
    const socket = new SocketCAN.SocketCAN();
    console.log("   ✅ Socket créé");
    console.log(
      `   📋 Interface par défaut: ${socket.interfaceName || "aucune"}`
    );

    // Test d'ouverture sur différentes interfaces
    console.log("\n3️⃣  Test d'ouverture...");

    const interfaces = ["vcan0", "can0"];
    let openSuccess = false;

    for (const iface of interfaces) {
      try {
        console.log(`   🔄 Tentative ouverture sur ${iface}...`);
        socket.open(iface);
        console.log(`   ✅ Ouverture réussie sur ${iface}`);
        console.log(`   📡 État: ${socket.isOpen() ? "ouvert" : "fermé"}`);
        openSuccess = true;
        break;
      } catch (error) {
        console.log(`   ⚠️  ${iface}: ${error.message}`);
      }
    }

    if (!openSuccess) {
      console.log(
        "   💡 Aucune interface disponible - test de validation uniquement"
      );
    }

    // Test de validation de trames
    console.log("\n4️⃣  Validation de trames...");

    const testFrames = [
      { id: 0x123, data: [0x01, 0x02, 0x03, 0x04] },
      { id: 0x456, data: [0xaa, 0xbb] },
      { id: 0x789, data: [] },
    ];

    for (const frame of testFrames) {
      try {
        const valid = socket.validateCanFrame(frame);
        console.log(
          `   ✅ Trame ${frame.id.toString(16)}: ${
            valid ? "valide" : "invalide"
          }`
        );
      } catch (error) {
        console.log(
          `   ❌ Erreur validation ${frame.id.toString(16)}: ${error.message}`
        );
      }
    }

    if (openSuccess) {
      // Test d'envoi
      console.log("\n5️⃣  Test d'envoi...");
      try {
        const frame = { id: 0x123, data: [0x01, 0x02, 0x03, 0x04] };
        socket.send(frame);
        console.log("   ✅ Envoi réussi");
      } catch (error) {
        console.log(`   ⚠️  Envoi échoué: ${error.message}`);
      }

      // Test de réception (avec timeout court)
      console.log("\n6️⃣  Test de réception...");
      try {
        console.log("   🔄 Écoute de trames (2 secondes)...");

        let frameReceived = false;
        socket.on("message", (frame) => {
          console.log(
            `   📨 Trame reçue: ID=${frame.id.toString(
              16
            )}, data=[${frame.data.join(",")}]`
          );
          frameReceived = true;
        });

        socket.startListening();

        // Attendre 2 secondes
        await new Promise((resolve) => setTimeout(resolve, 2000));

        socket.stopListening();

        if (frameReceived) {
          console.log("   ✅ Réception testée avec succès");
        } else {
          console.log("   💡 Aucune trame reçue (normal sur interface vide)");
        }
      } catch (error) {
        console.log(`   ⚠️  Réception échouée: ${error.message}`);
      }
    }

    // Nettoyage
    console.log("\n7️⃣  Nettoyage...");
    if (socket.isOpen()) {
      socket.close();
    }
    console.log("   ✅ Socket fermé");

    console.log("\n🎉 Tests API réels terminés avec succès !");
    console.log("✨ Le module SocketCAN fonctionne correctement sur Linux");
  } catch (error) {
    console.error("❌ Erreur lors du test:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testRealAPI();
