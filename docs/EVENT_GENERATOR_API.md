# Nouvelles APIs SocketCAN : Event-Based et Async Generator

Ce document décrit les nouvelles APIs ajoutées au module SocketCAN TypeScript pour permettre la réception de trames CAN de manière événementielle et via des générateurs asynchrones.

## Vue d'ensemble

En plus de l'API de polling existante (`receive()`), le module SocketCAN propose maintenant deux nouvelles approches pour recevoir des trames CAN :

1. **API Événementielle** - Basée sur EventEmitter pour une réception en temps réel
2. **API Générateur Asynchrone** - Pour itérer sur les trames avec for-await-of

## API Événementielle

La classe `SocketCAN` étend maintenant `EventEmitter` et offre une interface événementielle complète.

### Événements disponibles

```typescript
interface SocketCANEvents {
  frame: (frame: AnyCanFrame) => void; // Nouvelle trame reçue
  error: (error: SocketCANError) => void; // Erreur de réception
  close: () => void; // Socket fermé
  listening: () => void; // Écoute démarrée
  stopped: () => void; // Écoute arrêtée
}
```

### Méthodes principales

#### `startListening(options?: { interval?: number }): Promise<void>`

Démarre l'écoute automatique des trames CAN et émet des événements.

```typescript
const socket = new SocketCAN("vcan0");
await socket.open();

// Configuration des événements
socket.on("listening", () => console.log("Écoute démarrée"));
socket.on("frame", (frame) => console.log("Trame reçue:", frame));
socket.on("error", (error) => console.error("Erreur:", error));
socket.on("stopped", () => console.log("Écoute arrêtée"));

// Démarrer l'écoute (intervalle de 10ms par défaut)
await socket.startListening({ interval: 50 });
```

#### `stopListening(): void`

Arrête l'écoute des trames.

```typescript
socket.stopListening();
```

#### `get isListening(): boolean`

Indique si l'écoute est active.

```typescript
if (socket.isListening) {
  console.log("Écoute en cours...");
}
```

### Exemple complet - API Événementielle

```typescript
import SocketCAN from "./src/socketcan";

async function eventBasedExample() {
  const socket = new SocketCAN("vcan0");

  try {
    await socket.open();

    // Configuration des gestionnaires d'événements
    socket.on("frame", (frame) => {
      console.log(
        `Trame: ID=0x${frame.id.toString(16)}, Data=[${frame.data.join(",")}]`
      );
    });

    socket.on("error", (error) => {
      console.error("Erreur de réception:", error.message);
    });

    // Démarrer l'écoute
    await socket.startListening();

    // L'écoute continue jusqu'à appel de stopListening()
    // ou fermeture du socket
  } finally {
    socket.stopListening();
    await socket.close();
  }
}
```

## API Générateur Asynchrone

Les générateurs asynchrones permettent d'itérer sur les trames CAN avec la syntaxe `for await...of`.

### Méthodes principales

#### `frames(options?): AsyncGenerator<AnyCanFrame>`

Générateur principal qui yield toutes les trames reçues.

```typescript
// Options disponibles
interface FramesOptions {
  timeout?: number; // Timeout par trame (ms)
  maxFrames?: number; // Nombre maximum de trames
  filter?: (frame: AnyCanFrame) => boolean; // Filtre personnalisé
}
```

```typescript
// Exemple basique
for await (const frame of socket.frames({ maxFrames: 10 })) {
  console.log("Trame reçue:", frame);
}

// Avec filtre personnalisé
for await (const frame of socket.frames({
  filter: (f) => f.data.length > 4,
  maxFrames: 5,
})) {
  console.log("Trame avec plus de 4 bytes:", frame);
}
```

#### `framesWithId(canId, options?): AsyncGenerator<AnyCanFrame>`

Générateur qui yield seulement les trames avec un ID spécifique.

```typescript
// Écouter seulement les trames avec ID 0x123
for await (const frame of socket.framesWithId(0x123, { maxFrames: 5 })) {
  console.log("Trame 0x123:", frame);
}

// Avec objet CanId
import { SocketCANUtils } from "./src/socketcan";
const extendedId = SocketCANUtils.createExtendedId(0x12345678);
for await (const frame of socket.framesWithId(extendedId)) {
  console.log("Trame ID étendu:", frame);
}
```

#### `framesOfType<T>(frameType, options?): AsyncGenerator<T>`

Générateur qui yield seulement les trames d'un type spécifique.

```typescript
// Types disponibles: 'data' | 'remote' | 'error' | 'fd'

// Écouter seulement les trames de données
for await (const frame of socket.framesOfType("data", { maxFrames: 10 })) {
  console.log("Trame de données:", frame);
}

// Écouter les trames d'erreur
for await (const errorFrame of socket.framesOfType("error")) {
  console.log("Erreur CAN:", errorFrame);
}

// Écouter les trames CAN FD
for await (const fdFrame of socket.framesOfType("fd")) {
  console.log("Trame CAN FD:", fdFrame);
}
```

#### `collectFrames(options): Promise<AnyCanFrame[]>`

Collecte un nombre défini de trames dans un tableau.

```typescript
// Options requises
interface CollectOptions {
  maxFrames: number; // Nombre de trames à collecter (requis)
  timeout?: number; // Timeout par trame
  filter?: (frame: AnyCanFrame) => boolean; // Filtre optionnel
}
```

```typescript
// Collecter 10 trames
const frames = await socket.collectFrames({ maxFrames: 10 });
console.log(`${frames.length} trames collectées:`, frames);

// Collecter avec filtre
const dataFrames = await socket.collectFrames({
  maxFrames: 5,
  filter: (f) => !f.remote && !f.error,
});
```

