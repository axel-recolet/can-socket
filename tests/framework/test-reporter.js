/**
 * Système de rapport et d'affichage pour les tests
 * Gère l'affichage formaté des résultats de tests
 */

class TestReporter {
  constructor() {
    this.verbose = false;
    this.startTime = null;
    this.colors = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
      white: "\x1b[37m",
    };
  }

  /**
   * Active/désactive le mode verbeux
   */
  setVerbose(verbose) {
    this.verbose = verbose;
  }

  /**
   * Démarre le rapport d'exécution
   */
  startRun(suites) {
    this.startTime = Date.now();

    console.log(
      this.colorize("🧪 Démarrage de l'exécution des tests", "bright")
    );
    console.log(this.colorize("📊 Suites à exécuter:", "cyan"), suites.length);

    if (this.verbose) {
      suites.forEach((suite) => {
        console.log(
          this.colorize(`   • ${suite.name}`, "blue"),
          `(${suite.tests.length} tests)`
        );
      });
    }

    console.log("═".repeat(80));
  }

  /**
   * Démarre le rapport d'une suite
   */
  startSuite(suite) {
    console.log(
      `\n${this.colorize("📋", "magenta")} ${this.colorize(
        suite.name,
        "bright"
      )}`
    );
    console.log(this.colorize(`   ${suite.description}`, "cyan"));

    if (suite.category) {
      console.log(this.colorize(`   Catégorie: ${suite.category}`, "yellow"));
    }

    console.log("─".repeat(60));
  }

  /**
   * Rapporte le résultat d'un test
   */
  reportTest(testResult) {
    const status = this.getStatusIcon(testResult.status);
    const duration = this.formatDuration(testResult.duration);

    let line = `${status} ${testResult.name}`;

    if (this.verbose) {
      line += this.colorize(` (${duration})`, "cyan");
    }

    console.log(line);

    if (testResult.status === "failed" && this.verbose) {
      console.log(this.colorize(`     ❌ ${testResult.error}`, "red"));
    } else if (testResult.status === "skipped" && this.verbose) {
      console.log(this.colorize(`     ⏭️  ${testResult.error}`, "yellow"));
    }
  }

  /**
   * Termine le rapport d'une suite
   */
  endSuite(result) {
    const duration = this.formatDuration(result.duration);
    const successRate =
      result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;

    console.log("─".repeat(60));
    console.log(
      this.colorize(`📊 Résumé: `, "bright") +
        this.colorize(`${result.passed}`, "green") +
        "/" +
        this.colorize(`${result.total}`, "blue") +
        " réussis " +
        this.colorize(`(${successRate}%) `, "cyan") +
        this.colorize(`[${duration}]`, "yellow")
    );

    if (result.failed > 0 && !this.verbose) {
      console.log(this.colorize(`❌ ${result.failed} échec(s)`, "red"));
    }

    if (result.skipped > 0) {
      console.log(this.colorize(`⏭️  ${result.skipped} ignoré(s)`, "yellow"));
    }
  }

  /**
   * Affiche le résumé final
   */
  printFinalSummary(results) {
    const totalDuration = Date.now() - this.startTime;

    console.log("\n" + "═".repeat(80));
    console.log(this.colorize("📊 RÉSUMÉ FINAL DES TESTS", "bright"));
    console.log("═".repeat(80));

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Résumé par suite
    results.forEach((result) => {
      totalTests += result.total;
      totalPassed += result.passed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;

      const status = this.getSuiteStatusIcon(result);
      const successRate =
        result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;

      console.log(
        `${status} ${this.colorize(result.name, "bright")}: ` +
          `${this.colorize(result.passed, "green")}/${this.colorize(
            result.total,
            "blue"
          )} ` +
          `${this.colorize(`(${successRate}%)`, "cyan")}`
      );
    });

    console.log("─".repeat(80));

    // Statistiques globales
    const globalSuccessRate =
      totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

    console.log(this.colorize("🎯 TOTAL GLOBAL:", "bright"));
    console.log(`   • Tests exécutés: ${this.colorize(totalTests, "blue")}`);
    console.log(`   • Réussis: ${this.colorize(totalPassed, "green")}`);
    console.log(`   • Échecs: ${this.colorize(totalFailed, "red")}`);
    console.log(`   • Ignorés: ${this.colorize(totalSkipped, "yellow")}`);
    console.log(
      `   • Taux de réussite: ${this.colorize(`${globalSuccessRate}%`, "cyan")}`
    );
    console.log(
      `   • Durée totale: ${this.colorize(
        this.formatDuration(totalDuration),
        "magenta"
      )}`
    );

    // Message final
    if (totalFailed === 0) {
      console.log(
        `\n${this.colorize(
          "🎉 Tous les tests sont passés avec succès !",
          "green"
        )}`
      );
      console.log(
        this.colorize("✨ Le module SocketCAN fonctionne parfaitement", "green")
      );
    } else {
      console.log(
        `\n${this.colorize(`⚠️  ${totalFailed} test(s) ont échoué`, "yellow")}`
      );

      if (totalSkipped > 0) {
        console.log(
          this.colorize(
            "💡 Note: Les tests ignorés peuvent être normaux sur des systèmes",
            "cyan"
          )
        );
        console.log(
          this.colorize("   non-Linux ou sans interface CAN configurée", "cyan")
        );
      }

      // Affichage des erreurs détaillées
      if (this.verbose) {
        console.log("\n" + this.colorize("📋 DÉTAIL DES ERREURS:", "red"));
        results.forEach((result) => {
          if (result.errors.length > 0) {
            console.log(`\n${this.colorize(result.name, "bright")}:`);
            result.errors.forEach((error) => {
              console.log(
                `   • ${this.colorize(error.test, "red")}: ${error.error}`
              );
            });
          }
        });
      }
    }

    console.log("═".repeat(80));
  }

  /**
   * Affiche un message d'information
   */
  info(message) {
    console.log(this.colorize("ℹ️  " + message, "blue"));
  }

  /**
   * Affiche un avertissement
   */
  warn(message) {
    console.log(this.colorize("⚠️  " + message, "yellow"));
  }

  /**
   * Affiche une erreur
   */
  error(message) {
    console.log(this.colorize("❌ " + message, "red"));
  }

  /**
   * Rapporte une erreur avec détails
   */
  reportError(message, error) {
    this.error(message);
    if (this.verbose && error.stack) {
      console.log(this.colorize(error.stack, "red"));
    }
  }

  /**
   * Obtient l'icône de statut pour un test
   */
  getStatusIcon(status) {
    switch (status) {
      case "passed":
        return this.colorize("✅", "green");
      case "failed":
        return this.colorize("❌", "red");
      case "skipped":
        return this.colorize("⏭️", "yellow");
      default:
        return this.colorize("⏳", "cyan");
    }
  }

  /**
   * Obtient l'icône de statut pour une suite
   */
  getSuiteStatusIcon(result) {
    if (result.failed > 0) {
      return this.colorize("❌", "red");
    } else if (result.skipped > 0) {
      return this.colorize("⚠️", "yellow");
    } else {
      return this.colorize("✅", "green");
    }
  }

  /**
   * Formate une durée en millisecondes
   */
  formatDuration(ms) {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Applique une couleur au texte
   */
  colorize(text, color) {
    if (process.env.NO_COLOR || !process.stdout.isTTY) {
      return text;
    }

    const colorCode = this.colors[color] || this.colors.reset;
    return colorCode + text + this.colors.reset;
  }
}

module.exports = { TestReporter };
