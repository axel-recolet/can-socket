# API JavaScript générée depuis TypeScript

Ce projet utilise maintenant une approche **TypeScript-first** pour générer automatiquement l'API JavaScript à partir des sources TypeScript. Cela évite la maintenance de fichiers JavaScript séparés.

## Architecture

```
src/
├── main.ts           # Point d'entrée TypeScript principal
├── socketcan.ts      # Classe SocketCAN principale
├── utils.ts          # Utilitaires
└── ...

dist/src/             # API JavaScript générée
├── main.js           # Point d'entrée JavaScript compilé
├── main.d.ts         # Déclarations TypeScript
├── socketcan.js      # Classe SocketCAN compilée
└── ...

types/
└── socketcan.ts      # Définitions de types TypeScript

index.js              # Wrapper de compatibilité (généré)
```

## Utilisation

### Pour les utilisateurs JavaScript (CommonJS)

```javascript
const SocketCAN = require("can-socket");

const can = new SocketCAN("vcan0");
await can.open();
await can.send({ id: 0x123, data: Buffer.from([1, 2, 3]) });
```

### Pour les utilisateurs TypeScript/ES6

```typescript
import { SocketCAN, CanFrame } from "can-socket";

const can = new SocketCAN("vcan0");
await can.open();

const frame: CanFrame = {
  id: 0x123,
  data: Buffer.from([1, 2, 3]),
};
await can.send(frame);
```

## Commandes de développement

### Génération de l'API JavaScript

```bash
# Générer l'API JavaScript depuis TypeScript
npm run generate-js

# Construction complète (Rust + TypeScript)
npm run build-all

# Vérification des types seulement
npm run type-check
```

### Migration des projets existants

```bash
# Migration automatique depuis les fichiers JS legacy
./scripts/migrate-to-typescript.sh
```

### Tests et exemples

```bash
# Utiliser l'API générée
npm run test
npm run example

# Développement TypeScript direct
npm run test-dev
npm run example-dev

# Utiliser les versions legacy (si disponibles)
npm run test-legacy
npm run example-legacy
```

## Avantages de cette approche

### ✅ Avantages

1. **Source unique de vérité** : Le code TypeScript est la seule source à maintenir
2. **Types automatiques** : Les déclarations TypeScript (`.d.ts`) sont générées automatiquement
3. **Compatibilité** : Supporte à la fois CommonJS (`require()`) et ES6 (`import`)
4. **Validation** : Le compilateur TypeScript valide le code avant génération
5. **Outillage** : Meilleur support IDE, autocomplétion, refactoring
6. **Documentation** : JSDoc intégré dans les types générés

### 🔧 Processus de développement simplifié

1. **Écrire** le code en TypeScript dans `src/`
2. **Compiler** avec `npm run build-ts`
3. **Utiliser** l'API JavaScript générée dans `dist/src/`

### 📦 Distribution

- Le fichier `package.json` pointe vers `dist/src/main.js` comme point d'entrée
- Les types TypeScript sont disponibles via `dist/src/main.d.ts`
- Un wrapper `index.js` assure la compatibilité avec les anciens imports

## Migration depuis les fichiers JS legacy

Si vous avez des fichiers JavaScript existants :

1. **Sauvegarde automatique** : Les anciens fichiers sont sauvegardés dans `legacy/js/`
2. **Wrapper de compatibilité** : Un nouveau `index.js` redirige vers l'API compilée
3. **Tests de régression** : Vérifiez que l'API générée fonctionne comme avant

```bash
# Migration complète
./scripts/migrate-to-typescript.sh

# Vérification
npm run test
```

## Personnalisation

### Configuration TypeScript

Le fichier `tsconfig.json` contrôle la génération JavaScript :

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "./dist",
    "declaration": true,
    "sourceMap": true
  }
}
```

### Scripts package.json

```json
{
  "scripts": {
    "generate-js": "npm run build-ts",
    "build-all": "npm run build-debug && npm run build-ts",
    "backup-legacy": "mkdir -p legacy && cp *.js legacy/"
  }
}
```

## Bonnes pratiques

1. **Ne jamais éditer** les fichiers dans `dist/` - ils sont générés automatiquement
2. **Utiliser TypeScript** pour tous les nouveaux développements
3. **Régénérer** l'API après chaque modification TypeScript
4. **Tester** l'API générée avant distribution
5. **Documenter** avec JSDoc dans le code TypeScript

## Dépannage

### Erreur "Module not found"

```bash
# Régénérer l'API
npm run generate-js

# Vérifier que dist/src/main.js existe
ls -la dist/src/main.js
```

### Types TypeScript manquants

```bash
# Vérifier la génération des déclarations
npm run type-check
npm run build-ts
```

### Compatibilité avec l'ancien code

```bash
# Utiliser le wrapper de compatibilité
node -e "console.log(require('./index.js'))"
```
