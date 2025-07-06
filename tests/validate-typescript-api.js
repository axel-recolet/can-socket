#!/usr/bin/env node

/**
 * Validation de l'API JavaScript générée depuis TypeScript
 *
 * Ce script valide que l'architecture TypeScript-first fonctionne correctement
 * et que l'API JavaScript générée est utilisable depuis différents contextes.
 */

console.log("🚀 Validation de l'API TypeScript → JavaScript\n");

let errors = 0;
let tests = 0;

function test(name, fn) {
  tests++;
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    errors++;
    console.log(`❌ ${name}: ${err.message}`);
  }
}

// Test 1: Import via index.js (wrapper)
test("Import via index.js wrapper", () => {
  const SocketCAN = require("../index.js");
  if (typeof SocketCAN !== "function") {
    throw new Error("SocketCAN is not a function");
  }
  if (typeof SocketCAN.SocketCAN !== "function") {
    throw new Error("SocketCAN.SocketCAN is not available");
  }
});

// Test 2: Import direct du module compilé
test("Import direct du module compilé", () => {
  const { SocketCAN } = require("../dist/src/main.js");
  if (typeof SocketCAN !== "function") {
    throw new Error("SocketCAN not found in compiled module");
  }
});

// Test 3: Vérification des types exportés
test("Types exportés disponibles", () => {
  const exports = require("../dist/src/main.js");
  const expectedExports = ["SocketCAN", "SocketCANError", "CAN_CONSTANTS"];

  for (const exp of expectedExports) {
    if (!(exp in exports)) {
      throw new Error(`Export ${exp} missing`);
    }
  }
});

// Test 4: Instantiation de SocketCAN
test("Instantiation de SocketCAN", () => {
  const SocketCAN = require("../index.js");
  const can = new SocketCAN("vcan0");

  if (!can) {
    throw new Error("Failed to create SocketCAN instance");
  }

  if (can.interfaceName !== "vcan0") {
    throw new Error("Interface name not set correctly");
  }
});

// Test 5: Instantiation avec options
test("Instantiation avec options CAN FD", () => {
  const SocketCAN = require("../index.js");
  const can = new SocketCAN("vcan0", { canFd: true });

  if (!can.canFd) {
    throw new Error("CAN FD option not set");
  }
});

// Test 6: Méthodes disponibles
test("Méthodes de base disponibles", () => {
  const SocketCAN = require("../index.js");
  const can = new SocketCAN("vcan0");

  const requiredMethods = ["open", "close", "send", "receive", "setFilters"];

  for (const method of requiredMethods) {
    if (typeof can[method] !== "function") {
      throw new Error(`Method ${method} not available`);
    }
  }
});

// Test 7: Constantes disponibles
test("Constantes CAN disponibles", () => {
  const exports = require("../dist/src/main.js");

  if (!exports.CAN_CONSTANTS) {
    throw new Error("CAN_CONSTANTS not exported");
  }

  const constants = exports.CAN_CONSTANTS;
  const requiredConstants = [
    "MAX_STANDARD_ID",
    "MAX_EXTENDED_ID",
    "MAX_DATA_LENGTH",
  ];

  for (const constant of requiredConstants) {
    if (!(constant in constants)) {
      throw new Error(`Constant ${constant} missing`);
    }
  }
});

// Test 8: Gestion d'erreurs
test("Classes d'erreur disponibles", () => {
  const { SocketCANError } = require("../dist/src/main.js");

  if (typeof SocketCANError !== "function") {
    throw new Error("SocketCANError class not available");
  }
});

// Test 9: Validation du package.json
test("Configuration package.json", () => {
  const pkg = require("../package.json");

  if (pkg.main !== "dist/src/main.js") {
    throw new Error(
      `package.json main should be 'dist/src/main.js', got '${pkg.main}'`
    );
  }

  if (pkg.types !== "dist/src/main.d.ts") {
    throw new Error(
      `package.json types should be 'dist/src/main.d.ts', got '${pkg.types}'`
    );
  }
});

// Test 10: Fichiers de déclaration TypeScript
test("Fichiers de déclaration TypeScript", () => {
  const fs = require("fs");

  if (!fs.existsSync("./dist/src/main.d.ts")) {
    throw new Error("main.d.ts declaration file missing");
  }

  if (!fs.existsSync("./dist/src/socketcan.d.ts")) {
    throw new Error("socketcan.d.ts declaration file missing");
  }
});

console.log(`\n📊 Résultats: ${tests - errors}/${tests} tests réussis`);

if (errors > 0) {
  console.log(`❌ ${errors} erreur(s) détectée(s)`);
  process.exit(1);
} else {
  console.log("🎉 Toutes les validations sont passées !");
  console.log(
    "\n✨ L'API JavaScript est correctement générée depuis TypeScript"
  );
  console.log(
    "🔧 Vous pouvez maintenant utiliser exclusivement TypeScript pour le développement"
  );
  console.log("📦 Les fichiers JavaScript sont générés automatiquement");
}
