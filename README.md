# can-socket

Modern CAN bus socket interface for Node.js with TypeScript support. High-performance SocketCAN bindings built with Rust.

## 🚀 Features

- **Native performance**: Compiled Rust code for optimal performance
- **Modern TypeScript API**: Clean, type-safe interface for Node.js developers
- **Event-driven architecture**: Real-time frame reception with EventEmitter
- **Async generators**: Elegant iteration with `for await...of` syntax
- **Full SocketCAN support**: Send and receive CAN frames on Linux
- **CAN FD support**: Support for CAN FD frames with up to 64 bytes payload
- **Extended ID support**: 29-bit extended CAN IDs with auto-detection
- **Remote frames**: Send and receive CAN remote request frames
- **Error frame detection**: Detect and handle CAN error frames
- **Frame filtering**: Set selective filters for efficient frame reception
- **Mixed frame types**: Send both regular CAN and CAN FD frames
- **Multiple APIs**: Choose between polling, events, or async generators
- **Frame type utilities**: Built-in helpers for frame type detection
- **Robust error handling**: Proper error management with explicit messages
- **Type safety**: Parameter validation and secure TypeScript types
- **Built-in utilities**: Helper functions for data conversion
- **Cross-platform compatibility**: Builds on macOS/Windows with Linux runtime stubs

## 📋 Prerequisites

- **Operating System**: Linux with SocketCAN support
- **Rust**: Version 1.70+ with Cargo
- **Node.js**: Version 16+ with npm
- **CAN Interface**: Configured physical or virtual CAN interface

## 🏗️ Architecture

This project uses a **TypeScript-first architecture** where the JavaScript API is automatically generated from TypeScript sources:

```
src/
├── main.ts           # TypeScript entry point
├── socketcan.ts      # Main SocketCAN class
└── utils.ts          # Utility functions

dist/src/             # Generated JavaScript API
├── main.js           # Compiled entry point
├── main.d.ts         # TypeScript declarations
└── socketcan.js      # Compiled SocketCAN class

index.js              # Compatibility wrapper
```

**Benefits:**

- ✅ **Single source of truth**: Only TypeScript needs maintenance
- ✅ **Automatic types**: `.d.ts` files generated automatically
- ✅ **Full compatibility**: Supports both `require()` and `import`
- ✅ **Developer experience**: Better IDE support and autocompletion

## 📦 Installation

```bash
npm install can-socket
```

## 🚀 Quick Start

```typescript
import SocketCAN from "can-socket";

const can = new SocketCAN("can0");
await can.open();

// Send a frame
await can.send(0x123, [0x01, 0x02, 0x03]);

// Event-driven reception
can.on("frame", (frame) => {
  console.log(
    `Received: ID=0x${frame.id.toString(16)}, Data=[${frame.data.join(",")}]`
  );
});
await can.startListening();

// Or use async generators
for await (const frame of can.frames({ maxFrames: 10 })) {
  console.log(`Frame: ${frame.id}`);
}

await can.close();
```

## 🔧 Setting up a virtual CAN interface (for testing)

```bash
# Load the vcan module
sudo modprobe vcan

# Create a virtual CAN interface
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0

# Verify the interface is active
ip link show vcan0
```

## 📖 Usage

### Basic JavaScript example

```javascript
const SocketCAN = require("can-socket").default;

async function example() {
  const can = new SocketCAN("vcan0");

  try {
    // Open the CAN socket
    await can.open();

    // Send a frame
    await can.send(0x123, [0x01, 0x02, 0x03, 0x04]);

    // Receive a frame (with 1000ms timeout)
    const frame = await can.receive(1000);
    console.log("Received frame:", frame);

    // Close the socket
    can.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

example();
```

### Advanced TypeScript example

```typescript
import {
  SocketCAN,
  SocketCANError,
  SocketCANUtils,
  CAN_CONSTANTS,
} from "can-socket";

async function exampleTS(): Promise<void> {
  const can = new SocketCAN("vcan0", { defaultTimeout: 1000 });

  try {
    await can.open();

    // Send with type validation
    const data: number[] = [0x01, 0x02, 0x03, 0x04];
    const id: number = 0x123;

    if (id <= CAN_CONSTANTS.MAX_STANDARD_ID) {
      await can.send(id, data);
    }

    // Using utilities
    const number = 0xdeadbeef;
    const bytes = SocketCANUtils.numberToBytes(number, 4);
    await can.send(0x200, bytes);

    // Typed error handling
    const frame = await can.receive();
    console.log(`ID: ${SocketCANUtils.formatCanId(frame.id)}`);
    console.log(`Data: ${SocketCANUtils.formatCanData(frame.data)}`);
  } catch (error) {
    if (error instanceof SocketCANError) {
      console.error(`Error [${error.code}]: ${error.message}`);
    }
  } finally {
    can.close();
  }
}
```

