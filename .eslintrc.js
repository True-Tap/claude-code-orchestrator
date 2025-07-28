// ESLint configuration for standalone orchestrator
// Note: This requires npm install to resolve dependencies
module.exports = {
  extends: ['eslint:recommended'],
  env: {
    node: true,
    es2020: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off', // CLI tool needs console output
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'src/**/*.ts'], // Ignore TS files until deps installed
};
