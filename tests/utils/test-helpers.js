/**
 * Utilitaires de test réutilisables
 * Fonctions communes pour tous les tests SocketCAN
 */

/**
 * Configuration de test standard
 */
const TEST_CONFIG = {
  interfaces: {
    virtual: "vcan0",
    real: "can0",
  },
  timeouts: {
    short: 2000,
    medium: 5000,
    long: 10000,
    performance: 30000,
  },
  frames: {
    standard: { id: 0x123, data: [0x01, 0x02, 0x03, 0x04] },
    extended: {
      id: 0x1fffffff,
      data: [0xde, 0xad, 0xbe, 0xef],
      extended: true,
    },
    remote: { id: 0x456, dlc: 4, rtr: true },
    canFd: {
      id: 0x789,
      data: new Array(64).fill(0).map((_, i) => i % 256),
      fd: true,
    },
    error: { id: 0x000, error: true, data: [] },
  },
  filters: {
    exact: { id: 0x123, mask: 0x7ff },
    range: { id: 0x100, mask: 0x700 },
    passAll: { id: 0x000, mask: 0x000 },
  },
};

/**
 * Validateurs de trames CAN
 */
class FrameValidator {
  /**
   * Valide une trame CAN standard
   */
  static validateStandardFrame(frame) {
    if (!frame || typeof frame !== "object") {
      throw new Error("Trame invalide: doit être un objet");
    }

    // Validation de l'ID
    if (typeof frame.id !== "number") {
      throw new Error("ID invalide: doit être un nombre");
    }

    if (frame.id < 0) {
      throw new Error("ID invalide: ne peut pas être négatif");
    }

    if (!frame.extended && frame.id > 0x7ff) {
      throw new Error("ID standard invalide: maximum 0x7FF");
    }

    if (frame.extended && frame.id > 0x1fffffff) {
      throw new Error("ID étendu invalide: maximum 0x1FFFFFFF");
    }

    // Validation des données
    if (frame.data && !Array.isArray(frame.data)) {
      throw new Error("Données invalides: doivent être un tableau");
    }

    if (frame.data && frame.data.length > (frame.fd ? 64 : 8)) {
      const maxLen = frame.fd ? 64 : 8;
      throw new Error(`Données trop longues: maximum ${maxLen} bytes`);
    }

    if (frame.data) {
      for (let i = 0; i < frame.data.length; i++) {
        const byte = frame.data[i];
        if (typeof byte !== "number" || byte < 0 || byte > 255) {
          throw new Error(`Byte invalide à l'index ${i}: ${byte}`);
        }
      }
    }

    // Validation RTR
    if (frame.rtr && frame.data && frame.data.length > 0) {
      throw new Error("Trame RTR ne peut pas avoir de données");
    }

    if (frame.rtr && typeof frame.dlc !== "number") {
      throw new Error("Trame RTR doit avoir un DLC défini");
    }

    return true;
  }

  /**
   * Valide une trame CAN FD
   */
  static validateCanFdFrame(frame) {
    this.validateStandardFrame(frame);

    if (!frame.fd) {
      throw new Error("Trame non marquée comme CAN FD");
    }

    // Vérification des tailles valides pour CAN FD
    const validSizes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 32, 48, 64];
    const dataLength = frame.data ? frame.data.length : 0;

    if (!validSizes.includes(dataLength)) {
      throw new Error(
        `Taille CAN FD invalide: ${dataLength} (valides: ${validSizes.join(
          ", "
        )})`
      );
    }

    return true;
  }

  /**
   * Valide un filtre CAN
   */
  static validateFilter(filter) {
    if (!filter || typeof filter !== "object") {
      throw new Error("Filtre invalide: doit être un objet");
    }

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

    return true;
  }
}

/**
 * Générateur de trames de test
 */
class FrameGenerator {
  /**
   * Génère une trame standard simple
   */
  static generateStandardFrame(id = null, dataLength = 4) {
    return {
      id: id || Math.floor(Math.random() * 0x7ff),
      data: new Array(dataLength)
        .fill(0)
        .map(() => Math.floor(Math.random() * 256)),
    };
  }

  /**
   * Génère une trame étendue
   */
  static generateExtendedFrame(id = null, dataLength = 8) {
    return {
      id: id || 0x800 + Math.floor(Math.random() * 0x1ffff7ff),
      data: new Array(dataLength)
        .fill(0)
        .map(() => Math.floor(Math.random() * 256)),
      extended: true,
    };
  }

  /**
   * Génère une trame RTR
   */
  static generateRtrFrame(id = null, dlc = 4) {
    return {
      id: id || Math.floor(Math.random() * 0x7ff),
      dlc: dlc,
      rtr: true,
    };
  }