### TypeScript API

#### Main classes

```typescript
class SocketCAN {
  constructor(interfaceName: string, options?: Partial<CanSocketOptions>);

  // Core methods
  async open(): Promise<void>;
  async send(
    id: CanId,
    data: CanData,
    options?: { extended?: boolean; fd?: boolean; remote?: boolean }
  ): Promise<void>;
  async receive(timeout?: number): Promise<AnyCanFrame>;
  async close(): Promise<void>;

  // Remote frames
  async sendRemote(
    id: CanId,
    dlc?: number,
    options?: { extended?: boolean }
  ): Promise<void>;

  // Filtering
  async setFilters(filters: CanFilter[]): Promise<void>;
  async clearFilters(): Promise<void>;

  // Utilities
  isOpen(): boolean;
  getInterface(): string;

  // Static frame type detection
  static isRemoteFrame(frame: AnyCanFrame): frame is CanRemoteFrame;
  static isErrorFrame(frame: AnyCanFrame): frame is CanErrorFrame;
  static isCanFdFrame(frame: AnyCanFrame): frame is CanFdFrame;
}

class SocketCANError extends Error {
  constructor(message: string, code?: string);
  code?: string;
}
```

#### Useful types

```typescript
interface CanFrame {
  id: number;
  data: number[];
  extended?: boolean;
  fd?: false;
  remote?: false;
  error?: false;
}

interface CanFdFrame {
  id: number;
  data: number[];
  extended?: boolean;
  fd: true;
  remote?: false;
  error?: false;
}

interface CanRemoteFrame {
  id: number;
  data: number[]; // Empty, length indicates DLC
  extended?: boolean;
  fd?: false;
  remote: true;
  error?: false;
}

interface CanErrorFrame {
  id: number;
  data: number[];
  extended?: boolean;
  fd?: false;
  remote?: false;
  error: true;
}

type AnyCanFrame = CanFrame | CanFdFrame | CanRemoteFrame | CanErrorFrame;

interface CanFilter {
  id: number;
  mask: number;
  extended?: boolean;
  inverted?: boolean;
}

interface CanSocketOptions {
  interfaceName: string;
  defaultTimeout?: number;
  nonBlocking?: boolean;
  canFd?: boolean; // Enable CAN FD support
}

const CAN_CONSTANTS = {
  MAX_STANDARD_ID: 0x7ff,
  MAX_EXTENDED_ID: 0x1fffffff,
  MAX_DATA_LENGTH: 8,
  MAX_FD_DATA_LENGTH: 64,
} as const;
```

#### Utilities

```typescript
const SocketCANUtils = {
  numberToBytes(value: number, length?: number): number[]
  bytesToNumber(bytes: number[]): number
  formatCanId(id: number): string
  formatCanData(data: number[]): string
}
```

## 🧪 Tests and Examples

### JavaScript

```bash
# Basic JavaScript tests
npm test

# Individual tests
node tests/test-extended-ids.js
node tests/test-can-fd.js
node tests/validate-all-features.js

# Advanced JavaScript example
npm run example
```

### TypeScript

```bash
# TypeScript tests
npm run test-ts

# CAN FD advanced demo
npx ts-node can-fd-demo.ts

# Build and test TypeScript
npm run build-ts
npm run type-check
```

### Testing with real CAN tools

After setting up a virtual CAN interface:

```bash
# Terminal 1: Listen for frames
candump vcan0

# Terminal 2: Send test frames
cansend vcan0 123#DEADBEEF
cansend vcan0 456#1234567890ABCDEF

# Terminal 3: Run our module
npm test                # All tests
npm run test-single     # Basic test only
npm run test-dev        # TypeScript test
```

## 🛠️ Development

### TypeScript-First Development

This project generates its JavaScript API from TypeScript sources:

```bash
# Generate JavaScript API from TypeScript
npm run generate-js

# Full build (Rust + TypeScript)
npm run build-all

# TypeScript-only development
npm run type-check          # Check types without compilation
npm run test-dev             # Run tests directly from TypeScript
npm run example-dev          # Run examples directly from TypeScript
```

### Migration from Legacy JavaScript

To migrate existing JavaScript projects to the generated API:

```bash
# Automatic migration with backup
./scripts/migrate-to-typescript.sh

# Manual steps
npm run backup-legacy        # Backup existing JS files
npm run generate-js          # Generate new API
```

