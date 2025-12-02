export default {
  testTimeout: 10000,
  clearMocks: true,
  roots: [
    "<rootDir>/test"
  ],
  testEnvironment: "node",
  preset: "ts-jest",
  resolver: "ts-jest-resolver",
  coverageReporters: ["text-summary"]
};
