# SocketCAN Examples

This directory contains practical examples demonstrating various features of the SocketCAN Neon Rust module.

## 📋 Available Examples

### Basic Usage

- **[exemple.js](exemple.js)** - Basic JavaScript usage example

### Advanced Features

- **[can-fd-demo.ts](can-fd-demo.ts)** - CAN FD (Flexible Data-rate) demonstration
- **[can-filter-demo.ts](can-filter-demo.ts)** - Frame filtering and selective reception
- **[event-generator-demo.ts](event-generator-demo.ts)** - Event-driven programming patterns
- **[advanced-can-demo.ts](advanced-can-demo.ts)** - Advanced SocketCAN features
- **[advanced-demo.ts](advanced-demo.ts)** - Comprehensive feature showcase

## 🚀 Running Examples

### Prerequisites

```bash
# Enable virtual CAN interface (Linux)
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

### TypeScript Examples

```bash
# Build the project first
npm run build-all

# Run TypeScript examples
npx ts-node examples/can-fd-demo.ts
npx ts-node examples/can-filter-demo.ts
```

### JavaScript Examples

```bash
# Run compiled JavaScript
node examples/exemple.js
```

## 📖 Example Descriptions

### CAN FD Demo (`can-fd-demo.ts`)

Demonstrates the use of CAN FD (Flexible Data-rate) which allows:

- Frame sizes up to 64 bytes (vs 8 bytes in classic CAN)
- Higher data transmission rates
- Backward compatibility with classic CAN

### Filter Demo (`can-filter-demo.ts`)

Shows how to implement frame filtering:

- ID-based filtering
- Mask-based filtering
- Multiple filter configurations
- Performance optimization for high-traffic networks

### Event Generator (`event-generator-demo.ts`)

Event-driven programming patterns:

- Async iterators for frame streams
- Event emitter patterns
- Frame type detection
- Error handling

### Advanced Demo (`advanced-can-demo.ts`)

Comprehensive showcase of advanced features:

- Extended 29-bit CAN IDs
- Remote frames
- Error frame detection
- Bus monitoring
- Performance metrics

## 🔧 Customization

All examples can be customized by modifying:

- **CAN interface**: Change `'vcan0'` to your interface
- **CAN IDs**: Modify frame identifiers
- **Data payloads**: Customize frame data
- **Timeouts**: Adjust reception timeouts

## 💡 Best Practices

1. **Always handle errors** - CAN networks can be unreliable
2. **Use appropriate timeouts** - Prevent blocking operations
3. **Filter frames** - Reduce CPU load in high-traffic scenarios
4. **Clean up resources** - Always close sockets when done
5. **Test with virtual CAN** - Use vcan for development

## 🔗 Related Documentation

- [TypeScript API Documentation](../docs/TYPESCRIPT_API.md)
- [Event Generator API](../docs/EVENT_GENERATOR_API.md)
- [Main README](../README.md)
