# Tests SocketCAN - Organisation et Guide

## 🏗️ Structure Réorganisée

La suite de tests a été complètement réorganisée pour une meilleure maintenabilité, clarté et extensibilité.

### 📁 Structure des Dossiers

```
tests/
├── index.js                    # Point d'entrée principal
├── framework/                  # Framework de tests modulaire
│   ├── test-runner.js          # Gestionnaire d'exécution
│   ├── test-suite-registry.js  # Registre des suites
│   ├── test-reporter.js        # Système de rapport
│   └── system-checker.js       # Vérifications système
├── suites/                     # Suites de tests organisées
│   ├── core.js                 # Tests fondamentaux
│   ├── advanced.js             # Fonctionnalités avancées
│   ├── integration.js          # Tests d'intégration
│   └── performance.js          # Tests de performance
├── utils/                      # Utilitaires partagés
│   └── test-helpers.js         # Helpers et validateurs
└── run-tests-clean.js         # Ancien système (legacy)
```

## 🚀 Utilisation

### Commandes Principales

```bash
# Exécuter tous les tests
npm test

# Tests par suite spécifique
npm run test:core          # Tests fondamentaux
npm run test:advanced      # Fonctionnalités avancées
npm run test:integration   # Tests d'intégration
npm run test:performance   # Tests de performance

# Options d'exécution
npm run test:parallel      # Exécution parallèle
npm run test:verbose       # Mode verbeux avec détails
```

### Commandes Avancées

```bash
# Avec filtrage
node tests/index.js --filter "frame"     # Tests contenant "frame"
node tests/index.js --suite core --verbose

# Avec timeout personnalisé
node tests/index.js --timeout 60000

# Tests spécifiques avec options
node tests/index.js --suite performance --parallel --verbose
```

### Options Disponibles

| Option               | Alias | Description                      |
| -------------------- | ----- | -------------------------------- |
| `--suite <name>`     | `-s`  | Exécute une suite spécifique     |
| `--parallel`         | `-p`  | Exécution en parallèle           |
| `--verbose`          | `-v`  | Mode verbeux avec détails        |
| `--filter <pattern>` | `-f`  | Filtre les tests par nom         |
| `--timeout <ms>`     | `-t`  | Timeout personnalisé             |
| `--skip-setup`       |       | Ignore la configuration initiale |
| `--help`             | `-h`  | Affiche l'aide                   |

## 📋 Suites de Tests

### 🔧 Core (Fondamentaux)

- Chargement du module
- Création/destruction de sockets
- Validation des trames
- Gestion des erreurs
- Types TypeScript

### ⚡ Advanced (Avancées)

- Support CAN FD
- Filtres CAN
- IDs étendus 29-bit
- Trames Remote (RTR)
- Gestion des erreurs de bus

### 🔗 Integration (Intégration)

- Liaison avec interfaces CAN
- Communication bidirectionnelle
- Sockets multiples
- Application de filtres en temps réel
- Tests de charge

### 🏎️ Performance (Performance)

- Débit maximum
- Latence ping-pong
- Utilisation mémoire
- Accès concurrent
- Nettoyage des ressources

## 🛠️ Fonctionnalités du Framework

### Gestionnaire d'Exécution

- Exécution séquentielle ou parallèle
- Gestion des timeouts
- Retry automatique
- Isolation des tests

### Système de Rapport

- Affichage coloré et formaté
- Métriques de performance
- Statistiques détaillées
- Mode verbeux configurable

### Vérifications Système

- Détection de plateforme
- Interfaces CAN disponibles
- Permissions utilisateur
- Modules kernel

### Utilitaires Partagés

- Validateurs de trames
- Générateurs de données test
- Helpers asynchrones
- Collecteur de métriques

## 🔍 Détection d'Environnement

Le framework détecte automatiquement :

- **Plateforme** : Linux vs autres OS
- **Interfaces CAN** : Disponibilité et état
- **Permissions** : Capacités réseau
- **Modules** : SocketCAN, CAN FD

Les tests s'adaptent automatiquement à l'environnement disponible.

## 📊 Métriques et Rapport

### Métriques Collectées

- Nombre de tests exécutés/réussis/échoués
- Temps d'exécution par test et suite
- Débit (trames/seconde)
- Latence (min/max/moyenne/médiane)
- Utilisation mémoire
- Taux de perte

### Rapport Final

```
🎯 TOTAL GLOBAL:
   • Tests exécutés: 42
   • Réussis: 38
   • Échecs: 2
   • Ignorés: 2
   • Taux de réussite: 90%
   • Durée totale: 45.2s
```

## 🔧 Configuration et Personnalisation

### Variables d'Environnement

```bash
export NO_COLOR=1              # Désactive les couleurs
export NODE_ENV=development    # Mode développement
```

### Prérequis Linux

```bash
# Installation modules CAN
sudo modprobe can
sudo modprobe vcan

# Interface virtuelle de test
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

## 🐛 Debugging et Développement

### Mode Debug

```bash
# Tests avec stack traces complètes
NODE_ENV=development npm test

# Tests avec garbage collection forcé
node --expose-gc tests/index.js --suite performance
```

### Ajout de Nouveaux Tests

1. **Créer une nouvelle suite** :

```javascript
// tests/suites/ma-suite.js
const { TestSuiteRegistry } = require("../framework/test-suite-registry");

const maSuite = {
  name: "ma-suite",
  description: "Description de ma suite",
  category: "custom",
  tests: [
    {
      name: "mon-test",
      description: "Description du test",
      async run() {
        // Logique du test
      },
    },
  ],
};

TestSuiteRegistry.registerSuite(maSuite);
```

2. **Importer dans index.js** :

```javascript
require("./suites/ma-suite");
```

### Extension du Framework

Le framework est extensible via :

- Nouveaux validateurs dans `utils/test-helpers.js`
- Reporters personnalisés
- Checkers système additionnels
- Métriques spécialisées

## 📈 Migration depuis l'Ancien Système

L'ancien système reste disponible :

```bash
npm run test:legacy
```

Les tests existants peuvent être migrés progressivement vers le nouveau framework.

## 🎯 Bonnes Pratiques

1. **Organisation** : Grouper les tests par fonctionnalité
2. **Isolation** : Chaque test doit être indépendant
3. **Nettoyage** : Libérer les ressources en fin de test
4. **Validation** : Vérifier les entrées avant les opérations
5. **Timeout** : Définir des timeouts appropriés
6. **Métriques** : Mesurer les performances critiques

## 📚 Ressources

- [SocketCAN Documentation](https://www.kernel.org/doc/Documentation/networking/can.txt)
- [CAN FD Specification](https://www.can-cia.org/can-knowledge/can/can-fd/)
- [Node.js Testing Guide](https://nodejs.org/api/test.html)

---

🚀 **La nouvelle architecture de tests offre une base solide pour le développement et la validation continue du module SocketCAN.**
