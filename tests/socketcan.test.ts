import path from "path";

describe("can-socket basic module loading", () => {
  it("should import the SocketCAN module without errors", () => {
    const modulePath = path.resolve(__dirname, "../dist/src/main");
    // Load directly from TypeScript source via ts-jest
    const SocketCAN = require("../src/main");
    expect(SocketCAN).toBeDefined();
    expect(typeof SocketCAN).toBe("function");
  });
});
