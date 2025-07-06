# SocketCAN Neon Rust

> Modern CAN bus interface for Node.js with TypeScript support. High-performance SocketCAN bindings built with Rust and Neon.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2016.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux-orange.svg)](https://kernel.org/)

## 🚀 Features

- **High Performance**: Native Rust implementation with zero-copy operations
- **TypeScript First**: Full TypeScript support with complete type definitions
- **Modern API**: Promise-based async/await interface
- **CAN FD Support**: Extended frame format with up to 64 bytes payload
- **Frame Filtering**: Advanced filtering capabilities for selective reception
- **Cross-Platform**: Graceful fallback on non-Linux systems for development

## 📦 Installation

```bash
npm install can-socket
```

### Prerequisites

- **Linux system** with SocketCAN support
- **Node.js** ≥ 16.0.0
- **Rust toolchain** (for building from source)

## 🎯 Quick Start

### TypeScript

```typescript
import SocketCAN from 'can-socket';

async function main() {
  const can = new SocketCAN('can0');
  
  try {
    await can.open();
    
    // Send a frame
    await can.send(0x123, [0x01, 0x02, 0x03, 0x04]);
    
    // Receive a frame
    const frame = await can.receive(1000);
    console.log(`Received: ID=0x${frame.id.toString(16)}, Data=[${frame.data}]`);
    
  } finally {
    can.close();
  }
}
```

### JavaScript

```javascript
const SocketCAN = require('can-socket');

async function main() {
  const can = new SocketCAN('can0');
  
  await can.open();
  await can.send(0x123, [0x01, 0x02, 0x03, 0x04]);
  
  const frame = await can.receive(1000);
  console.log(`Received: ID=0x${frame.id.toString(16)}`);
  
  can.close();
}
```

## 📖 Documentation

### API Reference

- **[TypeScript API](docs/TYPESCRIPT_API.md)** - Complete TypeScript interface
- **[Event Generator API](docs/EVENT_GENERATOR_API.md)** - Event-driven programming

### Examples

Explore practical examples in the [`examples/`](examples/) directory:

- [`examples/can-fd-demo.ts`](examples/can-fd-demo.ts) - CAN FD frame handling
- [`examples/can-filter-demo.ts`](examples/can-filter-demo.ts) - Frame filtering
- [`examples/advanced-can-demo.ts`](examples/advanced-can-demo.ts) - Advanced features

## 🧪 Testing

```bash
# Run all tests
npm test

# Run clean organized tests
npm run test-clean

# Test specific features
npm run test-core      # Core functionality
npm run test-advanced  # Advanced features

# TypeScript validation
npm run validate-api
```

## 🏗️ Development

### Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd can-socket

# Install dependencies
npm install

# Build everything (Rust + TypeScript)
npm run build-all

# Run tests
npm run test-clean
```

### Project Structure

```
├── src/                 # TypeScript source code
├── tests/               # Organized test suites
├── examples/            # Usage examples and demos
├── docs/                # Documentation
├── tools/               # Build tools and utilities
├── scripts/             # Deployment and automation scripts
├── dist/                # Compiled TypeScript output
└── target/              # Rust build artifacts
```

### Available Scripts

```bash
npm run build-all       # Build Rust + TypeScript
npm run build-ts        # Compile TypeScript only
npm run type-check      # Check TypeScript types
npm run test-clean      # Run organized test suite
npm run validate-api    # Validate TypeScript API
```

## 🔧 Configuration

### CAN Interface Setup (Linux)

```bash
# Enable virtual CAN interface for testing
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0

# For real hardware interfaces
sudo ip link set can0 type can bitrate 500000
sudo ip link set up can0
```

## 🚀 Deployment

See [`scripts/deployment/`](scripts/deployment/) for deployment guides:

- **[Linux Deployment](scripts/deployment/LINUX_DEPLOYMENT.md)** - Production setup
- **[SSH Testing](scripts/deployment/test-ssh.sh)** - Remote testing tools

## 📊 Performance

- **Rust Core**: Zero-copy frame processing
- **Async Operations**: Non-blocking I/O with proper timeout handling
- **Memory Efficient**: Minimal JavaScript overhead
- **Type Safe**: Full TypeScript integration with compile-time checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm run test-clean`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- **[SocketCAN Documentation](https://www.kernel.org/doc/html/latest/networking/can.html)** - Linux kernel CAN subsystem
- **[Neon](https://neon-bindings.com/)** - Rust bindings for Node.js
- **[CANopen](https://github.com/CANopenNode/CANopenNode)** - CANopen protocol stack

## 🏆 Acknowledgments

- Linux SocketCAN subsystem developers
- Neon.js team for excellent Rust-Node.js bindings
- TypeScript team for making JavaScript development enjoyable

---

**Built with ❤️ using Rust, TypeScript, and Node.js**
