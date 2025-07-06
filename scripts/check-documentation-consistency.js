#!/usr/bin/env node

/**
 * Vérification de cohérence de la documentation
 *
 * Ce script vérifie que tous les documents sont cohérents entre eux
 */

const fs = require("fs");

console.log("🔍 Vérification de cohérence de la documentation\n");

let issues = 0;
let checks = 0;

function check(name, condition, message) {
  checks++;
  if (condition) {
    console.log(`✅ ${name}`);
  } else {
    console.log(`❌ ${name}: ${message}`);
    issues++;
  }
}

// Vérifier l'existence des fichiers principaux
const requiredFiles = [
  "README.md",
  "FEATURES_COMPARISON.md",
  "IMPLEMENTATION_REPORT_CONSOLIDATED.md",
  "ROADMAP.md",
  "docs/TYPESCRIPT_API.md",
];

requiredFiles.forEach((file) => {
  check(
    `Fichier ${file} existe`,
    fs.existsSync(file),
    `Fichier manquant: ${file}`
  );
});

// Vérifier les références croisées
if (fs.existsSync("README.md")) {
  const readme = fs.readFileSync("README.md", "utf8");

  check(
    "README référence FEATURES_COMPARISON",
    readme.includes("FEATURES_COMPARISON.md"),
    "README ne référence pas FEATURES_COMPARISON.md"
  );

  check(
    "README référence IMPLEMENTATION_REPORT_CONSOLIDATED",
    readme.includes("IMPLEMENTATION_REPORT_CONSOLIDATED.md"),
    "README ne référence pas le rapport consolidé"
  );

  check(
    "README référence ROADMAP",
    readme.includes("ROADMAP.md"),
    "README ne référence pas ROADMAP.md"
  );
}

if (fs.existsSync("FEATURES_COMPARISON.md")) {
  const features = fs.readFileSync("FEATURES_COMPARISON.md", "utf8");

  check(
    "FEATURES_COMPARISON référence le rapport consolidé",
    features.includes("IMPLEMENTATION_REPORT_CONSOLIDATED.md"),
    "FEATURES_COMPARISON ne référence pas le rapport consolidé"
  );

  check(
    "FEATURES_COMPARISON indique la date de mise à jour",
    features.includes("Last Updated"),
    "FEATURES_COMPARISON ne contient pas de date de mise à jour"
  );

  check(
    "FEATURES_COMPARISON montre Remote Frames comme implémenté",
    features.includes("✅ **IMPLEMENTED**") &&
      features.includes("Remote Frames"),
    "Remote Frames pas marqué comme implémenté"
  );

  check(
    "FEATURES_COMPARISON montre CAN FD comme implémenté",
    features.includes("CAN FD Support") &&
      features.includes("✅ **IMPLEMENTED**"),
    "CAN FD pas marqué comme implémenté"
  );
}

if (fs.existsSync("ROADMAP.md")) {
  const roadmap = fs.readFileSync("ROADMAP.md", "utf8");

  check(
    "ROADMAP référence le rapport consolidé",
    roadmap.includes("IMPLEMENTATION_REPORT_CONSOLIDATED.md"),
    "ROADMAP ne référence pas le rapport consolidé"
  );

  check(
    "ROADMAP montre architecture TypeScript comme terminée",
    roadmap.includes("TypeScript-First Architecture") &&
      roadmap.includes("COMPLETED"),
    "Architecture TypeScript pas marquée comme terminée"
  );
}

// Vérifier les anciens rapports archivés
check(
  "Anciens rapports archivés",
  fs.existsSync("legacy/reports/README.md") &&
    fs.existsSync("legacy/reports/IMPLEMENTATION_REPORT.md"),
  "Anciens rapports pas correctement archivés"
);

// Vérifier que les anciens rapports ne sont plus à la racine
check(
  "IMPLEMENTATION_REPORT.md retiré de la racine",
  !fs.existsSync("IMPLEMENTATION_REPORT.md"),
  "Ancien rapport encore présent à la racine"
);

check(
  "IMPLEMENTATION_REPORT_UPDATE.md retiré de la racine",
  !fs.existsSync("IMPLEMENTATION_REPORT_UPDATE.md"),
  "Ancien rapport de mise à jour encore présent à la racine"
);

check(
  "TYPESCRIPT_MIGRATION_REPORT.md retiré de la racine",
  !fs.existsSync("TYPESCRIPT_MIGRATION_REPORT.md"),
  "Rapport de migration encore présent à la racine"
);

// Vérifier la cohérence des statuts de fonctionnalités
if (
  fs.existsSync("FEATURES_COMPARISON.md") &&
  fs.existsSync("IMPLEMENTATION_REPORT_CONSOLIDATED.md")
) {
  const features = fs.readFileSync("FEATURES_COMPARISON.md", "utf8");
  const report = fs.readFileSync(
    "IMPLEMENTATION_REPORT_CONSOLIDATED.md",
    "utf8"
  );

  // Vérifier que les fonctionnalités marquées comme terminées dans un doc le sont dans l'autre
  const featuresHasRemoteFrames =
    features.includes("Remote Frames") &&
    features.includes("✅ **IMPLEMENTED**");
  const reportHasRemoteFrames =
    report.includes("Remote Frames") && report.includes("✅ **TERMINÉ**");

  check(
    "Cohérence Remote Frames entre documents",
    featuresHasRemoteFrames && reportHasRemoteFrames,
    "Statut Remote Frames incohérent entre FEATURES_COMPARISON et IMPLEMENTATION_REPORT"
  );
}

console.log(
  `\n📊 Résultats: ${checks - issues}/${checks} vérifications passées`
);

if (issues > 0) {
  console.log(`❌ ${issues} problème(s) de cohérence détecté(s)`);
  console.log("\n🔧 Actions recommandées:");
  console.log("1. Vérifier les références croisées entre documents");
  console.log("2. S'assurer que les statuts de fonctionnalités sont cohérents");
  console.log("3. Mettre à jour les dates et références si nécessaire");
  process.exit(1);
} else {
  console.log("✅ Tous les documents sont cohérents !");
  console.log("\n📚 La documentation est complète et bien structurée");
  console.log("🎯 Toutes les références croisées sont correctes");
  console.log("📋 Les statuts de fonctionnalités sont cohérents");
}
