/**
 * Suite de tests d'intégration
 * Tests avec interfaces CAN réelles et communication
 */

const { TestSuiteRegistry } = require("../framework/test-suite-registry");

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
function createSocketCAN(interfaceName = "vcan0") {
  const SocketCAN = loadSocketCAN();
  if (!SocketCAN) {
    throw new Error("Module SocketCAN non disponible");
  }
  return new SocketCAN.SocketCAN(interfaceName);
}

/**
 * Tests d'intégration avec interfaces réelles
 */
const integrationTestSuite = {
  name: "integration",
  description: "Tests d'intégration avec interfaces CAN réelles",
  category: "integration",

  async setup() {
    this.testInterface = "vcan0";
    this.realInterface = "can0"; // Interface CAN réelle si disponible
    this.testTimeout = 15000;

    // Tentative de création d'interface virtuelle (uniquement sur Linux)
    if (process.platform === "linux") {
      try {
        const { exec } = require("child_process");
        const { promisify } = require("util");
        const execAsync = promisify(exec);

        await execAsync("sudo modprobe vcan 2>/dev/null || true");
        await execAsync(
          `sudo ip link add dev ${this.testInterface} type vcan 2>/dev/null || true`
        );
        await execAsync(
          `sudo ip link set up ${this.testInterface} 2>/dev/null || true`
        );

        console.log(`✓ Interface virtuelle ${this.testInterface} préparée`);
      } catch (error) {
        console.warn(
          `⚠️  Impossible de créer l'interface virtuelle: ${error.message}`
        );
      }
    } else {
      console.log("⚠️ Tests d'intégration ignorés sur Mac");
    }
  },

  async teardown() {
    // Nettoyage des interfaces de test (uniquement sur Linux)
    if (process.platform === "linux") {
      try {
        const { exec } = require("child_process");
        const { promisify } = require("util");
        const execAsync = promisify(exec);

        await execAsync(
          `sudo ip link delete ${this.testInterface} 2>/dev/null || true`
        );
      } catch (error) {
        // Ignore les erreurs de nettoyage
      }
    }
  },

  tests: [
    {
      name: "interface-binding",
      description: "Liaison avec interface CAN",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 10000,

      async run() {
        let socket;

        try {
          socket = createSocketCAN(this.testInterface);

          // Test d'ouverture sur interface virtuelle
          await this.testBind(socket, this.testInterface);

          console.log(`✓ Ouverture réussie sur ${this.testInterface}`);

          // Vérification de l'état du socket
          if (typeof socket.getState === "function") {
            const state = socket.getState();
            if (state.interface !== this.testInterface) {
              throw new Error(`Interface incorrecte: ${state.interface}`);
            }
            console.log("✓ État du socket correct");
          }
        } finally {
          if (socket) {
            try {
              socket.close();
              console.log("✓ Socket fermé proprement");
            } catch (error) {
              console.warn("Avertissement fermeture:", error.message);
            }
          }
        }
      },

      async testBind(socket, interfaceName) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(
              new Error(`Timeout lors de l'ouverture sur ${interfaceName}`)
            );
          }, 5000);

          try {
            socket.open();
            clearTimeout(timeout);
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
      },
    },

    {
      name: "send-receive-loop",
      description: "Boucle d'envoi et réception",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 15000,

      async run() {
        let senderSocket, receiverSocket;

        try {
          // Création des sockets émetteur et récepteur
          senderSocket = createSocketCAN(this.testInterface);
          receiverSocket = createSocketCAN(this.testInterface);

          // Ouverture des sockets
          await senderSocket.open();
          await receiverSocket.open();

          console.log("✓ Sockets émetteur et récepteur créés");

          // Test d'envoi/réception
          await this.testSendReceiveLoop(senderSocket, receiverSocket);

          console.log("✓ Boucle d'envoi/réception réussie");
        } finally {
          if (senderSocket) {
            try {
              senderSocket.close();
            } catch (e) {}
          }
          if (receiverSocket) {
            try {
              receiverSocket.close();
            } catch (e) {}
          }
        }
      },

      async testSendReceiveLoop(sender, receiver) {
        return new Promise((resolve, reject) => {
          const testFrames = [
            { id: 0x123, data: [0x01, 0x02, 0x03, 0x04] },
            { id: 0x456, data: [0xaa, 0xbb] },
            { id: 0x789, data: [0xff] },
          ];

          let receivedCount = 0;
          const timeout = setTimeout(() => {
            reject(
              new Error(
                `Timeout: seulement ${receivedCount}/${testFrames.length} trames reçues`
              )
            );
          }, 10000);

          // Configuration du récepteur
          receiver.on("message", (frame) => {
            try {
              const expectedFrame = testFrames[receivedCount];
              this.validateReceivedFrame(frame, expectedFrame);

              receivedCount++;

              if (receivedCount === testFrames.length) {
                clearTimeout(timeout);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          });

          // Envoi des trames avec délai
          let sentCount = 0;
          const sendNext = () => {
            if (sentCount < testFrames.length) {
              const frame = testFrames[sentCount];
              sender.send(frame.id, frame.data);
              sentCount++;
              setTimeout(sendNext, 100); // Délai entre envois
            }
          };

          setTimeout(sendNext, 100); // Délai initial
        });
      },

      validateReceivedFrame(received, expected) {
        if (received.id !== expected.id) {
          throw new Error(
            `ID incorrect: reçu ${received.id}, attendu ${expected.id}`
          );
        }

        if (!received.data || received.data.length !== expected.data.length) {
          throw new Error(
            `Longueur données incorrecte: reçu ${received.data?.length}, attendu ${expected.data.length}`
          );
        }

        for (let i = 0; i < expected.data.length; i++) {
          if (received.data[i] !== expected.data[i]) {
            throw new Error(
              `Donnée incorrecte à l'index ${i}: reçu ${received.data[i]}, attendu ${expected.data[i]}`
            );
          }
        }
      },
    },

    {
      name: "multiple-sockets",
      description: "Gestion de sockets multiples",
      requires: { platform: "linux", canInterface: "vcan0" },

      async run() {
        const sockets = [];
        const socketCount = 3;

        try {
          // Création de plusieurs sockets
          for (let i = 0; i < socketCount; i++) {
            const socket = createSocketCAN(this.testInterface);
            await socket.open();
            sockets.push(socket);
          }

          console.log(`✓ ${socketCount} sockets créés et ouverts`);

          // Test d'envoi depuis un socket et réception sur les autres
          await this.testMultipleSocketsCommunication(sockets);

          console.log("✓ Communication multi-sockets réussie");
        } finally {
          // Fermeture de tous les sockets
          for (const socket of sockets) {
            try {
              socket.close();
            } catch (error) {
              // Ignore les erreurs de fermeture
            }
          }
        }
      },

      async testMultipleSocketsCommunication(sockets) {
        return new Promise((resolve, reject) => {
          const testFrame = { id: 0x555, data: [0xde, 0xad, 0xbe, 0xef] };
          const receiverSockets = sockets.slice(1); // Tous sauf le premier
          let receivedCount = 0;

          const timeout = setTimeout(() => {
            reject(
              new Error(
                `Timeout: ${receivedCount}/${receiverSockets.length} réceptions`
              )
            );
          }, 5000);

          // Configuration des récepteurs
          receiverSockets.forEach((socket, index) => {
            socket.on("message", (frame) => {
              try {
                if (frame.id === testFrame.id) {
                  receivedCount++;

                  if (receivedCount === receiverSockets.length) {
                    clearTimeout(timeout);
                    resolve();
                  }
                }
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            });
          });

          // Envoi depuis le premier socket
          setTimeout(() => {
            sockets[0].send(testFrame.id, testFrame.data);
          }, 100);
        });
      },
    },

    {
      name: "filter-application",
      description: "Application de filtres en temps réel",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 12000,

      async run() {
        let senderSocket, filteredSocket, unfilteredSocket;

        try {
          senderSocket = createSocketCAN(this.testInterface);
          filteredSocket = createSocketCAN(this.testInterface);
          unfilteredSocket = createSocketCAN(this.testInterface);

          await senderSocket.open();
          await filteredSocket.open();
          await unfilteredSocket.open();

          // Application d'un filtre spécifique
          const filter = { id: 0x100, mask: 0x700 }; // Accepte 0x100-0x1FF
          if (typeof filteredSocket.setFilter === "function") {
            filteredSocket.setFilter([filter]);
            console.log("✓ Filtre appliqué");
          }

          await this.testFilterBehavior(
            senderSocket,
            filteredSocket,
            unfilteredSocket,
            filter
          );

          console.log("✓ Comportement des filtres validé");
        } finally {
          [senderSocket, filteredSocket, unfilteredSocket].forEach((socket) => {
            if (socket) {
              try {
                socket.close();
              } catch (e) {}
            }
          });
        }
      },

      async testFilterBehavior(sender, filtered, unfiltered, filter) {
        return new Promise((resolve, reject) => {
          const testFrames = [
            { id: 0x123, data: [0x01], shouldPassFilter: true },
            { id: 0x234, data: [0x02], shouldPassFilter: false },
            { id: 0x156, data: [0x03], shouldPassFilter: true },
            { id: 0x456, data: [0x04], shouldPassFilter: false },
          ];

          let filteredReceived = 0;
          let unfilteredReceived = 0;
          const expectedFiltered = testFrames.filter(
            (f) => f.shouldPassFilter
          ).length;

          const timeout = setTimeout(() => {
            reject(
              new Error(
                `Timeout: reçu ${filteredReceived}/${expectedFiltered} filtrés, ${unfilteredReceived}/${testFrames.length} non-filtrés`
              )
            );
          }, 8000);

          filtered.on("message", (frame) => {
            filteredReceived++;
            const frameConfig = testFrames.find((f) => f.id === frame.id);
            if (frameConfig && !frameConfig.shouldPassFilter) {
              clearTimeout(timeout);
              reject(
                new Error(`Trame ${frame.id} ne devrait pas passer le filtre`)
              );
            }
          });

          unfiltered.on("message", (frame) => {
            unfilteredReceived++;

            if (
              unfilteredReceived === testFrames.length &&
              filteredReceived === expectedFiltered
            ) {
              clearTimeout(timeout);
              resolve();
            }
          });

          // Envoi des trames de test
          let sentCount = 0;
          const sendNext = () => {
            if (sentCount < testFrames.length) {
              const frame = testFrames[sentCount];
              sender.send(frame.id, frame.data);
              sentCount++;
              setTimeout(sendNext, 200);
            }
          };

          setTimeout(sendNext, 100);
        });
      },
    },

    {
      name: "stress-test",
      description: "Test de charge et stabilité",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 20000,

      async run() {
        let senderSocket, receiverSocket;

        try {
          senderSocket = createSocketCAN(this.testInterface);
          receiverSocket = createSocketCAN(this.testInterface);

          await senderSocket.open();
          await receiverSocket.open();

          console.log("✓ Démarrage du test de charge");

          await this.performStressTest(senderSocket, receiverSocket);

          console.log("✓ Test de charge réussi");
        } finally {
          if (senderSocket) {
            try {
              senderSocket.close();
            } catch (e) {}
          }
          if (receiverSocket) {
            try {
              receiverSocket.close();
            } catch (e) {}
          }
        }
      },

      async performStressTest(sender, receiver) {
        return new Promise((resolve, reject) => {
          const frameCount = 100;
          const frameRate = 10; // ms entre envois
          let sentCount = 0;
          let receivedCount = 0;
          const startTime = Date.now();

          const timeout = setTimeout(() => {
            reject(
              new Error(
                `Timeout stress test: envoyé ${sentCount}, reçu ${receivedCount}`
              )
            );
          }, 15000);

          receiver.on("message", (frame) => {
            receivedCount++;

            if (receivedCount === frameCount) {
              const duration = Date.now() - startTime;
              const throughput = Math.round((frameCount * 1000) / duration);

              clearTimeout(timeout);
              console.log(`✓ Débit: ${throughput} trames/sec`);
              resolve();
            }
          });

          // Envoi rapide de trames
          const sendLoop = () => {
            if (sentCount < frameCount) {
              const frame = {
                id: 0x300 + (sentCount % 256),
                data: [sentCount & 0xff, (sentCount >> 8) & 0xff],
              };

              try {
                sender.send(frame.id, frame.data);
                sentCount++;
                setTimeout(sendLoop, frameRate);
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            }
          };

          setTimeout(sendLoop, 100);
        });
      },
    },
  ],
};

// Enregistrement de la suite
TestSuiteRegistry.registerSuite(integrationTestSuite);

module.exports = { integrationTestSuite };
