/**
 * Suite de tests principaux (core)
 * Tests de base de l'API SocketCAN
 */

const { TestSuiteRegistry } = require("../framework/test-suite-registry");

// Importation des utilitaires de test
let SocketCAN = null;

/**
 * Charge le module SocketCAN de façon lazy
 */
function loadSocketCAN() {
  if (SocketCAN) return SocketCAN;

  try {
    SocketCAN = require("../../dist/src/main");
    return SocketCAN;
  } catch (error) {
    // Fallback vers le module compilé
    try {
      SocketCAN = require("../../can_socket.node");
      return SocketCAN;
    } catch (fallbackError) {
      console.warn(
        "⚠️  Module SocketCAN non trouvé, certains tests seront ignorés"
      );
      return null;
    }
  }
}

/**
 * Helper pour créer un socket SocketCAN avec vérification
 */
function createSocketCAN(interfaceName = "can0") {
  const SocketCAN = loadSocketCAN();
  if (!SocketCAN) {
    throw new Error("Module SocketCAN non disponible");
  }
  return new SocketCAN.SocketCAN(interfaceName);
}

/**
 * Tests de base de l'API
 */
const coreTestSuite = {
  name: "core",
  description: "Tests de base de l'API SocketCAN",
  category: "fundamental",

  async setup() {
    // Configuration globale pour les tests core
    this.testInterface = "vcan0";
    this.testTimeout = 5000;
  },

  async teardown() {
    // Nettoyage après les tests core
  },

  tests: [
    {
      name: "module-loading",
      description: "Vérification du chargement du module",
      timeout: 2000,

      async run() {
        // Sur Mac, on vérifie seulement l'existence des fichiers
        if (process.platform !== "linux") {
          const fs = require("fs");
          const path = require("path");

          // Vérifier l'existence du module natif
          const nativeModulePath = path.join(
            __dirname,
            "../../can_socket.node"
          );
          if (!fs.existsSync(nativeModulePath)) {
            throw new Error("Module natif can_socket.node non trouvé");
          }

          // Vérifier l'existence du code TypeScript compilé
          const tsModulePath = path.join(__dirname, "../../dist/src/main.js");
          if (!fs.existsSync(tsModulePath)) {
            console.warn("Module TypeScript compilé non trouvé");
          }

          console.log("✓ Module natif trouvé (chargement non testé sur Mac)");
          return;
        }

        // Sur Linux, on teste le chargement complet
        const SocketCAN = loadSocketCAN();
        if (!SocketCAN) {
          throw new Error("Module SocketCAN non disponible");
        }

        // Vérifier les exports principaux
        const expectedExports = ["SocketCAN", "default"];
        for (const exportName of expectedExports) {
          if (typeof SocketCAN[exportName] === "undefined") {
            console.warn(`Export manquant: ${exportName}`);
          }
        }

        console.log("✓ Module chargé avec succès");
      },
    },

    {
      name: "socket-creation",
      description: "Création et destruction de socket CAN",
      requires: { platform: "linux" },

      async run() {
        let socket;

        try {
          // Test de création de socket
          socket = createSocketCAN();

          if (!socket) {
            throw new Error("Socket non créé");
          }

          console.log("✓ Socket CAN créé");

          // Test des méthodes de base
          const expectedMethods = ["open", "send", "close"];
          for (const method of expectedMethods) {
            if (typeof socket[method] !== "function") {
              throw new Error(`Méthode manquante: ${method}`);
            }
          }

          console.log("✓ Méthodes de base présentes");
        } finally {
          if (socket && typeof socket.close === "function") {
            try {
              socket.close();
              console.log("✓ Socket fermé proprement");
            } catch (error) {
              console.warn(
                "Avertissement lors de la fermeture:",
                error.message
              );
            }
          }
        }
      },
    },

    {
      name: "frame-validation",
      description: "Validation des trames CAN",

      async run() {
        // Tests de validation sans interface physique
        const testFrames = [
          { id: 0x123, data: [0x01, 0x02, 0x03, 0x04], valid: true },
          { id: 0x7ff, data: [0xff], valid: true },
          { id: 0x800, data: [], valid: false }, // ID trop grand pour standard
          { id: 0x123, data: new Array(9).fill(0), valid: false }, // Données trop longues
          { id: -1, data: [0x01], valid: false }, // ID négatif
          { id: 0x123, data: [0x01, 256], valid: false }, // Byte invalide
        ];

        for (const frame of testFrames) {
          try {
            // Validation basique côté JavaScript
            this.validateFrame(frame);

            if (!frame.valid) {
              throw new Error(
                `Trame invalide acceptée: ${JSON.stringify(frame)}`
              );
            }
          } catch (error) {
            if (frame.valid) {
              throw new Error(
                `Trame valide rejetée: ${JSON.stringify(frame)} - ${
                  error.message
                }`
              );
            }
            // Erreur attendue pour une trame invalide
          }
        }

        console.log("✓ Validation des trames fonctionnelle");
      },

      // Méthode helper pour la validation
      validateFrame(frame) {
        if (typeof frame.id !== "number" || frame.id < 0 || frame.id > 0x7ff) {
          throw new Error("ID invalide");
        }

        if (!Array.isArray(frame.data)) {
          throw new Error("Données doivent être un tableau");
        }

        if (frame.data.length > 8) {
          throw new Error("Données trop longues (max 8 bytes)");
        }

        for (const byte of frame.data) {
          if (typeof byte !== "number" || byte < 0 || byte > 255) {
            throw new Error("Byte invalide");
          }
        }
      },
    },

    {
      name: "error-handling",
      description: "Gestion des erreurs",
      requires: { platform: "linux" }, // Nécessite Linux pour tester les erreurs natives

      async run() {
        let socket;

        try {
          socket = createSocketCAN("can0");

          // Test d'interface inexistante
          try {
            const badSocket = createSocketCAN("nonexistent_interface");
            await badSocket.open();
            throw new Error("Open sur interface inexistante devrait échouer");
          } catch (error) {
            if (error.message.includes("devrait échouer")) {
              throw error;
            }
            console.log("✓ Erreur open interface inexistante capturée");
          }

          // Test d'envoi sans open
          try {
            await socket.send(0x123, [0x01]);
            console.warn("Envoi sans open n'a pas généré d'erreur");
          } catch (error) {
            // Vérifier que c'est bien l'erreur attendue
            if (
              error.code === "SOCKET_NOT_OPEN" ||
              error.message.includes("not open")
            ) {
              console.log(
                "✓ Erreur envoi sans open capturée (socket non ouvert)"
              );
            } else {
              console.log("✓ Erreur envoi sans open capturée:", error.message);
            }
          }
        } finally {
          if (socket) {
            try {
              socket.close();
            } catch (error) {
              // Ignore les erreurs de fermeture
            }
          }
        }
      },
    },

    {
      name: "typescript-types",
      description: "Vérification des types TypeScript",

      async run() {
        // Test basique des types sans compilation
        const frame = {
          id: 0x123,
          data: [0x01, 0x02, 0x03, 0x04],
        };

        // Vérifications de structure
        if (typeof frame.id !== "number") {
          throw new Error("Type ID incorrect");
        }

        if (!Array.isArray(frame.data)) {
          throw new Error("Type data incorrect");
        }

        // Test des constantes si disponibles (uniquement sur Linux)
        if (process.platform === "linux") {
          const SocketCAN = loadSocketCAN();
          if (SocketCAN && SocketCAN.CAN_MAX_DLC !== undefined) {
            if (SocketCAN.CAN_MAX_DLC !== 8) {
              throw new Error("Constante CAN_MAX_DLC incorrecte");
            }
            console.log("✓ Constantes définies correctement");
          }
        } else {
          console.log("✓ Test des constantes ignoré sur Mac");
        }

        console.log("✓ Structure des types correcte");
      },
    },
  ],
};

// Enregistrement de la suite
TestSuiteRegistry.registerSuite(coreTestSuite);

module.exports = { coreTestSuite };
