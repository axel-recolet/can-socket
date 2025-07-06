#!/bin/bash

# Script to copy the compiled Rust library to the format expected by Node.js

# Determine extension according to OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    EXT="so"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    EXT="dylib"
elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    EXT="dll"
else
    echo "Unsupported OS: $OSTYPE"
    exit 1
fi

# Build mode (debug or release)
MODE=${1:-debug}

# Source and destination paths
SRC_PATH="target/$MODE/libcan_socket.$EXT"
DEST_PATH="can_socket.node"

if [ -f "$SRC_PATH" ]; then
    cp "$SRC_PATH" "$DEST_PATH"
    echo "Copy from $SRC_PATH to $DEST_PATH successful"
else
    echo "Error: Source file $SRC_PATH not found"
    echo "Make sure you have compiled the project with: cargo build"
    exit 1
fi
