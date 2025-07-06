#!/bin/bash

# Script to copy the compiled Rust library to the format expected by Node.js
# Enhanced with ARM/Raspberry Pi support

# Determine extension according to OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    EXT="so"
    
    # Detect ARM architecture (Raspberry Pi)
    ARCH=$(uname -m)
    case $ARCH in
        armv6l|armv7l)
            echo "🍓 Raspberry Pi ARM detected: $ARCH"
            ;;
        aarch64)
            echo "🍓 Raspberry Pi ARM64 detected: $ARCH"
            ;;
        x86_64)
            echo "🐧 Linux x86_64 detected"
            ;;
        *)
            echo "⚠️  Unknown Linux architecture: $ARCH"
            ;;
    esac
    
elif [[ "$OSTYPE" == "darwin"* ]]; then
    EXT="dylib"
    echo "🍎 macOS detected"
elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    EXT="dll"
    echo "🪟 Windows detected"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

# Build mode (debug or release)
MODE=${1:-debug}

# Source and destination paths
SRC_PATH="target/$MODE/libcan_socket.$EXT"
DEST_PATH="can_socket.node"

# Check if we're on Linux and should check for SocketCAN availability
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🔌 Vérification de SocketCAN..."
    
    # Check if SocketCAN modules are available
    if ! lsmod | grep -q "can"; then
        echo "⚠️  Module CAN non chargé. Chargement..."
        if command -v modprobe &> /dev/null; then
            sudo modprobe can 2>/dev/null || echo "⚠️  Impossible de charger le module CAN"
            sudo modprobe can_raw 2>/dev/null || echo "⚠️  Impossible de charger le module can_raw"
            sudo modprobe vcan 2>/dev/null || echo "⚠️  Impossible de charger le module vcan"
        fi
    else
        echo "✅ Modules SocketCAN chargés"
    fi
fi

if [ -f "$SRC_PATH" ]; then
    cp "$SRC_PATH" "$DEST_PATH"
    echo "✅ Copie de $SRC_PATH vers $DEST_PATH réussie"
    
    # On Linux, verify the binary
    if [[ "$OSTYPE" == "linux-gnu"* ]] && command -v file &> /dev/null; then
        echo "📋 Informations du binaire:"
        file "$DEST_PATH"
    fi
    
else
    echo "❌ Erreur: Fichier source $SRC_PATH non trouvé"
    echo "   Assurez-vous d'avoir compilé le projet avec: cargo build"
    
    # Show available targets if on Linux
    if [[ "$OSTYPE" == "linux-gnu"* ]] && [ -d "target" ]; then
        echo "📁 Cibles disponibles dans target/:"
        find target -name "libcan_socket.*" -type f
    fi
    
    exit 1
fi
