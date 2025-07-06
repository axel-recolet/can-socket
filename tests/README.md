# Tests et Validation

Ce dossier contient tous les tests et scripts de validation pour le projet can-socket.

## Structure des tests

### Tests de fonctionnalités

- `test.js` - Test de base de l'API SocketCAN
- `test-can-fd.js` - Tests spécifiques à CAN FD
- `test-can-filters.js` - Tests des filtres CAN
- `test-error-frames.js` - Tests de gestion des frames d'erreur
- `test-extended-ids.js` - Tests des IDs CAN étendus (29-bit)
- `test-remote-frames.js` - Tests des frames remote
- `test-final-implementation.js` - Tests complets de l'implémentation
- `test-new-name.js` - Tests après le renommage du projet

### Scripts de validation

- `validate-all-features.js` - Validation complète de toutes les fonctionnalités
- `validate-implementation.js` - Validation de l'implémentation de base
- `validate-new-apis.js` - Validation des nouvelles APIs (EventEmitter, async generators)
- `validate-typescript-api.js` - Validation de l'API TypeScript (JavaScript)
- `validate-typescript-api.ts` - Validation de l'API TypeScript (TypeScript natif)

## Utilisation

Pour exécuter les tests depuis la racine du projet :

```bash
# Test individuel
node tests/test.js

# Validation complète
node tests/validate-all-features.js

# Test TypeScript
npx ts-node tests/validate-typescript-api.ts
```

## Prérequis

- Interface CAN virtuelle configurée (vcan0)
- Build du projet effectué (`npm run build-all`)
- Pour les tests TypeScript : `ts-node` installé

## Configuration de l'interface CAN virtuelle

```bash
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```
