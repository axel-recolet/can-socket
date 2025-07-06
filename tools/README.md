# Build Tools and Utilities

This directory contains build tools, utilities, and helper scripts for the SocketCAN project.

## 📋 Available Tools

### Build Tools

- **[copy-native.sh](copy-native.sh)** - Native binary copying utility
- **[exports.json](exports.json)** - Module export configuration

### Test Utilities

- **[run-tests.js](run-tests.js)** - Legacy test runner (deprecated)

### Development Tools

- **[quick.sh](quick.sh)** - Quick development tasks

## 🔧 Tool Descriptions

### copy-native.sh

Cross-platform script that copies the compiled Rust binary to the correct location:

- Detects operating system (macOS, Linux, Windows)
- Handles different file extensions (.dylib, .so, .dll)
- Supports both debug and release builds

Usage:

```bash
./tools/copy-native.sh debug    # Copy debug build
./tools/copy-native.sh release  # Copy release build
```

### exports.json

Configuration file for module exports:

- Defines CommonJS and ES module entry points
- Specifies TypeScript definition files
- Configures conditional exports

### run-tests.js (Legacy)

Original test runner - **deprecated** in favor of the new organized test system in `tests/run-tests-clean.js`.

### quick.sh

Quick development helper for common tasks:

- Fast build cycles
- Quick testing
- Development setup

## 🚀 Usage in Build Process

These tools are integrated into the npm scripts:

```bash
# Build process uses copy-native.sh automatically
npm run build-debug   # Calls: cargo build && ./tools/copy-native.sh debug
npm run build         # Calls: cargo build --release && ./tools/copy-native.sh release
```

## 🔄 Migration Notes

The build system has been modernized:

- **Old**: Mixed scripts in root directory
- **New**: Organized tools in dedicated directory
- **Recommendation**: Use npm scripts instead of calling tools directly

## 🛠️ Maintenance

When adding new tools:

1. Place them in this `tools/` directory
2. Make them executable: `chmod +x tools/new-tool.sh`
3. Add documentation to this README
4. Integrate into npm scripts if needed

## 🔗 Related

- [Main Project README](../README.md)
- [Package.json Scripts](../package.json)
- [Build Documentation](../docs/BUILD.md)
