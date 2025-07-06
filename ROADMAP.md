# SocketCAN Neon Rust - Development Roadmap

This document outlines the planned development phases to enhance our Node.js SocketCAN binding to match more features from the official `socketcan` Rust crate.

> 📋 **For complete project overview and technical details, see: [IMPLEMENTATION_REPORT_CONSOLIDATED.md](./IMPLEMENTATION_REPORT_CONSOLIDATED.md)**

## 🎯 Current Status: TypeScript-First Architecture (Completed)

### **API Generation from TypeScript** ✅

**Status**: 🟢 **COMPLETED**  
**Date**: July 2025  
**Effort**: Medium

**What was implemented**:

- ✅ **TypeScript-first architecture**: JavaScript API automatically generated from TypeScript sources
- ✅ **Single source maintenance**: Only TypeScript files need to be maintained
- ✅ **Automatic type generation**: `.d.ts` files generated automatically
- ✅ **Full compatibility**: Supports both CommonJS (`require()`) and ES6 (`import`)
- ✅ **Migration tooling**: Automated scripts to migrate from legacy JavaScript
- ✅ **Build integration**: Seamless TypeScript compilation in build process

**Architecture**:

```
src/main.ts → dist/src/main.js (+ .d.ts)
             ↓
        index.js (compatibility wrapper)
```

**Benefits**:

- 🎯 **Developer Experience**: Better IDE support, autocompletion, refactoring
- 🔧 **Maintenance**: No need to maintain separate JavaScript files
- 📝 **Documentation**: JSDoc embedded in generated types
- 🛡️ **Type Safety**: TypeScript validation before JavaScript generation

## Phase 1: Core Enhancements (High Priority)

### 1.1 Extended ID Support

**Status**: 🟡 Planned  
**Effort**: Medium  
**Description**: Add support for 29-bit extended CAN IDs

**Tasks**:

- [ ] Update Rust code to handle extended IDs
- [ ] Modify TypeScript types for ID union type
- [ ] Add validation for extended ID range
- [ ] Update examples and tests
- [ ] Document extended ID usage

**API Changes**:

```typescript
// New ID type
type CanId = StandardId | ExtendedId;

interface StandardId {
  type: "standard";
  id: number; // 0..=0x7FF
}

interface ExtendedId {
  type: "extended";
  id: number; // 0..=0x1FFFFFFF
}
```

### 1.2 CAN FD Frame Support

**Status**: 🟡 Planned  
**Effort**: High  
**Description**: Add support for CAN FD frames with up to 64 bytes

**Tasks**:

- [ ] Implement CanFdSocket in Rust
- [ ] Add CAN FD frame types
- [ ] Update data validation (up to 64 bytes)
- [ ] Add FD-specific socket options
- [ ] Create FD examples and tests

**API Changes**:

```typescript
// New frame types
interface CanFdFrame extends CanFrame {
  data: number[]; // up to 64 bytes
  flags: {
    brs: boolean; // Bit Rate Switch
    esi: boolean; // Error State Indicator
    fdf: boolean; // FD Format
  };
}

// New socket type
class CanFdSocket extends SocketCAN {
  // FD-specific methods
}
```

**Completed Features Summary**:

- ✅ Standard and Extended CAN IDs (11-bit and 29-bit)
- ✅ CAN FD socket support with up to 64-byte payloads
- ✅ Mixed frame type transmission and reception
- ✅ Comprehensive TypeScript types for all frame types
- ✅ Full parameter validation and error handling
- ✅ Cross-platform compatibility with Linux stubs

### 1.3 Frame Filtering

**Status**: 🟡 Planned  
**Effort**: Medium  
**Description**: Add CAN frame filtering capabilities

**Tasks**:

- [ ] Implement CanFilter in Rust
- [ ] Add filter configuration API
- [ ] Support multiple filter rules
- [ ] Add filter examples
- [ ] Document filtering patterns

**API Changes**:

```typescript
interface CanFilter {
  id: number;
  mask: number;
  inverted?: boolean;
}

class SocketCAN {
  setFilters(filters: CanFilter[]): Promise<void>;
  clearFilters(): Promise<void>;
}
```

## Phase 2: Advanced Features (Medium Priority)

### 2.1 Async API

**Status**: 🟡 Planned  
**Effort**: High  
**Description**: Convert to fully Promise-based async API

**Tasks**:

- [ ] Implement async Rust functions
- [ ] Use Tokio for async runtime
- [ ] Convert all operations to Promises
- [ ] Add async examples
- [ ] Performance testing

**API Changes**:

```typescript
class SocketCAN {
  async send(id: CanId, data: CanData): Promise<void>;
  async receive(timeout?: number): Promise<CanFrame>;
  async open(): Promise<void>;
  async close(): Promise<void>;
}
```

### 2.2 Remote Frames

**Status**: ✅ **COMPLETED**  
**Effort**: Medium  
**Description**: Add support for CAN remote request frames

