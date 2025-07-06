#!/usr/bin/env node

/**
 * Documentation Map - SocketCAN Neon Rust Project
 *
 * Ce script affiche un aperçu de toute la documentation du projet
 */

console.log("📚 SocketCAN Neon Rust - Documentation Map\n");

const docs = [
  {
    file: "README.md",
    type: "🏠 Guide Principal",
    description: "Installation, utilisation, exemples complets",
    audience: "Utilisateurs et développeurs",
  },
  {
    file: "IMPLEMENTATION_REPORT_CONSOLIDATED.md",
    type: "📊 Rapport Technique Complet",
    description:
      "Vue d'ensemble complète du projet, phases d'implémentation, architecture technique",
    audience: "Développeurs, chefs de projet",
  },
  {
    file: "ROADMAP.md",
    type: "🗺️ Feuille de Route",
    description:
      "Phases de développement, fonctionnalités planifiées et terminées",
    audience: "Équipe de développement",
  },
  {
    file: "FEATURES_COMPARISON.md",
    type: "🔍 Comparaison Fonctionnelle",
    description:
      "Comparaison détaillée avec la crate Rust socketcan officielle",
    audience: "Développeurs, évaluateurs techniques",
  },
  {
    file: "docs/TYPESCRIPT_API.md",
    type: "💻 Guide API TypeScript",
    description: "Guide développeur pour l'architecture TypeScript-first",
    audience: "Développeurs TypeScript",
  },
  {
    file: "legacy/reports/README.md",
    type: "📦 Archive Rapports",
    description: "Rapports historiques d'implémentation (archivés)",
    audience: "Référence historique",
  },
];

const examples = [
  {
    file: "src/exemple.ts",
    type: "📝 Exemple TypeScript",
    description: "Exemple de base en TypeScript",
  },
  {
    file: "advanced-can-demo.ts",
    type: "🚀 Démo Avancée",
    description: "Démonstration complète de toutes les fonctionnalités",
  },
  {
    file: "can-fd-demo.ts",
    type: "⚡ Démo CAN FD",
    description: "Exemples spécifiques CAN FD",
  },
  {
    file: "can-filter-demo.ts",
    type: "🎯 Démo Filtrage",
    description: "Exemples de filtrage avancé",
  },
];

const tests = [
  {
    file: "test-extended-ids.js",
    description: "Tests IDs étendus 29-bit",
  },
  {
    file: "test-can-fd.js",
    description: "Tests CAN FD",
  },
  {
    file: "test-can-filters.js",
    description: "Tests filtrage",
  },
  {
    file: "test-remote-frames.js",
    description: "Tests trames de requête",
  },
  {
    file: "test-error-frames.js",
    description: "Tests détection d'erreurs",
  },
  {
    file: "validate-all-features.js",
    description: "Validation complète fonctionnalités",
  },
  {
    file: "validate-typescript-api.js",
    description: "Validation API TypeScript",
  },
];

console.log("## 📖 Documentation Principale\n");
docs.forEach((doc) => {
  console.log(`${doc.type}: **${doc.file}**`);
  console.log(`   Description: ${doc.description}`);
  console.log(`   Audience: ${doc.audience}\n`);
});

console.log("## 🎯 Exemples et Démonstrations\n");
examples.forEach((ex) => {
  console.log(`${ex.type}: **${ex.file}**`);
  console.log(`   ${ex.description}\n`);
});

console.log("## 🧪 Tests et Validation\n");
tests.forEach((test) => {
  console.log(`📋 **${test.file}** - ${test.description}`);
});

console.log(`\n## 🚀 Guide de Lecture Recommandé\n`);
console.log("1. **Démarrage rapide**: README.md");
console.log(
  "2. **Vue d'ensemble technique**: IMPLEMENTATION_REPORT_CONSOLIDATED.md"
);
console.log("3. **Développement TypeScript**: docs/TYPESCRIPT_API.md");
console.log("4. **Comparaison fonctionnelle**: FEATURES_COMPARISON.md");
console.log("5. **Planification**: ROADMAP.md");
console.log("\n✨ Documentation complète et à jour !");
