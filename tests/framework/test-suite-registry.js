/**
 * Registre des suites de tests
 * Centralise l'enregistrement et la gestion des suites de tests
 */

class TestSuiteRegistry {
  constructor() {
    this.suites = new Map();
    this.categories = new Set();
  }

  /**
   * Enregistre une nouvelle suite de tests
   */
  register(suite) {
    this.validateSuite(suite);

    this.suites.set(suite.name, suite);
    this.categories.add(suite.category);

    return this;
  }

  /**
   * Récupère une suite par nom
   */
  getSuite(name) {
    return this.suites.get(name);
  }

  /**
   * Récupère toutes les suites
   */
  getAllSuites() {
    return Array.from(this.suites.values());
  }

  /**
   * Récupère les suites par catégorie
   */
  getSuitesByCategory(category) {
    return this.getAllSuites().filter((suite) => suite.category === category);
  }

  /**
   * Récupère toutes les catégories
   */
  getCategories() {
    return Array.from(this.categories);
  }

  /**
   * Vérifie qu'une suite est valide
   */
  validateSuite(suite) {
    if (!suite.name) {
      throw new Error("Suite must have a name");
    }

    if (!suite.description) {
      throw new Error("Suite must have a description");
    }

    if (!suite.category) {
      throw new Error("Suite must have a category");
    }

    if (!Array.isArray(suite.tests)) {
      throw new Error("Suite must have a tests array");
    }

    // Validation des tests
    suite.tests.forEach((test, index) => {
      if (!test.name) {
        throw new Error(`Test at index ${index} must have a name`);
      }

      if (!test.run || typeof test.run !== "function") {
        throw new Error(`Test "${test.name}" must have a run function`);
      }
    });
  }

  /**
   * Enregistre une suite via une fonction helper
   */
  static registerSuite(config) {
    const registry = TestSuiteRegistry.getInstance();
    return registry.register(config);
  }

  /**
   * Singleton pattern pour un accès global
   */
  static getInstance() {
    if (!TestSuiteRegistry.instance) {
      TestSuiteRegistry.instance = new TestSuiteRegistry();
    }
    return TestSuiteRegistry.instance;
  }
}

module.exports = { TestSuiteRegistry };
