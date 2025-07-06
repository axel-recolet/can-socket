#!/usr/bin/env ts-node

/**
 * Démo des nouvelles APIs événementielles et générateur asynchrone pour SocketCAN
 */

import SocketCAN, { SocketCANError } from "./src/socketcan";

async function demonstrateEventBasedAPI() {
  console.log("\n=== DÉMONSTRATION API ÉVÉNEMENTIELLE ===\n");

  const canInterface = process.argv[2] || "vcan0";
  const socket = new SocketCAN(canInterface);

  try {
    await socket.open();
    console.log(`Socket CAN ouvert sur l'interface: ${canInterface}`);

    // Configuration des événements
    socket.on("listening", () => {
      console.log("🎧 Début de l'écoute des trames CAN");
    });

    socket.on("frame", (frame) => {
      console.log(
        `📦 Trame reçue: ID=0x${frame.id
          .toString(16)
          .toUpperCase()}, Data=[${frame.data.join(", ")}]`
      );
    });

    socket.on("error", (error) => {
      console.error(`❌ Erreur: ${error.message}`);
    });

    socket.on("stopped", () => {
      console.log("🛑 Écoute arrêtée");
    });

    // Démarrer l'écoute
    console.log("Démarrage de l'écoute des trames...");
    await socket.startListening({ interval: 50 });

    // Simuler l'envoi de quelques trames en arrière-plan
    setTimeout(async () => {
      try {
        await socket.send(0x123, [0x01, 0x02, 0x03, 0x04]);
        await socket.send(0x456, [0xde, 0xad, 0xbe, 0xef]);
        await socket.send(0x789, [0xff]);
      } catch (error) {
        console.log(
          "Envoi de trames de test (peut échouer si pas de vcan configuré)"
        );
      }
    }, 1000);

    // Arrêter après 5 secondes
    setTimeout(() => {
      console.log("Arrêt de l'écoute...");
      socket.stopListening();
    }, 5000);

    // Attendre un peu avant de passer à la suite
    await new Promise((resolve) => setTimeout(resolve, 6000));
  } catch (error) {
    console.error(`Erreur lors de la démonstration événementielle: ${error}`);
  } finally {
    await socket.close();
  }
}

async function demonstrateAsyncGeneratorAPI() {
  console.log("\n=== DÉMONSTRATION API GÉNÉRATEUR ASYNCHRONE ===\n");

  const canInterface = process.argv[2] || "vcan0";
  const socket = new SocketCAN(canInterface);

  try {
    await socket.open();
    console.log(`Socket CAN ouvert sur l'interface: ${canInterface}`);

    // Démonstration 1: Générateur de base avec limite
    console.log("\n1. Collecte de 3 trames avec générateur de base:");

    // Simuler l'envoi de trames en arrière-plan
    const sendTestFrames = setInterval(async () => {
      try {
        const testData = [
          { id: 0x100, data: [Math.floor(Math.random() * 256)] },
          { id: 0x200, data: [0x01, 0x02] },
          { id: 0x300, data: [0xff, 0xee, 0xdd] },
        ];

        const frame = testData[Math.floor(Math.random() * testData.length)];
        await socket.send(frame.id, frame.data);
      } catch (error) {
        // Ignore les erreurs d'envoi pour cette démo
      }
    }, 200);

    try {
      let frameCount = 0;
      for await (const frame of socket.frames({ maxFrames: 3, timeout: 500 })) {
        frameCount++;
        console.log(
          `  Trame ${frameCount}: ID=0x${frame.id
            .toString(16)
            .toUpperCase()}, Data=[${frame.data.join(", ")}]`
        );
      }
    } catch (error) {
      console.log("  (Simulation - pas de trames reçues sur cette interface)");
    }

    clearInterval(sendTestFrames);

    // Démonstration 2: Générateur avec filtre par ID
    console.log("\n2. Écoute des trames avec ID 0x123:");

    setTimeout(async () => {
      try {
        await socket.send(0x123, [0x01, 0x02, 0x03]);
        await socket.send(0x456, [0x04, 0x05, 0x06]); // Cette trame sera ignorée
        await socket.send(0x123, [0x07, 0x08, 0x09]);
      } catch (error) {
        // Ignore pour la démo
      }
    }, 100);

    try {
      let frameCount = 0;
      for await (const frame of socket.framesWithId(0x123, {
        maxFrames: 2,
        timeout: 500,
      })) {
        frameCount++;
        console.log(
          `  Trame ${frameCount} avec ID 0x123: Data=[${frame.data.join(", ")}]`
        );
      }
    } catch (error) {
      console.log("  (Simulation - pas de trames avec ID 0x123 reçues)");
    }

    // Démonstration 3: Collecte de trames dans un tableau
    console.log("\n3. Collecte de trames dans un tableau:");

    try {
      const frames = await socket.collectFrames({
        maxFrames: 2,
        timeout: 500,
        filter: (frame) => frame.data.length > 0,
      });

      console.log(`  ${frames.length} trames collectées:`);
      frames.forEach((frame, index) => {
        console.log(
          `    ${index + 1}. ID=0x${frame.id
            .toString(16)
            .toUpperCase()}, Data=[${frame.data.join(", ")}]`
        );
      });
    } catch (error) {
      console.log("  (Simulation - pas de trames collectées)");
    }

    // Démonstration 4: Générateur par type de trame
    console.log("\n4. Écoute des trames de données uniquement:");

    try {
      let frameCount = 0;
      for await (const frame of socket.framesOfType("data", {
        maxFrames: 2,
        timeout: 500,
      })) {
        frameCount++;
        console.log(
          `  Trame de données ${frameCount}: ID=0x${frame.id
            .toString(16)
            .toUpperCase()}`
        );
      }
    } catch (error) {
      console.log("  (Simulation - pas de trames de données reçues)");
    }
  } catch (error) {
    console.error(`Erreur lors de la démonstration des générateurs: ${error}`);
  } finally {
    await socket.close();
  }
}

async function main() {
  console.log("🚀 DÉMONSTRATION DES NOUVELLES APIs SocketCAN");
  console.log("===============================================");

  const canInterface = process.argv[2] || "vcan0";
  console.log(`Interface CAN utilisée: ${canInterface}`);
  console.log(
    "(Pour tester avec une vraie interface, utilisez: npm run demo <interface>)"
  );

  try {
    // Tester les APIs événementielles
    await demonstrateEventBasedAPI();

    // Attendre un peu entre les démos
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Tester les APIs générateur asynchrone
    await demonstrateAsyncGeneratorAPI();

    console.log("\n✅ Démonstration terminée avec succès!");
    console.log("\nNouvelles fonctionnalités disponibles:");
    console.log(
      "  • API événementielle: startListening(), stopListening(), on('frame', ...)"
    );
    console.log(
      "  • Générateurs async: frames(), framesWithId(), framesOfType(), collectFrames()"
    );
    console.log("  • Support complet TypeScript avec typage strict");
  } catch (error) {
    console.error(`❌ Erreur during demo: ${error}`);
    process.exit(1);
  }
}

// Gestion des signaux pour un arrêt propre
process.on("SIGINT", () => {
  console.log("\nArrêt du programme...");
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}
