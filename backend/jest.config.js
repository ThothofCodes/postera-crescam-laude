module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'json', 'html'],
  collectCoverageFrom: [
    'middleware/**/*.js',
    'utils/**/*.js',
    'models/**/*.js',
    'controllers/**/*.js',
    '!**/node_modules/**',
  ],
  // Increase timeout for MongoDB Memory Server
  testTimeout: 30000,
  // Clear mocks between tests
  clearMocks: true,
  // Setup files
  setupFilesAfterFramework: [],
};
