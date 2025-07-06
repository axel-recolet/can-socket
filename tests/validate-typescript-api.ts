#!/usr/bin/env ts-node

/**
 * Test de validation TypeScript pour les nouvelles APIs
 * Ce fichier teste que tous les types sont corrects et que l'API est utilisable
 */

import SocketCAN, { SocketCANError } from "../src/socketcan";
import { AnyCanFrame } from "../types/socketcan";

// Importer l'interface d'événements
interface SocketCANEvents {
  frame: (frame: AnyCanFrame) => void;
  error: (error: SocketCANError) => void;
  close: () => void;
  listening: () => void;
  stopped: () => void;
}

// Test des types d'événements
function testEventTypes() {
  const socket = new SocketCAN("vcan0");

  // Test que les types d'événements sont corrects
  socket.on("frame", (frame: AnyCanFrame) => {
    // frame devrait être typé comme AnyCanFrame
    console.log(`Frame ID: 0x${frame.id.toString(16)}`);
    console.log(`Data: [${frame.data.join(", ")}]`);

    // Test des propriétés optionnelles
    if (frame.error) {
      console.log("Error frame detected");
    }
    if (frame.remote) {
      console.log("Remote frame detected");
    }
    if (frame.fd) {
      console.log("CAN FD frame detected");
    }
  });

  socket.on("error", (error: SocketCANError) => {
    // error devrait être typé comme SocketCANError
    console.log(`Error [${error.code}]: ${error.message}`);
  });

  socket.on("listening", () => {
    console.log("Listening started");
  });

  socket.on("stopped", () => {
    console.log("Listening stopped");
  });

  socket.on("close", () => {
    console.log("Socket closed");
  });
}

// Test des types pour les générateurs asynchrones
async function testGeneratorTypes() {
  const socket = new SocketCAN("vcan0");

  try {
    await socket.open();

    // Test frames() - devrait retourner AsyncGenerator<AnyCanFrame>
    for await (const frame of socket.frames({ maxFrames: 3 })) {
      // frame devrait être typé comme AnyCanFrame
      const frameId: number = frame.id;
      const frameData: number[] = frame.data;
      const isExtended: boolean = frame.extended || false;

      console.log(
        `Frame: ${frameId}, ${frameData.length} bytes, extended: ${isExtended}`
      );
    }

    // Test framesWithId() - devrait accepter number ou CanId
    for await (const frame of socket.framesWithId(0x123, { maxFrames: 2 })) {
      // frame devrait être typé comme AnyCanFrame
      console.log(`Frame with ID 0x123: ${frame.data}`);
    }

    // Test framesOfType() - devrait être générique
    for await (const dataFrame of socket.framesOfType("data", {
      maxFrames: 2,
    })) {
      // dataFrame devrait être typé selon le type spécifié
      console.log(`Data frame: ${dataFrame.id}`);
    }

    for await (const errorFrame of socket.framesOfType("error", {
      maxFrames: 1,
    })) {
      // errorFrame devrait être typé pour les frames d'erreur
      console.log(`Error frame: ${errorFrame.id}`);
    }

    // Test collectFrames() - devrait retourner Promise<AnyCanFrame[]>
    const frames: AnyCanFrame[] = await socket.collectFrames({
      maxFrames: 5,
      filter: (frame: AnyCanFrame) => frame.data.length > 0,
    });

    console.log(`Collected ${frames.length} frames`);

    // Test des options typées
    const framesWithTimeout = socket.frames({
      timeout: 1000,
      maxFrames: 10,
      filter: (f) => f.id < 0x800,
    });

    // Test que c'est bien un AsyncGenerator
    const generator = framesWithTimeout[Symbol.asyncIterator]();
    const result = await generator.next();

    if (!result.done && result.value) {
      const frame: AnyCanFrame = result.value;
      console.log(`Generator test: ${frame.id}`);
    }
  } finally {
    await socket.close();
  }
}

// Test des méthodes de contrôle d'écoute
async function testListeningControl() {
  const socket = new SocketCAN("vcan0");

  try {
    await socket.open();

    // Test des types de retour
    const isListeningBefore: boolean = socket.isListening;
    console.log(`Initially listening: ${isListeningBefore}`);

    // startListening devrait retourner Promise<void>
    const startPromise: Promise<void> = socket.startListening({
      interval: 100,
    });
    await startPromise;

    const isListeningAfter: boolean = socket.isListening;
    console.log(`After start: ${isListeningAfter}`);

    // stopListening devrait retourner void
    const stopResult: void = socket.stopListening();
    console.log(`Stop result type: ${typeof stopResult}`);
  } finally {
    await socket.close();
  }
}

// Test des interfaces d'événements
function testEventInterface() {
  const socket = new SocketCAN("vcan0");

  // Test que l'interface SocketCANEvents est correcte
  const events: SocketCANEvents = {
    frame: (frame: AnyCanFrame) => console.log(frame),
    error: (error: SocketCANError) => console.error(error),
    close: () => console.log("closed"),
    listening: () => console.log("listening"),
    stopped: () => console.log("stopped"),
  };

  // Test que les méthodes EventEmitter sont typées
  socket.on("frame", events.frame);
  socket.once("error", events.error);
  socket.off("listening", events.listening);

  // Test emit avec les bons types
  const frame: AnyCanFrame = {
    id: 0x123,
    data: [1, 2, 3],
    extended: false,
  };

  const emitResult: boolean = socket.emit("frame", frame);
  console.log(`Emit result: ${emitResult}`);
}

// Test principal
async function main() {
  console.log("🔍 VALIDATION DES TYPES TYPESCRIPT");
  console.log("==================================");

  try {
    console.log("\n1. Test des types d'événements...");
    testEventTypes();
    console.log("✅ Types d'événements validés");

    console.log("\n2. Test des types de générateurs...");
    await testGeneratorTypes();
    console.log("✅ Types de générateurs validés");

    console.log("\n3. Test du contrôle d'écoute...");
    await testListeningControl();
    console.log("✅ Types de contrôle d'écoute validés");

    console.log("\n4. Test des interfaces d'événements...");
    testEventInterface();
    console.log("✅ Types d'interfaces validés");

    console.log("\n🎉 TOUS LES TYPES TYPESCRIPT SONT CORRECTS");
    console.log("\nLes nouvelles APIs offrent:");
    console.log("  • Typage strict pour tous les événements");
    console.log("  • Générateurs asynchrones entièrement typés");
    console.log("  • Support complet des types AnyCanFrame");
    console.log("  • Interfaces d'événements type-safe");
  } catch (error) {
    console.error("❌ Erreur de validation TypeScript:", error);
    if (error instanceof Error) {
      console.error("Details:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
