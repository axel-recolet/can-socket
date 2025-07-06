/**
 * Vérificateur système pour les tests SocketCAN
 * Vérifie l'environnement et la disponibilité des ressources
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const os = require("os");

const execAsync = promisify(exec);

class SystemChecker {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Effectue toutes les vérifications système
   */
  async performChecks() {
    const results = {
      platform: process.platform,
      canSupport: false,
      interfaces: [],
      permissions: false,
      warnings: [],
      errors: [],
    };

    try {
      // Vérification de la plateforme
      if (process.platform !== "linux") {
        results.warnings.push(
          "SocketCAN nécessite Linux - certains tests seront ignorés"
        );
      } else {
        // Vérifications Linux spécifiques
        results.canSupport = await this.checkCanSupport();
        results.interfaces = await this.getCanInterfaces();
        results.permissions = await this.checkPermissions();
      }
    } catch (error) {
      results.errors.push(`Erreur lors des vérifications: ${error.message}`);
    }

    return results;
  }

  /**
   * Vérifie si le support SocketCAN est disponible
   */
  async checkCanSupport() {
    const cacheKey = "can-support";
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Vérifier si le module can est chargé
      const { stdout } = await execAsync("lsmod | grep can");
      const hasCanModule = stdout.includes("can");

      this.cache.set(cacheKey, hasCanModule);
      return hasCanModule;
    } catch (error) {
      this.cache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Récupère la liste des interfaces CAN disponibles
   */
  async getCanInterfaces() {
    const cacheKey = "can-interfaces";
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const interfaces = [];

    try {
      // Méthode 1: ip link show
      try {
        const { stdout } = await execAsync("ip link show type can 2>/dev/null");
        const lines = stdout.split("\n");

        for (const line of lines) {
          const match = line.match(/^\d+:\s+(\w+):/);
          if (match) {
            interfaces.push(match[1]);
          }
        }
      } catch (error) {
        // Méthode alternative: parcourir /sys/class/net
        try {
          const netInterfaces = await fs.readdir("/sys/class/net");

          for (const iface of netInterfaces) {
            try {
              const typePath = `/sys/class/net/${iface}/type`;
              const type = await fs.readFile(typePath, "utf8");

              // Type 280 = CAN interface
              if (parseInt(type.trim()) === 280) {
                interfaces.push(iface);
              }
            } catch (e) {
              // Interface non accessible, on ignore
            }
          }
        } catch (e) {
          // Impossible d'accéder aux interfaces réseau
        }
      }
    } catch (error) {
      // Erreur générale, on retourne une liste vide
    }

    this.cache.set(cacheKey, interfaces);
    return interfaces;
  }

  /**
   * Vérifie les permissions pour les opérations CAN
   */
  async checkPermissions() {
    const cacheKey = "can-permissions";
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Vérifier si on peut créer un socket CAN (nécessite root ou CAP_NET_RAW)
      const uid = process.getuid ? process.getuid() : null;

      if (uid === 0) {
        // Root user
        this.cache.set(cacheKey, true);
        return true;
      }

      // Vérifier les capabilities (si disponible)
      try {
        const { stdout } = await execAsync("getcap $(which node) 2>/dev/null");
        const hasNetRaw = stdout.includes("cap_net_raw");
        this.cache.set(cacheKey, hasNetRaw);
        return hasNetRaw;
      } catch (error) {
        // getcap non disponible ou pas de capabilities
        this.cache.set(cacheKey, false);
        return false;
      }
    } catch (error) {
      this.cache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Vérifie si une interface CAN spécifique existe
   */
  async hasCanInterface(interfaceName) {
    const interfaces = await this.getCanInterfaces();
    return interfaces.includes(interfaceName);
  }

  /**
   * Crée une interface CAN virtuelle pour les tests
   */
  async createVirtualCanInterface(interfaceName = "vcan0") {
    try {
      // Vérifier si l'interface existe déjà
      if (await this.hasCanInterface(interfaceName)) {
        return true;
      }

      // Créer l'interface virtuelle
      await execAsync(`sudo modprobe vcan 2>/dev/null`);
      await execAsync(`sudo ip link add dev ${interfaceName} type vcan`);
      await execAsync(`sudo ip link set up ${interfaceName}`);

      // Vérifier que la création a réussi
      return await this.hasCanInterface(interfaceName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Supprime une interface CAN virtuelle
   */
  async removeVirtualCanInterface(interfaceName) {
    try {
      await execAsync(`sudo ip link delete ${interfaceName} 2>/dev/null`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtient des informations détaillées sur le système
   */
  async getSystemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      os: {
        type: os.type(),
        release: os.release(),
        hostname: os.hostname(),
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
      },
      uptime: os.uptime(),
    };
  }

  /**
   * Vérifie la connectivité réseau
   */
  async checkNetworkConnectivity() {
    try {
      const { stdout } = await execAsync("ping -c 1 -W 1 localhost");
      return stdout.includes("1 received");
    } catch (error) {
      return false;
    }
  }

  /**
   * Réinitialise le cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Génère un rapport complet du système
   */
  async generateSystemReport() {
    const report = {
      timestamp: new Date().toISOString(),
      system: await this.getSystemInfo(),
      checks: await this.performChecks(),
      connectivity: await this.checkNetworkConnectivity(),
    };

    return report;
  }
}

module.exports = { SystemChecker };