**Tasks**:

- ✅ Implement remote frame types
- ✅ Add remote frame API
- ✅ Support request/response patterns
- ✅ Add remote frame examples
- ✅ Frame type detection utilities

**API Changes**:

```typescript
interface CanRemoteFrame {
  id: number;
  data: number[]; // Empty, length indicates DLC
  extended?: boolean;
  remote: true;
}

class SocketCAN {
  async sendRemote(
    id: number,
    dlc?: number,
    options?: { extended?: boolean }
  ): Promise<void>;
  static isRemoteFrame(frame: AnyCanFrame): frame is CanRemoteFrame;
}
```

### 2.3 Error Frames

**Status**: ✅ **COMPLETED**  
**Effort**: Medium  
**Description**: Add CAN error frame reception and processing

**Tasks**:

- ✅ Implement error frame reception
- ✅ Add error frame types
- ✅ Create error analysis utilities
- ✅ Add monitoring examples
- ✅ Frame type detection utilities

**API Changes**:

```typescript
interface CanErrorFrame {
  id: number;
  data: number[];
  extended?: boolean;
  error: true;
}

class SocketCAN {
  static isErrorFrame(frame: AnyCanFrame): frame is CanErrorFrame;
  // Error frames are received through normal receive() method
}
```

### 2.4 Socket Options

**Status**: 🟡 Planned  
**Effort**: Medium  
**Description**: Add advanced socket configuration options

**Tasks**:

- [ ] Implement socket options in Rust
- [ ] Add loopback control
- [ ] Add error frame reception control
- [ ] Add receive buffer configuration

**API Changes**:

```typescript
interface SocketOptions {
  loopback?: boolean;
  receiveOwnMessages?: boolean;
  errorFrames?: boolean;
  receiveBuffer?: number;
}

class SocketCAN {
  setOptions(options: SocketOptions): Promise<void>;
}
```

## Phase 3: Professional Features (Lower Priority)

### 3.1 Interface Management

**Status**: 🔴 Future  
**Effort**: High  
**Description**: Add network interface management via Netlink

**Tasks**:

- [ ] Implement Netlink support
- [ ] Add interface enumeration
- [ ] Add interface configuration
- [ ] Add bitrate management

### 3.2 Non-blocking I/O

**Status**: 🔴 Future  
**Effort**: Medium  
**Description**: Add non-blocking socket operations

**Tasks**:

- [ ] Implement non-blocking sockets
- [ ] Add event-driven API
- [ ] Performance optimization

### 3.3 Multiple Runtime Support

**Status**: 🔴 Future  
**Effort**: High  
**Description**: Support different async runtimes

**Tasks**:

- [ ] Tokio support
- [ ] async-std support
- [ ] Runtime selection API

## Phase 4: Ecosystem Integration (Future)

### 4.1 CLI Utilities

**Status**: 🔴 Future  
**Effort**: Medium  
**Description**: Add command-line utilities

**Tasks**:

- [ ] candump equivalent
- [ ] cansend equivalent
- [ ] Interface management tools

### 4.2 Protocol Libraries

**Status**: 🔴 Future  
**Effort**: High  
**Description**: Add higher-level protocol support

**Tasks**:

- [ ] CANopen support
- [ ] J1939 support
- [ ] OBD-II support

### 4.3 Testing Framework

**Status**: 🔴 Future  
**Effort**: Medium  
**Description**: Enhanced testing capabilities

**Tasks**:

- [ ] Virtual CAN automation
- [ ] Protocol simulation
- [ ] Performance benchmarks

## Implementation Timeline

### Q1 2025

- ✅ Basic SocketCAN implementation (completed)
- ✅ TypeScript support (completed)
- ✅ Documentation and examples (completed)

### Q2 2025

- 🟡 Extended ID support
- 🟡 CAN FD frame support
- 🟡 Frame filtering

### Q3 2025

- 🟡 Async API
- 🟡 Remote frames
- 🟡 Error frames

### Q4 2025

- 🟡 Socket options
- 🟡 Non-blocking I/O
- 🔴 Interface management

### 2026+

- 🔴 CLI utilities
- 🔴 Protocol libraries
- 🔴 Advanced testing

## Success Metrics

### Technical Metrics

- **API Coverage**: Reach 80% feature parity with socketcan crate
- **Performance**: <1ms latency for frame operations
- **Stability**: >99.9% uptime in production environments
- **Documentation**: 100% API documentation coverage

### Community Metrics

- **Downloads**: 1000+ weekly npm downloads
- **Contributors**: 5+ active contributors
- **Issues**: <24h response time
- **Stars**: 100+ GitHub stars

## Contributing

We welcome contributions to any phase of this roadmap. Please see our contributing guidelines and pick up issues tagged with the appropriate phase labels.

**Legend**:

- ✅ Completed
- 🟡 In Progress / Planned
- 🔴 Future / Not Started
