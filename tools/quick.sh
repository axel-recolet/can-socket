#!/bin/bash

# Script ultra-simple pour test rapide
# Usage: ./quick.sh [IP]

PI_IP=${1:-"192.168.2.78"}

echo "⚡ Test rapide SocketCAN..."
ssh pi@$PI_IP "cd /home/pi/can-socket && sudo modprobe vcan && sudo ip link add dev vcan0 type vcan 2>/dev/null && sudo ip link set up vcan0 && node -e \"const n=require('./can_socket.node'); const s=n.createSocket('vcan0',false); n.sendFrame(s,0x123,[1,2,3,4],false,false); n.closeSocket(s); console.log('✅ SocketCAN OK');\" && sudo ip link delete vcan0"
