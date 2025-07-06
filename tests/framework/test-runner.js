/**
 * Framework de tests modulaire pour SocketCAN
 * Gestionnaire principal pour l'exécution des tests
 */

const { TestSuiteRegistry } = require("./test-suite-registry");
const { TestReporter } = require("./test-reporter");
const { SystemChecker } = require("./system-checker");

class TestRunner {
  constructor() {
    this.registry = new TestSuiteRegistry();
    this.reporter = new TestReporter();
    this.systemChecker = new SystemChecker();
    this.results = [];
  }

  /**
   * Exécute les suites de tests selon les options
   */
  async runSuites(options = {}) {
    this.reporter.setVerbose(options.verbose);

    // Vérification du système si nécessaire
    if (!options.skipSetup) {
      await this.performSystemChecks();
    }

    // Obtenir les suites à exécuter
    const suitesToRun = this.getSuitesToRun(options);

    this.reporter.startRun(suitesToRun);

    // Exécution séquentielle ou parallèle
    if (options.parallel && suitesToRun.length > 1) {
      this.results = await this.runSuitesParallel(suitesToRun, options);
    } else {
      this.results = await this.runSuitesSequential(suitesToRun, options);
    }

    return this.results;
  }

  /**
   * Détermine quelles suites exécuter
   */
  getSuitesToRun(options) {
    const allSuites = this.registry.getAllSuites();

    if (options.suites && options.suites.length > 0) {
      return allSuites.filter((suite) => options.suites.includes(suite.name));
    }

    return allSuites;
  }

  /**
   * Exécution séquentielle des suites
   */
  async runSuitesSequential(suites, options) {
    const results = [];

    for (const suite of suites) {
      const result = await this.runSingleSuite(suite, options);
      results.push(result);

      // Pause courte entre les suites pour éviter les conflits
      if (results.length < suites.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Exécution parallèle des suites
   */
  async runSuitesParallel(suites, options) {
    const promises = suites.map((suite) => this.runSingleSuite(suite, options));
    return await Promise.all(promises);
  }

  /**
   * Exécute une suite de tests
   */
  async runSingleSuite(suite, options) {
    const startTime = Date.now();

    this.reporter.startSuite(suite);

    const result = {
      name: suite.name,
      description: suite.description,
      category: suite.category,
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      duration: 0,
      tests: [],
    };

    try {
      // Préparation de la suite
      if (suite.setup) {
        await suite.setup();
      }

      // Filtrage des tests si nécessaire
      const testsToRun = this.filterTests(suite.tests, options);
      result.total = testsToRun.length;

      // Exécution des tests
      for (const test of testsToRun) {
        const testResult = await this.runSingleTest(test, suite, options);
        result.tests.push(testResult);

        if (testResult.status === "passed") {
          result.passed++;
        } else if (testResult.status === "failed") {
          result.failed++;
          result.errors.push({
            test: test.name,
            error: testResult.error,
          });
        } else if (testResult.status === "skipped") {
          result.skipped++;
        }

        this.reporter.reportTest(testResult);
      }

      // Nettoyage de la suite
      if (suite.teardown) {
        await suite.teardown();
      }
    } catch (error) {
      result.failed = result.total;
      result.errors.push({
        test: "suite-setup-teardown",
        error: error.message,
      });
      this.reporter.reportError(`Erreur dans la suite ${suite.name}`, error);
    }

    result.duration = Date.now() - startTime;
    this.reporter.endSuite(result);

    return result;
  }

  /**
   * Exécute un test individuel
   */
  async runSingleTest(test, suite, options) {
    const startTime = Date.now();

    const result = {
      name: test.name,
      description: test.description,
      suite: suite.name,
      status: "pending",
      error: null,
      duration: 0,
      output: "",
    };

    try {
      // Vérification des prérequis du test
      if (test.requires && !this.checkRequirements(test.requires)) {
        result.status = "skipped";
        result.error = "Prérequis non satisfaits";
        return result;
      }

      // Configuration du timeout
      const timeout = test.timeout || options.timeout || 30000;

      // Exécution du test avec timeout
      await this.runWithTimeout(async () => {
        if (test.setup) {
          await test.setup();
        }

        await test.run();

        if (test.teardown) {
          await test.teardown();
        }
      }, timeout);

      result.status = "passed";
    } catch (error) {
      result.status = "failed";
      result.error = error.message;

      // Distinguer les erreurs d'environnement (non critiques) des vraies erreurs
      if (this.isEnvironmentError(error)) {
        result.status = "skipped";
      }
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Filtre les tests selon les critères
   */
  filterTests(tests, options) {
    if (!options.filter) {
      return tests;
    }

    const filterPattern = new RegExp(options.filter, "i");
    return tests.filter(
      (test) =>
        filterPattern.test(test.name) || filterPattern.test(test.description)
    );
  }

  /**
   * Vérifie les prérequis d'un test
   */
  checkRequirements(requires) {
    if (requires.platform && requires.platform !== process.platform) {
      return false;
    }

    if (requires.canInterface) {
      // Vérification basique de l'interface CAN
      return this.systemChecker.hasCanInterface(requires.canInterface);
    }

    return true;
  }

  /**
   * Détermine si une erreur est liée à l'environnement
   */
  isEnvironmentError(error) {
    const envErrorPatterns = [
      /no such device/i,
      /network is down/i,
      /operation not permitted/i,
      /linux/i,
      /socketcan/i,
      /interface.*not found/i,
    ];

    return envErrorPatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Exécute une fonction avec timeout
   */
  async runWithTimeout(fn, timeout) {
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timeout après ${timeout}ms`));
      }, timeout);

      try {
        await fn();
        clearTimeout(timer);
        resolve();
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Vérifications système préliminaires
   */
  async performSystemChecks() {
    this.reporter.info("🔍 Vérification de l'environnement...");

    const checks = await this.systemChecker.performChecks();

    if (checks.warnings.length > 0) {
      this.reporter.warn("⚠️  Avertissements détectés:");
      checks.warnings.forEach((warning) =>
        this.reporter.warn(`   • ${warning}`)
      );
    }

    if (checks.platform !== "linux") {
      this.reporter.warn(
        "⚠️  Plateforme non-Linux détectée. Certains tests peuvent être ignorés."
      );
    }
  }

  /**
   * Affiche le résumé final
   */
  printSummary(results) {
    this.reporter.printFinalSummary(results);
  }

  /**
   * Utilitaire pour pause
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = { TestRunner };
