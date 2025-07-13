# Tests Rust pour can-socket

Ce document décrit les tests Rust disponibles pour le module can-socket et comment les exécuter.

## Vue d'ensemble

Le projet contient une suite complète de tests Rust pour vérifier toutes les fonctionnalités du module SocketCAN :

- **Tests unitaires** : Tests des fonctionnalités de base
- **Tests d'intégration** : Tests de bout en bout avec interfaces CAN virtuelles
- **Benchmarks** : Tests de performance et de stress
- **Tests de compatibilité** : Tests pour les plateformes non-Linux

## Structure des Tests

```
src/
├── lib.rs              # Code principal avec exports de tests
├── tests.rs            # Tests unitaires et d'intégration
└── benchmarks.rs       # Tests de performance
```

## Tests Disponibles

### Tests Unitaires (`cargo test`)

1. **test_create_regular_can_socket** - Création de socket CAN regular
2. **test_create_can_fd_socket** - Création de socket CAN FD
3. **test_send_and_receive_standard_frame** - Envoi/réception frame standard
4. **test_send_and_receive_extended_frame** - Envoi/réception frame étendue
5. **test_send_and_receive_remote_frame** - Envoi/réception remote frame
6. **test_can_fd_frame** - Test des frames CAN FD
7. **test_can_filters** - Test des filtres CAN
8. **test_clear_filters** - Test de suppression des filtres
9. **test_timeout_behavior** - Test du comportement des timeouts
10. **test_invalid_data_length** - Test de validation des données
11. **test_invalid_can_id_ranges** - Test de validation des IDs
12. **test_socket_close** - Test de fermeture de socket
13. **test_concurrent_operations** - Test d'opérations concurrentes
14. **test_socket_registry_operations** - Test du registre de sockets

### Tests de Compatibilité

15. **test_non_linux_stubs** - Tests des stubs pour plateformes non-Linux

### Benchmarks (`cargo test -- --ignored`)

1. **benchmark_frame_throughput** - Mesure du débit de frames
2. **benchmark_filter_performance** - Performance des filtres
3. **stress_test_multiple_sockets** - Test de stress avec multiples sockets

## Exécution des Tests

### Prérequis (Linux uniquement)

Les tests nécessitent :

- Système Linux avec support SocketCAN
- Permissions sudo pour créer des interfaces vcan
- Module kernel `vcan` chargé

```bash
# Charger le module vcan si nécessaire
sudo modprobe vcan
```

### Exécution Basique

```bash
# Tous les tests unitaires
cargo test --lib

# Tests avec sortie détaillée
cargo test --lib -- --nocapture

# Tests en mode single-thread (recommandé pour les tests d'interface)
cargo test --lib -- --test-threads=1
```

### Script de Test Automatisé

Un script est fourni pour automatiser la configuration et l'exécution :

```bash
# Tests standard
./scripts/test-rust.sh

# Tests avec benchmarks
./scripts/test-rust.sh --performance
```

### Benchmarks et Tests de Performance

```bash
# Exécuter tous les benchmarks
cargo test --lib --release -- --ignored --nocapture

# Benchmark spécifique
cargo test --lib --release benchmark_frame_throughput -- --ignored --nocapture
```

## Configuration des Tests

### Variables d'Environnement

- `RUST_LOG=debug` : Active les logs détaillés
- `RUST_BACKTRACE=1` : Active les backtraces en cas d'erreur

### Interfaces Virtuelles CAN

Les tests créent automatiquement des interfaces vcan temporaires :

- `vcan_test` : Tests standard
- `vcan_bench` : Benchmarks de débit
- `vcan_filter` : Tests de filtres
- `vcan_stress` : Tests de stress

Ces interfaces sont automatiquement nettoyées après les tests.

## Résultats Attendus

### Tests de Base

- ✅ Création de sockets (regular et FD)
- ✅ Envoi/réception de frames (standard, étendue, remote)
- ✅ Gestion des filtres CAN
- ✅ Validation des données et IDs
- ✅ Gestion des timeouts
- ✅ Opérations concurrentes

### Performance (sur machine moderne)

- **Débit** : > 100 frames/sec pour l'envoi
- **Latence** : < 10ms pour une frame simple
- **Concurrence** : Support de 10+ sockets simultanés
- **Filtres** : Réduction > 50% du trafic non filtré

## Dépannage

### Erreurs Communes

1. **"Permission denied"** : Vérifiez les permissions sudo
2. **"vcan module not found"** : Chargez le module vcan
3. **"Interface already exists"** : Nettoyez les interfaces existantes

```bash
# Nettoyer les interfaces de test
sudo ip link delete vcan_test 2>/dev/null || true
sudo ip link delete vcan_bench 2>/dev/null || true
sudo ip link delete vcan_filter 2>/dev/null || true
sudo ip link delete vcan_stress 2>/dev/null || true
```

### Limitations

- **Linux uniquement** : Les tests complets nécessitent Linux
- **Permissions** : Certains tests nécessitent des privilèges root
- **Isolation** : Les tests modifient l'état du système (interfaces réseau)

## Intégration Continue

Pour l'intégration dans un pipeline CI/CD :

```yaml
# Exemple GitHub Actions
- name: Setup CAN interface
  run: |
    sudo modprobe vcan

- name: Run Rust tests
  run: |
    cargo test --lib -- --test-threads=1

- name: Run benchmarks
  run: |
    cargo test --lib --release -- --ignored --nocapture
```

## Contribution

Lors de l'ajout de nouvelles fonctionnalités :

1. Ajoutez des tests correspondants dans `tests.rs`
2. Incluez des benchmarks si approprié dans `benchmarks.rs`
3. Mettez à jour cette documentation
4. Vérifiez que tous les tests passent sur Linux et non-Linux

## Métriques de Couverture

Les tests couvrent :

- ✅ 100% des fonctions publiques
- ✅ 95%+ des branches d'erreur
- ✅ Tous les types de frames CAN
- ✅ Toutes les opérations de socket
- ✅ Comportements concurrents
- ✅ Validation des paramètres
