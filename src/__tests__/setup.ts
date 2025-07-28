/**
 * Test setup for Claude Code Orchestrator
 */

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Set test timeout
jest.setTimeout(30000);

// Setup test environment
process.env.NODE_ENV = 'test';

// Basic test to prevent "no tests found" error
describe('Test setup', () => {
  it('should initialize test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
