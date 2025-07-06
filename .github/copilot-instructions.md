<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Copilot Instructions for SocketCAN Neon Rust

This project is a Node.js module using Neon to create Rust bindings to the Linux SocketCAN interface.

## Project Architecture

- **Rust**: Native code for SocketCAN interface in `src/lib.rs`
- **TypeScript**: Modern TypeScript API in `src/` with strict types
- **JavaScript**: Legacy JavaScript API in root files for compatibility
- **Neon**: Framework for creating bindings between Rust and Node.js

## Code Conventions

### Rust

- Use `thiserror` for error handling
- Follow standard Rust conventions (snake_case)
- Document public functions with `///`
- Handle errors appropriately with `Result<T, E>`

### TypeScript

- Use ES6 classes with strict types
- Document with JSDoc for public functions
- Prefer interfaces for data types
- Use enums and const assertions for constants
- Handle errors with typed error classes
- Use async/await for asynchronous operations

### JavaScript (legacy)

- Use ES6 classes to encapsulate logic
- Document with JSDoc
- Handle errors with try/catch and explicit messages
- Use async/await for asynchronous operations

### SocketCAN

- CAN IDs are 11-bit integers (0x000 to 0x7FF) or 29-bit for extended IDs
- CAN data is limited to 8 bytes maximum
- Always validate parameters before calling native functions

## Development Structure

- TypeScript source code in `src/`
- TypeScript types in `types/`
- Compiled code in `dist/`
- Use `npm run build-all` to compile Rust + TypeScript
- Use `npm run type-check` to check types without compilation

## Security

- Validate all parameters on the JavaScript side before passing to Rust code
- Properly handle resources (CAN sockets)
- Never expose raw pointers or handles on the JavaScript side

## Testing

- Test on a Linux environment with SocketCAN configured
- Use virtual CAN interfaces for testing (vcan)
- Check error cases (non-existent interface, insufficient permissions, etc.)
