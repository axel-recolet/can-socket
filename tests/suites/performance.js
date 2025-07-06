/**
 * Suite de tests de performance
 * Tests de charge, latence et optimisation
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
 * Tests de performance et charge
 */
const performanceTestSuite = {
  name: "performance",
  description: "Tests de performance et optimisation",
  category: "performance",

  async setup() {
    this.testInterface = "vcan0";
    this.testTimeout = 30000; // Tests de performance plus longs

    // Préparation interface de test (uniquement sur Linux)
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
      } catch (error) {
        console.warn(
          "⚠️  Interface virtuelle non disponible pour tests de performance"
        );
      }
    } else {
      console.log("⚠️ Tests de performance ignorés sur Mac");
    }
  },

  async teardown() {
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
      name: "throughput-test",
      description: "Test de débit maximum",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 25000,

      async run() {
        let senderSocket, receiverSocket;

        try {
          senderSocket = createSocketCAN(this.testInterface);
          receiverSocket = createSocketCAN(this.testInterface);

          await senderSocket.open();
          await receiverSocket.open();

          const results = await this.measureThroughput(
            senderSocket,
            receiverSocket
          );

          console.log(`✓ Débit maximum: ${results.maxThroughput} trames/sec`);
          console.log(`✓ Latence moyenne: ${results.avgLatency}ms`);
          console.log(`✓ Taux de perte: ${results.lossRate}%`);

          // Vérifications de performance
          if (results.maxThroughput < 100) {
            console.warn("⚠️  Débit faible détecté");
          }

          if (results.lossRate > 5) {
            throw new Error(`Taux de perte trop élevé: ${results.lossRate}%`);
          }
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

      async measureThroughput(sender, receiver) {
        return new Promise((resolve, reject) => {
          const frameCount = 1000;
          const testDuration = 10000; // 10 secondes
          let sentCount = 0;
          let receivedCount = 0;
          const latencies = [];
          const startTime = Date.now();

          const timeout = setTimeout(() => {
            const duration = Date.now() - startTime;
            const throughput = Math.round((receivedCount * 1000) / duration);
            const avgLatency =
              latencies.length > 0
                ? Math.round(
                    (latencies.reduce((a, b) => a + b, 0) / latencies.length) *
                      100
                  ) / 100
                : 0;
            const lossRate =
              Math.round(
                ((sentCount - receivedCount) / sentCount) * 100 * 100
              ) / 100;

            resolve({
              maxThroughput: throughput,
              avgLatency: avgLatency,
              lossRate: lossRate,
              sentFrames: sentCount,
              receivedFrames: receivedCount,
            });
          }, testDuration);

          receiver.on("message", (frame) => {
            const receiveTime = Date.now();
            receivedCount++;

            // Calcul de latence si timestamp disponible
            if (frame.timestamp) {
              latencies.push(receiveTime - frame.timestamp);
            }
          });

          // Envoi continu de trames
          const sendLoop = () => {
            if (
              sentCount < frameCount &&
              Date.now() - startTime < testDuration
            ) {
              const frame = {
                id: 0x100 + (sentCount % 256),
                data: [
                  sentCount & 0xff,
                  (sentCount >> 8) & 0xff,
                  Date.now() & 0xff,
                  (Date.now() >> 8) & 0xff,
                ],
                timestamp: Date.now(),
              };

              try {
                sender.send(frame.id, frame.data);
                sentCount++;
                setImmediate(sendLoop); // Envoi le plus rapide possible
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            } else if (Date.now() - startTime < testDuration) {
              setTimeout(sendLoop, 1);
            }
          };

          setImmediate(sendLoop);
        });
      },
    },

    {
      name: "latency-test",
      description: "Test de latence ping-pong",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 15000,

      async run() {
        let socket1, socket2;

        try {
          socket1 = createSocketCAN(this.testInterface);
          socket2 = createSocketCAN(this.testInterface);

          await socket1.open();
          await socket2.open();

          const latencyStats = await this.measureLatency(socket1, socket2);

          console.log(`✓ Latence min: ${latencyStats.min}ms`);
          console.log(`✓ Latence max: ${latencyStats.max}ms`);
          console.log(`✓ Latence moyenne: ${latencyStats.avg}ms`);
          console.log(`✓ Latence médiane: ${latencyStats.median}ms`);

          if (latencyStats.avg > 50) {
            console.warn("⚠️  Latence élevée détectée");
          }
        } finally {
          if (socket1) {
            try {
              socket1.close();
            } catch (e) {}
          }
          if (socket2) {
            try {
              socket2.close();
            } catch (e) {}
          }
        }
      },

      async measureLatency(socket1, socket2) {
        return new Promise((resolve, reject) => {
          const pingCount = 50;
          const latencies = [];
          let pingsReceived = 0;
          const startTime = Date.now();

          const timeout = setTimeout(() => {
            reject(
              new Error(`Timeout latence: ${pingsReceived}/${pingCount} pings`)
            );
          }, 12000);

          // Socket2 répond aux pings
          socket2.on("message", (frame) => {
            if (frame.id === 0x555) {
              // Ping frame
              const pongFrame = {
                id: 0x556, // Pong frame
                data: frame.data, // Renvoie les mêmes données
              };

              setTimeout(() => {
                socket2.send(pongFrame.id, pongFrame.data);
              }, 1); // Délai minimal pour simulation réaliste
            }
          });

          // Socket1 mesure les latences
          socket1.on("message", (frame) => {
            if (frame.id === 0x556) {
              // Pong frame
              const receiveTime = Date.now() - startTime;
              const sentTime = parseInt(
                Buffer.from(frame.data.slice(0, 4)).readUInt32BE(0)
              );

              latencies.push(Math.abs(receiveTime - sentTime));
              pingsReceived++;

              if (pingsReceived === pingCount) {
                clearTimeout(timeout);

                latencies.sort((a, b) => a - b);
                const stats = {
                  min: Math.min(...latencies),
                  max: Math.max(...latencies),
                  avg:
                    Math.round(
                      (latencies.reduce((a, b) => a + b, 0) /
                        latencies.length) *
                        100
                    ) / 100,
                  median: latencies[Math.floor(latencies.length / 2)],
                  p95: latencies[Math.floor(latencies.length * 0.95)],
                  p99: latencies[Math.floor(latencies.length * 0.99)],
                };

                resolve(stats);
              }
            }
          });

          // Envoi des pings
          let sentPings = 0;
          const pingStartTime = Date.now();
          const sendPing = () => {
            if (sentPings < pingCount) {
              // Utiliser un timestamp relatif qui tient dans 4 octets
              const relativeTimestamp = Date.now() - pingStartTime;
              const buffer = Buffer.allocUnsafe(4);
              buffer.writeUInt32BE(relativeTimestamp & 0xffffffff, 0);

              const pingFrame = {
                id: 0x555,
                data: Array.from(buffer),
              };

              socket1.send(pingFrame.id, pingFrame.data);
              sentPings++;

              setTimeout(sendPing, 50); // 50ms entre pings
            }
          };

          setTimeout(sendPing, 100);
        });
      },
    },

    {
      name: "memory-usage",
      description: "Test d'utilisation mémoire",
      requires: { platform: "linux" }, // Nécessite le module natif
      timeout: 20000,

      async run() {
        const initialMemory = process.memoryUsage();
        console.log("📊 Mémoire initiale:", this.formatMemory(initialMemory));

        await this.testMemoryUsage();

        // Force garbage collection si disponible
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage();
        console.log("📊 Mémoire finale:", this.formatMemory(finalMemory));

        // Vérification des fuites mémoire
        const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        const heapIncreasePercent =
          (heapIncrease / initialMemory.heapUsed) * 100;

        console.log(
          `📈 Augmentation heap: ${this.formatBytes(
            heapIncrease
          )} (${heapIncreasePercent.toFixed(1)}%)`
        );

        if (heapIncreasePercent > 50) {
          console.warn("⚠️  Possible fuite mémoire détectée");
        }
      },

      async testMemoryUsage() {
        const sockets = [];
        const socketCount = 10;

        try {
          // Création et utilisation de multiples sockets
          for (let cycle = 0; cycle < 5; cycle++) {
            console.log(`🔄 Cycle ${cycle + 1}/5`);

            // Création des sockets
            for (let i = 0; i < socketCount; i++) {
              const socket = createSocketCAN(this.testInterface);
              sockets.push(socket);
            }

            // Simulation d'utilisation
            for (let i = 0; i < 100; i++) {
              const frame = {
                id: 0x100 + (i % 256),
                data: new Array(8)
                  .fill(0)
                  .map(() => Math.floor(Math.random() * 256)),
              };

              // Test de validation sans envoi réel
              this.validateFrameStructure(frame);
            }

            // Fermeture des sockets
            for (const socket of sockets) {
              try {
                socket.close();
              } catch (error) {
                // Ignore les erreurs de fermeture
              }
            }

            sockets.length = 0; // Vide le tableau

            // Pause pour permettre le garbage collection
            await this.sleep(100);
          }
        } finally {
          // Nettoyage final
          for (const socket of sockets) {
            try {
              socket.close();
            } catch (error) {
              // Ignore
            }
          }
        }
      },

      validateFrameStructure(frame) {
        if (typeof frame.id !== "number") throw new Error("Invalid ID");
        if (!Array.isArray(frame.data)) throw new Error("Invalid data");
        if (frame.data.length > 8) throw new Error("Data too long");

        for (const byte of frame.data) {
          if (typeof byte !== "number" || byte < 0 || byte > 255) {
            throw new Error("Invalid byte");
          }
        }
      },

      formatMemory(memUsage) {
        return {
          rss: this.formatBytes(memUsage.rss),
          heapTotal: this.formatBytes(memUsage.heapTotal),
          heapUsed: this.formatBytes(memUsage.heapUsed),
          external: this.formatBytes(memUsage.external),
        };
      },

      formatBytes(bytes) {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      },

      sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      },
    },

    {
      name: "concurrent-access",
      description: "Test d'accès concurrent",
      requires: { platform: "linux", canInterface: "vcan0" },
      timeout: 15000,

      async run() {
        const workerCount = 5;
        const workers = [];

        try {
          // Démarrage des workers concurrents
          for (let i = 0; i < workerCount; i++) {
            workers.push(this.createWorker(i));
          }

          console.log(`✓ ${workerCount} workers démarrés`);

          // Attente de tous les workers
          const results = await Promise.all(workers);

          // Analyse des résultats
          const totalFrames = results.reduce(
            (sum, result) => sum + result.framesSent,
            0
          );
          const totalErrors = results.reduce(
            (sum, result) => sum + result.errors,
            0
          );
          const errorRate = (totalErrors / totalFrames) * 100;

          console.log(`✓ Total frames: ${totalFrames}`);
          console.log(
            `✓ Total erreurs: ${totalErrors} (${errorRate.toFixed(2)}%)`
          );

          if (errorRate > 10) {
            throw new Error(
              `Taux d'erreur concurrent trop élevé: ${errorRate.toFixed(2)}%`
            );
          }
        } catch (error) {
          throw error;
        }
      },

      async createWorker(workerId) {
        return new Promise((resolve, reject) => {
          let socket;
          const result = {
            workerId: workerId,
            framesSent: 0,
            errors: 0,
            startTime: Date.now(),
          };

          const timeout = setTimeout(() => {
            if (socket) {
              try {
                socket.close();
              } catch (e) {}
            }
            result.duration = Date.now() - result.startTime;
            resolve(result);
          }, 5000);

          try {
            socket = createSocketCAN(this.testInterface);
            socket.open();

            // Envoi continu de trames
            const sendLoop = () => {
              if (Date.now() - result.startTime < 4000) {
                // 4 secondes de travail
                const frame = {
                  id: 0x200 + workerId,
                  data: [workerId, result.framesSent & 0xff, Date.now() & 0xff],
                };

                try {
                  socket.send(frame.id, frame.data);
                  result.framesSent++;
                } catch (error) {
                  result.errors++;
                }

                setImmediate(sendLoop);
              }
            };

            setTimeout(sendLoop, Math.random() * 100); // Démarrage aléatoire
          } catch (error) {
            result.errors++;
            clearTimeout(timeout);
            resolve(result);
          }
        });
      },
    },

    {
      name: "resource-cleanup",
      description: "Test de nettoyage des ressources",
      requires: { platform: "linux" }, // Nécessite le module natif
      timeout: 10000,

      async run() {
        const cycles = 10;
        const socketsPerCycle = 5;

        console.log(
          `🔄 Test de ${cycles} cycles avec ${socketsPerCycle} sockets chacun`
        );

        for (let cycle = 0; cycle < cycles; cycle++) {
          await this.testResourceCleanupCycle(socketsPerCycle, cycle);

          // Pause pour observation
          await this.sleep(100);
        }

        console.log("✓ Tous les cycles de nettoyage réussis");
      },

      async testResourceCleanupCycle(socketCount, cycleIndex) {
        const sockets = [];

        try {
          // Phase de création
          for (let i = 0; i < socketCount; i++) {
            const socket = createSocketCAN(this.testInterface);
            sockets.push(socket);
          }

          // Phase d'utilisation légère
          const testFrame = { id: 0x400 + cycleIndex, data: [cycleIndex] };
          for (const socket of sockets) {
            try {
              // Test de validation sans bind (pour éviter les erreurs système)
              this.validateFrameForSending(testFrame);
            } catch (error) {
              // Erreur attendue sans bind
            }
          }

          // Phase de nettoyage explicite
          for (let i = 0; i < sockets.length; i++) {
            try {
              sockets[i].close();
              sockets[i] = null; // Facilite le GC
            } catch (error) {
              console.warn(
                `Erreur fermeture socket ${i} cycle ${cycleIndex}:`,
                error.message
              );
            }
          }
        } finally {
          // Nettoyage de sécurité
          for (const socket of sockets) {
            if (socket) {
              try {
                socket.close();
              } catch (error) {
                // Ignore
              }
            }
          }
        }
      },

      validateFrameForSending(frame) {
        if (!frame || typeof frame.id !== "number") {
          throw new Error("Frame invalide");
        }
        if (!Array.isArray(frame.data)) {
          throw new Error("Données invalides");
        }
        return true;
      },

      sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      },
    },
  ],
};

// Enregistrement de la suite
TestSuiteRegistry.registerSuite(performanceTestSuite);

module.exports = { performanceTestSuite };
