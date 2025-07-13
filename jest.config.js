/**
 * Jest configuration for can-socket project
 */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "js", "json", "node"],
  // Transform TS and JS files using ts-jest
  transform: {
    "^.+\\.(ts|js)$": "ts-jest",
  },
  // Resolve native .node modules to actual binary
  moduleNameMapper: {
    "\\.node$": "<rootDir>/can_socket.node",
  },
  // Match test files in src or tests folders (TS and legacy JS)
  // Match test files in tests/ and src/ directories
  // Match test files in tests/ and any .test.ts or .test.js
  testMatch: [
    "<rootDir>/tests/**/*.test.ts",
    "<rootDir>/tests/**/*.test.js",
    "<rootDir>/src/**/*.test.ts",
  ],
  coverageDirectory: "coverage",
  collectCoverageFrom: ["src/**/*.{ts,js}"],
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/target/"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/target/"],
};