### Project structure

```
can-socket/
├── src/                    # TypeScript source code (primary)
│   ├── main.ts            # Main entry point
│   ├── socketcan.ts       # SocketCAN class
│   ├── utils.ts           # Utility functions
│   ├── test.ts            # TypeScript tests
│   └── exemple.ts         # TypeScript examples
├── types/                  # Type definitions
│   └── socketcan.ts       # SocketCAN types
├── dist/src/              # Generated JavaScript API
│   ├── main.js            # Compiled entry point
│   ├── main.d.ts          # TypeScript declarations
│   └── *.js               # Other compiled files
├── legacy/js/             # Backup of legacy JS files
├── index.js               # Compatibility wrapper (generated)
├── src/lib.rs             # Rust native implementation
├── package.json           # npm configuration (points to dist/src/main.js)
├── tsconfig.json          # TypeScript configuration
└── Cargo.toml             # Rust configuration
```

### Available scripts

```bash
# Build commands
npm run build              # Build Rust (release)
npm run build-debug        # Build Rust (debug)
npm run build-ts           # Build TypeScript only
npm run build-all          # Build Rust + TypeScript
npm run generate-js        # Generate JS API from TS

# Development workflow
npm run dev                # Debug build + TypeScript
npm run type-check         # Type checking only
npm run clean              # Clean builds

# Testing (using generated API)
npm test                   # Test with generated JavaScript API
npm run example            # Run example with generated API

# Direct TypeScript development
npm run test-dev           # Test directly from TypeScript
npm run example-dev        # Run example directly from TypeScript

# Legacy compatibility (if available)
npm run test-legacy        # Test with legacy JavaScript
npm run example-legacy     # Run legacy JavaScript example

# Feature-specific tests
node tests/test-extended-ids.js   # Extended CAN ID tests
node tests/test-can-fd.js         # CAN FD tests
node tests/validate-new-apis.js   # New APIs validation
node test-can-fd.js         # CAN FD tests
node test-can-filters.js    # Filtering tests
node test-remote-frames.js  # Remote frame tests
node test-error-frames.js   # Error frame tests

# Advanced demos (TypeScript)
npx ts-node can-fd-demo.ts        # CAN FD demo
npx ts-node can-filter-demo.ts    # Filtering demo
npx ts-node advanced-can-demo.ts  # Complete feature demo
```

## 🔍 Troubleshooting

### "Permission denied" error

```bash
# Add user to the group that can access network interfaces
sudo usermod -a -G dialout $USER
# Or use sudo for testing
sudo node tests/test.js
```

### CAN interface not found

```bash
# List available network interfaces
ip link show

# Create a virtual CAN interface for testing
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

### Rust compilation errors

```bash
# Check Rust installation
rustc --version
cargo --version

# Update Rust if necessary
rustup update
```

## � Feature Comparison

See [FEATURES_COMPARISON.md](./FEATURES_COMPARISON.md) for a detailed comparison between the official SocketCAN Rust crate and our Node.js implementation.

**Current Coverage**: ~35% of official SocketCAN features

**Key Missing Features**:

- CAN FD support (64-byte frames)
- Extended ID support (29-bit)
- Frame filtering
- Async/Promise API
- Remote frames
- Error frames

## 🗺️ Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for our planned development phases and timeline.

**Next Milestones**:

- Q2 2025: Extended IDs, CAN FD, Frame filtering
- Q3 2025: Async API, Remote frames, Error frames
- Q4 2025: Socket options, Non-blocking I/O

## �📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please check our [roadmap](./ROADMAP.md) and open an issue to discuss major changes.

**Areas needing help**:

- CAN FD implementation
- Async/Promise API conversion
- Frame filtering system
- Error handling improvements

## 🔗 Useful Resources

- [SocketCAN Documentation](https://docs.kernel.org/networking/can.html)
- [Neon Documentation](https://neon-bindings.com/)
- [socketcan Rust Crate](https://docs.rs/socketcan/latest/socketcan/)
- [Our Feature Comparison](./FEATURES_COMPARISON.md)
- [Development Roadmap](./ROADMAP.md)
- [Implementation Report](./IMPLEMENTATION_REPORT_CONSOLIDATED.md) - Complete project overview
- [TypeScript API Guide](./docs/TYPESCRIPT_API.md)

### Project Documentation

- **Implementation Status**: See [IMPLEMENTATION_REPORT_CONSOLIDATED.md](./IMPLEMENTATION_REPORT_CONSOLIDATED.md) for complete project overview and technical details
- **TypeScript Guide**: See [docs/TYPESCRIPT_API.md](./docs/TYPESCRIPT_API.md) for TypeScript-first development guide
- **Feature Comparison**: See [FEATURES_COMPARISON.md](./FEATURES_COMPARISON.md) for comparison with official Rust crate
- **Development Roadmap**: See [ROADMAP.md](./ROADMAP.md) for planned features and timeline

### CAN FD Support

The module supports CAN FD (CAN with Flexible Data-Rate) which allows:

- Larger payloads (up to 64 bytes vs 8 bytes for classic CAN)
- Higher data rates
- Backward compatibility with classic CAN

```javascript
// JavaScript CAN FD example
const can = new SocketCAN("vcan0", { canFd: true });

