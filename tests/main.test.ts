// Tests for the main module entry point

describe("Main entry point (src/main)", () => {
  const main = require("../src/main");

  it("should export a default SocketCAN constructor", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
    expect(main.name).toBe("SocketCAN");
  });

  it("default export should equal main.default property", () => {
    expect(main).toBe(main.default);
  });

  it("named export SocketCAN should point to the constructor", () => {
    expect(main.SocketCAN).toBe(main);
  });
});
