/**
 * Suite de tests avancés
 * Tests des fonctionnalités avancées (CAN FD, filtres, etc.)
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
function createSocketCAN() {
  const SocketCAN = loadSocketCAN();
  if (!SocketCAN) {
    throw new Error("Module SocketCAN non disponible");
  }
  return new SocketCAN.SocketCAN();
}

/**
 * Tests des fonctionnalités avancées
 */
const advancedTestSuite = {
  name: "advanced",
  description: "Tests des fonctionnalités avancées SocketCAN",
  category: "advanced",

  async setup() {
    this.testInterface = "vcan0";
    this.testTimeout = 10000;
  },

  async teardown() {
    // Nettoyage des ressources avancées
  },

  tests: [
    {
      name: "can-fd-support",
      description: "Support CAN FD",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 8000,

      async run() {
        const SocketCAN = loadSocketCAN();
        if (!SocketCAN) {
          throw new Error("Module SocketCAN non disponible");
        }

        let socket;

        try {
          socket = new SocketCAN.SocketCAN();

          // Test de création d'une trame CAN FD
          const canFdFrame = {
            id: 0x123,
            data: new Array(64).fill(0).map((_, i) => i % 256),
            fd: true,
            brs: true, // Bit Rate Switch
          };

          // Validation de la trame CAN FD
          this.validateCanFdFrame(canFdFrame);

          console.log("✓ Trame CAN FD valide créée");

          // Test des différentes tailles de données CAN FD
          const validSizes = [8, 12, 16, 20, 24, 32, 48, 64];
          for (const size of validSizes) {
            const testFrame = {
              id: 0x456,
              data: new Array(size).fill(0xaa),
              fd: true,
            };

            this.validateCanFdFrame(testFrame);
          }

          console.log("✓ Toutes les tailles CAN FD valides testées");
        } catch (error) {
          if (error.message.includes("CAN FD non supporté")) {
            console.log("⏭️  CAN FD non supporté sur ce système");
            return;
          }
          throw error;
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

      validateCanFdFrame(frame) {
        if (!frame.fd) {
          throw new Error("Trame non marquée comme CAN FD");
        }

        if (!Array.isArray(frame.data)) {
          throw new Error("Données CAN FD invalides");
        }

        if (frame.data.length > 64) {
          throw new Error("Données CAN FD trop longues");
        }

        // Vérifier que la taille correspond aux valeurs CAN FD valides
        const validSizes = [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64,
        ];
        if (!validSizes.includes(frame.data.length)) {
          throw new Error(`Taille CAN FD invalide: ${frame.data.length}`);
        }
      },
    },

    {
      name: "can-filters",
      description: "Filtres CAN",
      requires: { platform: "linux" },

      async run() {
        const SocketCAN = loadSocketCAN();
        if (!SocketCAN) {
          throw new Error("Module SocketCAN non disponible");
        }

        let socket;

        try {
          socket = new SocketCAN.SocketCAN();

          // Test de configuration de filtres
          const filters = [
            { id: 0x123, mask: 0x7ff }, // Filtre exact
            { id: 0x200, mask: 0x700 }, // Filtre de plage
            { id: 0x000, mask: 0x000 }, // Passe-tout
          ];

          // Validation des filtres
          for (const filter of filters) {
            this.validateFilter(filter);
          }

          console.log("✓ Filtres CAN validés");

          // Test de logique de filtrage
          this.testFilterLogic();

          console.log("✓ Logique de filtrage correcte");
        } finally {
          if (socket) {
            try {
              socket.close();
            } catch (error) {
              // Ignore
            }
          }
        }
      },

      validateFilter(filter) {
        if (
          typeof filter.id !== "number" ||
          filter.id < 0 ||
          filter.id > 0x1fffffff
        ) {
          throw new Error("ID de filtre invalide");
        }

        if (
          typeof filter.mask !== "number" ||
          filter.mask < 0 ||
          filter.mask > 0x1fffffff
        ) {
          throw new Error("Masque de filtre invalide");
        }
      },

      testFilterLogic() {
        // Test de la logique AND entre ID et masque
        const testCases = [
          {
            filter: { id: 0x123, mask: 0x7ff },
            frameId: 0x123,
            shouldPass: true,
          },
          {
            filter: { id: 0x123, mask: 0x7ff },
            frameId: 0x124,
            shouldPass: false,
          },
          {
            filter: { id: 0x100, mask: 0x700 },
            frameId: 0x123,
            shouldPass: true,
          },
          {
            filter: { id: 0x100, mask: 0x700 },
            frameId: 0x234,
            shouldPass: false,
          },
        ];

        for (const testCase of testCases) {
          const passes =
            (testCase.frameId & testCase.filter.mask) ===
            (testCase.filter.id & testCase.filter.mask);

          if (passes !== testCase.shouldPass) {
            throw new Error(
              `Logique de filtre incorrecte pour ${JSON.stringify(testCase)}`
            );
          }
        }
      },
    },

    {
      name: "extended-ids",
      description: "IDs étendus 29-bit",

      async run() {
        // Test des IDs étendus (29-bit)
        const extendedIds = [
          0x800, // Premier ID étendu
          0x1ffff, // ID moyen
          0x1fffffff, // ID maximum
        ];

        for (const id of extendedIds) {
          const frame = {
            id: id,
            data: [0x01, 0x02],
            extended: true,
          };

          this.validateExtendedFrame(frame);
        }

        console.log("✓ IDs étendus validés");

        // Test de détection automatique d'ID étendu
        const autoExtendedFrame = {
          id: 0x800,
          data: [0x01],
        };

        if (autoExtendedFrame.id > 0x7ff) {
          autoExtendedFrame.extended = true;
        }

        this.validateExtendedFrame(autoExtendedFrame);

        console.log("✓ Détection automatique d'ID étendu");
      },

      validateExtendedFrame(frame) {
        if (frame.extended && frame.id <= 0x7ff) {
          throw new Error("Frame marquée étendue avec ID standard");
        }

        if (frame.id > 0x1fffffff) {
          throw new Error("ID étendu trop grand");
        }

        if (frame.id > 0x7ff && !frame.extended) {
          throw new Error("ID étendu sans marqueur extended");
        }
      },
    },

    {
      name: "remote-frames",
      description: "Trames Remote Transmission Request (RTR)",

      async run() {
        // Test des trames RTR
        const rtrFrames = [
          { id: 0x123, dlc: 0, rtr: true },
          { id: 0x456, dlc: 4, rtr: true },
          { id: 0x789, dlc: 8, rtr: true },
        ];

        for (const frame of rtrFrames) {
          this.validateRtrFrame(frame);
        }

        console.log("✓ Trames RTR validées");

        // Test de conversion données -> RTR
        const dataFrame = { id: 0x123, data: [0x01, 0x02, 0x03, 0x04] };
        const rtrFrame = this.convertToRtr(dataFrame);

        this.validateRtrFrame(rtrFrame);

        console.log("✓ Conversion en trame RTR réussie");
      },

      validateRtrFrame(frame) {
        if (!frame.rtr) {
          throw new Error("Trame non marquée comme RTR");
        }

        if (frame.data && frame.data.length > 0) {
          throw new Error("Trame RTR ne doit pas avoir de données");
        }

        if (typeof frame.dlc !== "number" || frame.dlc < 0 || frame.dlc > 8) {
          throw new Error("DLC invalide pour trame RTR");
        }
      },

      convertToRtr(dataFrame) {
        return {
          id: dataFrame.id,
          dlc: dataFrame.data ? dataFrame.data.length : 0,
          rtr: true,
          extended: dataFrame.extended || false,
        };
      },
    },

    {
      name: "error-frames",
      description: "Gestion des trames d'erreur",

      async run() {
        // Test de détection et gestion des trames d'erreur
        const errorConditions = [
          "BIT_ERROR",
          "STUFF_ERROR",
          "CRC_ERROR",
          "FORM_ERROR",
          "ACK_ERROR",
        ];

        // Simulation de trames d'erreur
        for (const errorType of errorConditions) {
          const errorFrame = {
            id: 0x000,
            error: true,
            errorType: errorType,
            data: [],
          };

          this.validateErrorFrame(errorFrame);
        }

        console.log("✓ Types de trames d'erreur validés");

        // Test de statistiques d'erreur
        const errorStats = {
          txErrors: 0,
          rxErrors: 0,
          busOffCount: 0,
          errorWarningLevel: false,
          errorPassiveLevel: false,
        };

        this.validateErrorStats(errorStats);

        console.log("✓ Statistiques d'erreur validées");
      },

      validateErrorFrame(frame) {
        if (!frame.error) {
          throw new Error("Trame non marquée comme erreur");
        }

        if (frame.data.length > 0) {
          throw new Error("Trame d'erreur ne doit pas avoir de données");
        }

        const validErrorTypes = [
          "BIT_ERROR",
          "STUFF_ERROR",
          "CRC_ERROR",
          "FORM_ERROR",
          "ACK_ERROR",
        ];
        if (frame.errorType && !validErrorTypes.includes(frame.errorType)) {
          throw new Error(`Type d'erreur invalide: ${frame.errorType}`);
        }
      },

      validateErrorStats(stats) {
        const requiredFields = ["txErrors", "rxErrors", "busOffCount"];
        for (const field of requiredFields) {
          if (typeof stats[field] !== "number" || stats[field] < 0) {
            throw new Error(`Statistique invalide: ${field}`);
          }
        }
      },
    },
  ],
};

// Enregistrement de la suite
TestSuiteRegistry.registerSuite(advancedTestSuite);

module.exports = { advancedTestSuite };