  /**
   * Génère une trame CAN FD
   */
  static generateCanFdFrame(id = null, dataLength = 32) {
    const validSizes = [8, 12, 16, 20, 24, 32, 48, 64];
    const actualLength = validSizes.includes(dataLength)
      ? dataLength
      : validSizes[Math.floor(Math.random() * validSizes.length)];

    return {
      id: id || Math.floor(Math.random() * 0x7ff),
      data: new Array(actualLength).fill(0).map((_, i) => i % 256),
      fd: true,
      brs: true, // Bit Rate Switch
    };
  }

  /**
   * Génère une série de trames de test
   */
  static generateTestSeries(count = 10, types = ["standard"]) {
    const frames = [];

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];

      switch (type) {
        case "standard":
          frames.push(this.generateStandardFrame());
          break;
        case "extended":
          frames.push(this.generateExtendedFrame());
          break;
        case "rtr":
          frames.push(this.generateRtrFrame());
          break;
        case "canfd":
          frames.push(this.generateCanFdFrame());
          break;
        default:
          frames.push(this.generateStandardFrame());
      }
    }

    return frames;
  }
}

/**
 * Helpers pour les tests asynchrones
 */
class AsyncHelper {
  /**
   * Attend qu'une condition soit vraie avec timeout
   */
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await this.sleep(interval);
    }

    throw new Error(`Timeout après ${timeout}ms`);
  }

  /**
   * Pause asynchrone
   */
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Exécute une fonction avec timeout
   */
  static async withTimeout(fn, timeout) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout après ${timeout}ms`));
      }, timeout);

      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Retry avec backoff exponentiel
   */
  static async retry(fn, maxAttempts = 3, baseDelay = 100) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }
}

/**
 * Collecteur de métriques pour les tests
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      framesSent: 0,
      framesReceived: 0,
      errors: 0,
      latencies: [],
      startTime: null,
      endTime: null,
    };
  }

  start() {
    this.metrics.startTime = Date.now();
    return this;
  }

  stop() {
    this.metrics.endTime = Date.now();
    return this;
  }

  recordFrameSent() {
    this.metrics.framesSent++;
    return this;
  }

  recordFrameReceived(latency = null) {
    this.metrics.framesReceived++;
    if (latency !== null) {
      this.metrics.latencies.push(latency);
    }
    return this;
  }

  recordError() {
    this.metrics.errors++;
    return this;
  }

  getStats() {
    const duration = this.metrics.endTime - this.metrics.startTime;
    const latencies = this.metrics.latencies;

    return {
      duration: duration,
      framesSent: this.metrics.framesSent,
      framesReceived: this.metrics.framesReceived,
      errors: this.metrics.errors,
      throughput:
        duration > 0
          ? Math.round((this.metrics.framesReceived * 1000) / duration)
          : 0,
      lossRate:
        this.metrics.framesSent > 0
          ? Math.round(
              ((this.metrics.framesSent - this.metrics.framesReceived) /
                this.metrics.framesSent) *
                100
            )
          : 0,
      latency:
        latencies.length > 0
          ? {
              min: Math.min(...latencies),
              max: Math.max(...latencies),
              avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
              median: latencies.sort((a, b) => a - b)[
                Math.floor(latencies.length / 2)
              ],
            }
          : null,
    };
  }

  reset() {
    this.metrics = {
      framesSent: 0,
      framesReceived: 0,
      errors: 0,
      latencies: [],
      startTime: null,
      endTime: null,
    };
    return this;
  }
}

/**
 * Gestionnaire de ressources pour les tests
 */
class ResourceManager {
  constructor() {
    this.resources = new Set();
  }

  /**
   * Enregistre une ressource à nettoyer
   */
  register(resource) {
    this.resources.add(resource);
    return resource;
  }

  /**
   * Nettoie toutes les ressources
   */
  async cleanup() {
    const errors = [];

    for (const resource of this.resources) {
      try {
        if (typeof resource.close === "function") {
          await resource.close();
        } else if (typeof resource.destroy === "function") {
          await resource.destroy();
        } else if (typeof resource === "function") {
          await resource();
        }
      } catch (error) {
        errors.push(error);
      }
    }

    this.resources.clear();

    if (errors.length > 0) {
      console.warn(`${errors.length} erreur(s) lors du nettoyage:`, errors);
    }
  }
}

/**
 * Logger pour les tests
 */
class TestLogger {
  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message) {
    console.log(`ℹ️  ${message}`);
  }

  success(message) {
    console.log(`✅ ${message}`);
  }

  warn(message) {
    console.log(`⚠️  ${message}`);
  }

  error(message) {
    console.log(`❌ ${message}`);
  }

  debug(message) {
    if (this.verbose) {
      console.log(`🐛 ${message}`);
    }
  }

  metric(name, value, unit = "") {
    console.log(`📊 ${name}: ${value}${unit}`);
  }
}

module.exports = {
  TEST_CONFIG,
  FrameValidator,
  FrameGenerator,
  AsyncHelper,
  MetricsCollector,
  ResourceManager,
  TestLogger,
};
