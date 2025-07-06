#!/bin/bash

# Script minimal pour tests SocketCAN via SSH
# Usage: ./test-ssh.sh [IP] [user]

PI_IP=${1:-"192.168.2.78"}
PI_USER=${2:-"pi"}

echo "🧪 Tests SocketCAN sur $PI_USER@$PI_IP"
echo "===================================="

# Test direct du module natif SocketCAN
ssh "$PI_USER@$PI_IP" << 'EOF'
cd /home/pi/can-socket

echo "🔧 Préparation environnement CAN..."
sudo modprobe vcan 2>/dev/null || true
sudo ip link delete vcan0 2>/dev/null || true
sudo ip link add dev vcan0 type vcan && sudo ip link set up vcan0

echo ""
echo "🧪 Test SocketCAN natif..."
node -e "
const native = require('./can_socket.node');
console.log('✅ Module chargé');

try {
  // Test complet
  const socketId = native.createSocket('vcan0', false);
  console.log('✅ Socket créé:', socketId);
  
  native.sendFrame(socketId, 0x123, [0x01, 0x02, 0x03, 0x04], false, false);
  console.log('✅ Message envoyé: ID=0x123, Data=[01,02,03,04]');
  
  native.closeSocket(socketId);
  console.log('✅ Socket fermé');
  
  console.log('');
  console.log('🎉 SocketCAN fonctionne parfaitement sur Raspberry Pi !');
} catch (error) {
  console.log('❌ Erreur:', error.message);
  process.exit(1);
}
"

echo ""
echo "🧹 Nettoyage..."
sudo ip link delete vcan0 2>/dev/null || true
EOF

echo ""
echo "✅ Tests terminés"