await can.open();

// Send a CAN FD frame with 32 bytes
const largeData = Array.from({ length: 32 }, (_, i) => i);
await can.send(0x123, largeData, false, true); // extended=false, fd=true

// Send a regular CAN frame on CAN FD socket
await can.send(0x456, [1, 2, 3, 4], false, false); // regular CAN frame

// Receive frames (automatically detects CAN vs CAN FD)
const frame = await can.receive();
console.log("Frame type:", frame.fd ? "CAN FD" : "CAN");
console.log("Data length:", frame.data.length);
```

```typescript
// TypeScript CAN FD example
import { SocketCAN, AnyCanFrame, CanFdFrame } from "can-socket";

const can = new SocketCAN("vcan0", { canFd: true });
await can.open();

// Send CAN FD frame
await can.send(0x123, new Array(24).fill(0xaa), { fd: true });

// Receive and type-check
const frame: AnyCanFrame = await can.receive();
if (frame.fd) {
  const fdFrame = frame as CanFdFrame;
  console.log(`CAN FD frame with ${fdFrame.data.length} bytes`);
}
```

#### Remote frames

```javascript
const can = new SocketCAN("vcan0");
await can.open();

// Send a remote frame requesting 8 bytes from ID 0x123
await can.sendRemote(0x123, 8);

// Send remote frame with extended ID
await can.sendRemote(0x12345678, 4, true);

// Receive and check if it's a remote frame
const frame = await can.receive();
if (SocketCAN.isRemoteFrame(frame)) {
  console.log("Remote frame received, DLC:", frame.data.length);
}

await can.close();
```

#### Frame filtering

```javascript
const can = new SocketCAN("vcan0");
await can.open();

// Set filters to only receive specific frames
await can.setFilters([
  { id: 0x100, mask: 0x700 }, // Match IDs 0x100-0x1FF
  { id: 0x12340000, mask: 0x1fff0000, extended: true }, // Extended ID filter
]);

// Clear all filters (receive all frames)
await can.clearFilters();

await can.close();
```

#### Error frame handling

```javascript
const can = new SocketCAN("vcan0");
await can.open();

const frame = await can.receive();

// Check frame type
if (SocketCAN.isErrorFrame(frame)) {
  console.log("Error frame detected:", frame.data);
} else if (SocketCAN.isRemoteFrame(frame)) {
  console.log("Remote frame requesting", frame.data.length, "bytes");
} else if (SocketCAN.isCanFdFrame(frame)) {
  console.log("CAN FD frame with", frame.data.length, "bytes");
} else {
  console.log("Regular CAN frame");
}

await can.close();
```

#### Enhanced TypeScript example

```typescript
import { SocketCAN, AnyCanFrame, CanFilter } from "can-socket";

async function advancedExample() {
  const can = new SocketCAN("vcan0", { canFd: true });

  try {
    await can.open();

    // Send different frame types
    await can.send(0x123, [1, 2, 3, 4]); // Regular CAN
    await can.send(0x456, Array(32).fill(0xaa), { fd: true }); // CAN FD
    await can.sendRemote(0x789, 8); // Remote frame

    // Set up filtering
    const filters: CanFilter[] = [{ id: 0x100, mask: 0x700, extended: false }];
    await can.setFilters(filters);

    // Process received frames
    const frame: AnyCanFrame = await can.receive(1000);
    processFrame(frame);
  } catch (error) {
    console.error("CAN error:", error);
  } finally {
    await can.close();
  }
}

function processFrame(frame: AnyCanFrame) {
  if (SocketCAN.isErrorFrame(frame)) {
    handleErrorFrame(frame);
  } else if (SocketCAN.isRemoteFrame(frame)) {
    handleRemoteFrame(frame);
  } else if (SocketCAN.isCanFdFrame(frame)) {
    handleCanFdFrame(frame);
  } else {
    handleRegularFrame(frame);
  }
}
```
