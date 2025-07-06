# Guide de déploiement Linux/Raspberry Pi

## Prérequis sur Raspberry Pi

### 1. Préparation du Raspberry Pi
```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Créer le répertoire du projet
sudo mkdir -p /home/pi/can-socket
sudo chown pi:pi /home/pi/can-socket
```

### 2. Dépendances système
```bash
# Outils de compilation
sudo apt install -y build-essential curl git pkg-config

# Installer Node.js (version LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustup update

# can-utils (optionnel, pour les tests)
sudo apt install -y can-utils
```

### 3. Configuration SocketCAN
```bash
# Charger les modules kernel pour SocketCAN
sudo modprobe can
sudo modprobe can_raw
sudo modprobe vcan
sudo modprobe can-dev

# Ajouter les modules au démarrage
echo 'can' | sudo tee -a /etc/modules
echo 'can_raw' | sudo tee -a /etc/modules
echo 'vcan' | sudo tee -a /etc/modules
```

### 4. Interface CAN virtuelle pour tests
```bash
# Créer une interface CAN virtuelle
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0

# Vérifier l'interface
ip link show vcan0
```

## Installation du projet

### 1. Cloner et installer
```bash
# Aller dans le répertoire du projet
cd /home/pi/can-socket

# Si le projet vient d'un repository
# git clone <votre-repo> .

# Ou copier les fichiers depuis votre machine de développement
# scp -r /chemin/local/can-socket/* pi@raspberry-pi-ip:/home/pi/can-socket/

# Installer les dépendances
npm install

# Compiler le projet
npm run build-all
```

### 2. Test d'installation
```bash
# Exécuter le script de vérification
chmod +x test-raspberry-pi.sh
./test-raspberry-pi.sh
```

## Tests

```bash
# Exécuter tous les tests
npm test

# Tests individuels
npm run test:basic
npm run test:can-fd
npm run test:filters

# Test spécifique Raspberry Pi
./test-raspberry-pi.sh
```

## Configuration d'une interface CAN réelle

### MCP2515 (SPI) - Interface populaire pour Raspberry Pi
```bash
# Activer SPI
sudo raspi-config
# Interface Options > SPI > Enable

# Ou directement dans /boot/config.txt
echo 'dtparam=spi=on' | sudo tee -a /boot/config.txt

# Ajouter l'overlay MCP2515
echo 'dtoverlay=mcp2515-can0,oscillator=16000000,interrupt=25' | sudo tee -a /boot/config.txt

# Redémarrer
sudo reboot

# Après redémarrage, configurer l'interface
sudo ip link set can0 up type can bitrate 500000
```

### PiCAN (autre option populaire)
```bash
# Ajouter à /boot/config.txt
echo 'dtparam=spi=on' | sudo tee -a /boot/config.txt
echo 'dtoverlay=pican' | sudo tee -a /boot/config.txt

# Redémarrer et configurer
sudo reboot
sudo ip link set can0 up type can bitrate 500000
```

### Vérification de l'interface réelle
```bash
# Lister les interfaces CAN
ip link show | grep can

# Test avec can-utils
cansend can0 123#DEADBEEF
candump can0

# Test avec le module SocketCAN
node -e "
const can = require('/home/pi/can-socket');
const socket = new can.SocketCAN();
socket.open('can0');
console.log('Interface can0 opérationnelle');
socket.close();
"
```

## Automatisation et services

### 1. Service systemd pour démarrage automatique
```bash
# Créer un service
sudo tee /etc/systemd/system/can-interface.service << 'EOF'
[Unit]
Description=Configure CAN Interface
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c 'ip link set can0 up type can bitrate 500000'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Activer le service
sudo systemctl enable can-interface.service
sudo systemctl start can-interface.service
```

### 2. Script de monitoring
```bash
# Créer un script de monitoring
cat > /home/pi/can-socket/monitor-can.sh << 'EOF'
#!/bin/bash
while true; do
    if ! ip link show can0 | grep -q "UP"; then
        echo "$(date): Interface CAN0 down, attempting restart..."
        sudo ip link set can0 up type can bitrate 500000
    fi
    sleep 30
done
EOF

chmod +x /home/pi/can-socket/monitor-can.sh
```

## Dépannage

### Erreurs de compilation
```bash
# Vérifier Rust
rustc --version
cargo --version

# Réinstaller si nécessaire
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Nettoyer et recompiler
npm run clean
npm run build-all
```

### Erreurs d'interface CAN
```bash
# Vérifier les modules kernel
lsmod | grep can

# Recharger les modules
sudo modprobe -r vcan can_raw can
sudo modprobe can can_raw vcan

# Vérifier les permissions
ls -la /sys/class/net/
sudo usermod -a -G dialout pi
```

### Erreurs de permissions
```bash
# Ajouter l'utilisateur au groupe approprié
sudo usermod -a -G dialout,gpio,spi pi

# Redémarrer la session ou rebooter
sudo reboot
```

### Logs utiles
```bash
# Logs kernel pour CAN
dmesg | grep can

# Logs système
journalctl -u can-interface.service

# Tester la connectivité réseau CAN
ip link show | grep can
ip -s link show can0
```

## Performance et optimisation

### 1. Configuration pour haute fréquence
```bash
# Augmenter la taille des buffers
echo 'net.core.rmem_default = 262144' | sudo tee -a /etc/sysctl.conf
echo 'net.core.rmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### 2. Monitoring des performances
```bash
# Statistiques de l'interface
cat /proc/net/can/stats

# Utilisation CPU
htop

# Statistiques réseau CAN
ip -s link show can0
```
