# Analyse des Scripts NPM - SocketCAN

## 🔍 Scripts Actuels (26 scripts)

### 📦 Build & Compilation (8 scripts)

- ✅ `build` - Build release
- ✅ `build-debug` - Build debug
- ✅ `build-ts` - Compilation TypeScript
- ✅ `build-all` - Build complet
- ✅ `clean` - Nettoyage
- ✅ `type-check` - Vérification types
- 🔄 `dev` - Alias de build-all (REDONDANT)
- 🔄 `generate-js` - Génération JS (REDONDANT avec build-ts)

### 🏗️ Installation (3 scripts)

- ⚠️ `install` - Post-install (peut causer des problèmes)
- ✅ `prepare` - Pre-publish hook
- 🔄 `backup-legacy` - Sauvegarde legacy (OBSOLÈTE)

### 🧪 Tests (8 scripts)

- ✅ `test` - Tests principaux (via run-tests.js)
- ✅ `test-clean` - Tests nettoyés
- ✅ `test-core` - Tests core
- ✅ `test-advanced` - Tests avancés
- 🔄 `test-main` - Alias test-clean (REDONDANT)
- 🔄 `test-single` - Test unique (REDONDANT avec test)
- 🔄 `test-legacy` - Tests legacy (OBSOLÈTE)
- 🔄 `test-dev` - Tests en dev TypeScript (OBSOLÈTE)

### 🔍 Validation (3 scripts)

- ✅ `validate-api` - Validation API
- 🔄 `docs-map` - Mapping docs (OBSOLÈTE - script n'existe plus)
- 🔄 `docs-check` - Vérification docs (OBSOLÈTE - script n'existe plus)

### 📋 Exemples (4 scripts)

- ✅ `example` - Exemple principal
- 🔄 `example-legacy` - Exemple legacy (REDONDANT)
- 🔄 `example-dev` - Exemple dev TypeScript (OBSOLÈTE)

## 🗑️ Scripts à Supprimer (11 scripts)

### Redondants

- `dev` (alias de build-all)
- `generate-js` (même fonction que build-ts)
- `test-main` (alias de test-clean)
- `test-single` (redondant avec test)
- `example-legacy` (redondant avec example)

### Obsolètes

- `backup-legacy` (sauvegarde complétée)
- `test-legacy` (tests legacy obsolètes)
- `test-dev` (dev TypeScript obsolète)
- `example-dev` (dev TypeScript obsolète)
- `docs-map` (script n'existe plus)
- `docs-check` (script n'existe plus)

### Problématiques

- `install` (peut causer des boucles d'installation)

## ✅ Scripts Essentiels à Conserver (15 scripts)

### Build & Compilation (6)

- `build` - Build release
- `build-debug` - Build debug
- `build-ts` - Compilation TypeScript
- `build-all` - Build complet
- `clean` - Nettoyage
- `type-check` - Vérification types

### Installation (1)

- `prepare` - Pre-publish hook

### Tests (4)

- `test` - Tests principaux
- `test-clean` - Tests nettoyés
- `test-core` - Tests core
- `test-advanced` - Tests avancés

### Validation (1)

- `validate-api` - Validation API

### Exemples (1)

- `example` - Exemple principal

### Total: 13 scripts essentiels (réduction de 50%)