### Exemple complet - API Générateur Asynchrone

```typescript
import SocketCAN from "./src/socketcan";

async function generatorExample() {
  const socket = new SocketCAN("vcan0");

  try {
    await socket.open();

    // Exemple 1: Traitement de base
    console.log("Traitement des 5 prochaines trames:");
    for await (const frame of socket.frames({ maxFrames: 5 })) {
      console.log(
        `ID: 0x${frame.id.toString(16)}, Data: [${frame.data.join(",")}]`
      );
    }

    // Exemple 2: Filtrage par ID
    console.log("Attente de trames avec ID 0x100:");
    for await (const frame of socket.framesWithId(0x100, { maxFrames: 3 })) {
      console.log("Trame 0x100 reçue:", frame);
    }

    // Exemple 3: Collecte en lot
    console.log("Collecte de 10 trames de données:");
    const dataFrames = await socket.collectFrames({
      maxFrames: 10,
      filter: (f) => !f.remote && !f.error && !f.fd,
    });

    console.log(`${dataFrames.length} trames de données collectées`);
  } finally {
    await socket.close();
  }
}
```

## Gestion des erreurs

Les deux APIs gèrent les erreurs de manière cohérente :

### Codes d'erreur spécifiques

```typescript
// Nouveaux codes d'erreur pour les APIs événementielles/générateur
"ALREADY_LISTENING"; // startListening() appelé alors que déjà en écoute
"LISTENING_ERROR"; // Erreur pendant l'écoute
"RECEIVE_TIMEOUT"; // Timeout de réception (normal en écoute)
```

### Gestion dans l'API événementielle

```typescript
socket.on("error", (error: SocketCANError) => {
  switch (error.code) {
    case "LISTENING_ERROR":
      console.error("Erreur d'écoute:", error.message);
      break;
    case "RECEIVE_TIMEOUT":
      // Généralement ignoré en écoute continue
      break;
    default:
      console.error("Erreur inattendue:", error);
  }
});
```

### Gestion dans l'API générateur

```typescript
try {
  for await (const frame of socket.frames()) {
    // Traitement des trames
  }
} catch (error) {
  if (error instanceof SocketCANError) {
    console.error(`Erreur SocketCAN [${error.code}]: ${error.message}`);
  } else {
    console.error("Erreur inattendue:", error);
  }
}
```

## Types TypeScript

Toutes les nouvelles APIs sont entièrement typées :

```typescript
// Interface d'événements typée
interface SocketCANEvents {
  frame: (frame: AnyCanFrame) => void;
  error: (error: SocketCANError) => void;
  close: () => void;
  listening: () => void;
  stopped: () => void;
}

// Méthodes EventEmitter typées
socket.on("frame", (frame) => {
  // 'frame' est automatiquement typé comme AnyCanFrame
});

// Générateurs typés
for await (const frame of socket.frames()) {
  // 'frame' est typé comme AnyCanFrame
}

for await (const dataFrame of socket.framesOfType("data")) {
  // 'dataFrame' est typé spécifiquement pour les trames de données
}
```

## Exemples d'usage pratiques

### Monitoring en temps réel

```typescript
async function monitorBusActivity() {
  const socket = new SocketCAN("can0");
  await socket.open();

  const stats = { total: 0, errors: 0, fd: 0 };

  socket.on("frame", (frame) => {
    stats.total++;
    if (frame.error) stats.errors++;
    if (frame.fd) stats.fd++;

    if (stats.total % 100 === 0) {
      console.log(
        `Stats: ${stats.total} trames, ${stats.errors} erreurs, ${stats.fd} FD`
      );
    }
  });

  await socket.startListening();
}
```

### Analyse de protocole

```typescript
async function analyzeProtocol() {
  const socket = new SocketCAN("can0");
  await socket.open();

  // Analyser la séquence de trames d'un ECU spécifique
  const ecuFrames: AnyCanFrame[] = [];

  for await (const frame of socket.framesWithId(0x123, { maxFrames: 50 })) {
    ecuFrames.push(frame);

    // Analyser les patterns dans les données
    if (frame.data[0] === 0xff) {
      console.log("Message de diagnostic détecté");
    }
  }

  console.log(`${ecuFrames.length} trames analysées`);
}
```

### Collecte de données pour test

```typescript
async function collectTestData() {
  const socket = new SocketCAN("vcan0");
  await socket.open();

  // Collecter différents types de trames
  const [dataFrames, errorFrames, fdFrames] = await Promise.all([
    socket.collectFrames({
      maxFrames: 10,
      filter: (f) => !f.error && !f.fd && !f.remote,
    }),
    socket.collectFrames({
      maxFrames: 5,
      filter: (f) => !!f.error,
    }),
    socket.collectFrames({
      maxFrames: 3,
      filter: (f) => !!f.fd,
    }),
  ]);

  return { dataFrames, errorFrames, fdFrames };
}
```

## Conclusion

Ces nouvelles APIs offrent une flexibilité considérable pour la réception de trames CAN :

- **API Événementielle** : Idéale pour le monitoring en temps réel et les applications réactives
- **API Générateur** : Parfaite pour le traitement séquentiel et l'analyse de données
- **Intégration transparente** : Compatibilité totale avec l'API existante
- **TypeScript complet** : Typage strict pour une meilleure sécurité de type

Les deux APIs peuvent être utilisées séparément ou en combinaison selon les besoins de votre application.
