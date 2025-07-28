#!/usr/bin/env node

/**
 * Claude Code Orchestrator CLI Binary
 *
 * This is the main entry point for the claude-orchestrator command-line tool.
 */

const path = require('path');
const fs = require('fs');

// Check if we're in development mode or installed as package
const isDev = fs.existsSync(path.join(__dirname, '../src'));
const entryPoint = isDev
  ? path.join(__dirname, '../src/index.ts')
  : path.join(__dirname, '../dist/index.js');

if (isDev) {
  // Development mode - use ts-node
  try {
    require('ts-node/register');
    require(entryPoint);
  } catch (error) {
    console.error('Error: ts-node is required for development mode');
    console.error('Install it with: npm install -g ts-node');
    console.error('Or run: npm run build && node dist/index.js');
    process.exit(1);
  }
} else {
  // Production mode - use compiled JavaScript
  try {
    require(entryPoint);
  } catch (error) {
    console.error('Error: Failed to load orchestrator');
    console.error('Try reinstalling with: npm install -g claude-code-orchestrator');
    console.error(error.message);
    process.exit(1);
  }
}
