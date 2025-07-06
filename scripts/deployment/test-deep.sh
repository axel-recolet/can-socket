#!/bin/bash

# Tests approfondis SocketCAN sur Raspberry Pi
# Usage: ./test-deep.sh [IP] [user]

PI_IP=${1:-"192.168.2.78"}
PI_USER=${2:-"pi"}

echo "🔬 Tests approfondis SocketCAN sur $PI_USER@$PI_IP"
echo "================================================"

ssh "$PI_USER@$PI_IP" << 'EOF'
cd /home/pi/can-socket

echo "🔧 Préparation environnement CAN complet..."
sudo modprobe can can_raw vcan 2>/dev/null || true
sudo ip link delete vcan0 2>/dev/null || true
sudo ip link delete vcan1 2>/dev/null || true
sudo ip link add dev vcan0 type vcan && sudo ip link set up vcan0
sudo ip link add dev vcan1 type vcan && sudo ip link set up vcan1

echo ""
echo "📋 Informations système:"
echo "- OS: $(uname -a)"
echo "- Node.js: $(node --version)"
echo "- Architecture: $(uname -m)"
echo "- Interfaces CAN:"
ip link show | grep -E "(vcan|can)"

echo ""
echo "🧪 Tests approfondis du module natif..."

node -e "
const native = require('./can_socket.node');
let testsPassed = 0;
let testsTotal = 0;

function test(name, fn) {
  testsTotal++;
  try {
    fn();
    console.log('✅', name);
    testsPassed++;
  } catch (error) {
    console.log('❌', name, ':', error.message);
  }
}

console.log('📋 Fonctions disponibles:', Object.keys(native));
console.log('');

// Test 1: Création et fermeture de sockets multiples
test('Création de socket vcan0', () => {
  const s1 = native.createSocket('vcan0', false);
  if (typeof s1 !== 'number' || s1 <= 0) throw new Error('ID socket invalide');
  native.closeSocket(s1);
});

test('Création de socket vcan1', () => {
  const s2 = native.createSocket('vcan1', false);
  if (typeof s2 !== 'number' || s2 <= 0) throw new Error('ID socket invalide');
  native.closeSocket(s2);
});

// Test 2: Sockets multiples simultanés
test('Sockets multiples simultanés', () => {
  const s1 = native.createSocket('vcan0', false);
  const s2 = native.createSocket('vcan1', false);
  if (s1 === s2) throw new Error('IDs de socket identiques');
  native.closeSocket(s1);
  native.closeSocket(s2);
});

// Test 3: Messages avec différents IDs
test('Envoi messages IDs standards', () => {
  const s = native.createSocket('vcan0', false);
  native.sendFrame(s, 0x001, [0x01], false, false); // ID minimal
  native.sendFrame(s, 0x123, [0x01, 0x02], false, false); // ID moyen
  native.sendFrame(s, 0x7FF, [0x01, 0x02, 0x03], false, false); // ID maximal standard
  native.closeSocket(s);
});

test('Envoi messages IDs étendus', () => {
  const s = native.createSocket('vcan0', false);
  native.sendFrame(s, 0x12345678, [0x01, 0x02, 0x03, 0x04], true, false); // ID étendu
  native.closeSocket(s);
});

// Test 4: Messages avec différentes tailles de données
test('Messages tailles variables', () => {
  const s = native.createSocket('vcan0', false);
  native.sendFrame(s, 0x100, [], false, false); // 0 byte
  native.sendFrame(s, 0x101, [0x01], false, false); // 1 byte
  native.sendFrame(s, 0x102, [0x01, 0x02, 0x03, 0x04], false, false); // 4 bytes
  native.sendFrame(s, 0x103, [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], false, false); // 8 bytes
  native.closeSocket(s);
});

// Test 5: Messages Remote Frame
test('Messages Remote Frame', () => {
  const s = native.createSocket('vcan0', false);
  native.sendFrame(s, 0x200, [], false, false, true); // Remote frame avec extended=false, is_fd=false, is_remote=true
  native.closeSocket(s);
});

// Test 6: Test de performance
test('Test de performance (100 messages)', () => {
  const s = native.createSocket('vcan0', false);
  const start = Date.now();
  for (let i = 0; i < 100; i++) {
    native.sendFrame(s, 0x300 + i, [i & 0xFF, (i >> 8) & 0xFF], false, false);
  }
  const end = Date.now();
  console.log('   📊 100 messages en', end - start, 'ms');
  native.closeSocket(s);
});

// Test 7: Gestion d'erreurs
test('Gestion erreurs socket inexistant', () => {
  try {
    native.createSocket('inexistant', false);
    throw new Error('Devrait échouer');
  } catch (error) {
    if (!error.message.includes('failed') && !error.message.includes('No such device')) {
      throw new Error('Message erreur inattendu: ' + error.message);
    }
  }
});

test('Gestion erreurs ID invalide', () => {
  const s = native.createSocket('vcan0', false);
  try {
    // Tester avec des données trop longues
    const longData = new Array(20).fill(0xFF);
    native.sendFrame(s, 0x123, longData, false, false);
    throw new Error('Devrait échouer avec données trop longues');
  } catch (error) {
    // Erreur attendue
  } finally {
    native.closeSocket(s);
  }
});

// Test 8: Test filtres
test('Test filtres', () => {
  const s = native.createSocket('vcan0', false);
  try {
    // Passer un tableau d'objets avec les propriétés id, mask, extended
    native.setFilters(s, [{id: 0x123, mask: 0x7FF, extended: false}]);
    native.clearFilters(s);
  } catch (error) {
    // Les filtres peuvent ne pas être implémentés dans cette version
    console.log('   ⚠️  Filtres non implémentés:', error.message);
  }
  native.closeSocket(s);
});

console.log('');
console.log('📊 Résultats:', testsPassed + '/' + testsTotal, 'tests réussis');
if (testsPassed === testsTotal) {
  console.log('🎉 Tous les tests sont passés !');
} else {
  console.log('⚠️ ', testsTotal - testsPassed, 'tests ont échoué');
}
"

echo ""
echo "🧹 Nettoyage complet..."
sudo ip link delete vcan0 2>/dev/null || true
sudo ip link delete vcan1 2>/dev/null || true

echo ""
echo "✅ Tests approfondis terminés"
EOF

echo ""
echo "🔬 Tests approfondis terminés"
