#!/usr/bin/env node

/**
 * Post-install setup script for Claude Code Orchestrator
 *
 * This script runs after npm install to set up the orchestrator
 * and provide helpful information to users.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Claude Code Orchestrator...\n');

// Check if Claude Code CLI is available
function checkClaudeCodeCLI() {
  try {
    execSync('claude-code --version', { stdio: 'pipe' });
    console.log('✅ Claude Code CLI detected');
    return true;
  } catch (error) {
    console.log('⚠️  Claude Code CLI not found');
    console.log('   Install it from: https://docs.anthropic.com/en/docs/claude-code');
    return false;
  }
}

// Check Node.js version
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);

  if (majorVersion >= 16) {
    console.log(`✅ Node.js ${nodeVersion} is supported`);
    return true;
  } else {
    console.log(`❌ Node.js ${nodeVersion} is not supported`);
    console.log('   Please upgrade to Node.js 16 or higher');
    return false;
  }
}

// Create sample configuration
function createSampleConfig() {
  const configPath = path.join(process.cwd(), '.claude-orchestrator.config.sample.js');

  if (!fs.existsSync(configPath)) {
    const sampleConfig = `/**
 * Sample Claude Code Orchestrator Configuration
 * 
 * Copy this file to .claude-orchestrator.config.js and customize for your project.
 */

module.exports = {
  // Agent priorities for your project
  agents: {
    'architecture-reviewer': {
      priority: 'high',
      enabled: true,
      domains: ['react-native', 'typescript', 'service-architecture'],
    },
    'test-automation-engineer': {
      priority: 'high',
      enabled: true,
      domains: ['unit-tests', 'integration-tests', 'coverage'],
    },
    'security-audit-specialist': {
      priority: 'medium',
      enabled: true,
      domains: ['crypto-security', 'payment-flows', 'key-management'],
    },
    // Add other agents as needed...
  },

  // Coordination strategy preferences
  coordination: {
    defaultStrategy: 'parallel', // parallel, sequential, phased_parallel
    maxConcurrentAgents: 4,
    timeoutMs: 600000, // 10 minutes
    targetBranch: 'develop',
  },

  // Claude Code CLI configuration
  claudeCode: {
    path: 'claude-code',
    defaultArgs: ['--print', '--output-format=json'],
    workingDirectory: process.cwd(),
  },
};
`;

    fs.writeFileSync(configPath, sampleConfig);
    console.log('📄 Created sample configuration file');
  }
}

// Main setup function
function main() {
  const nodeOk = checkNodeVersion();
  const claudeOk = checkClaudeCodeCLI();

  createSampleConfig();

  console.log('\n🎉 Setup complete!\n');

  console.log('Getting started:');
  console.log('  claude-orchestrator --help');
  console.log('  claude-orchestrator init');
  console.log('  claude-orchestrator interactive\n');

  console.log('Examples:');
  console.log('  claude-orchestrator orchestrate "implement BLE payments with testing"');
  console.log('  claude-orchestrator agents');
  console.log('  claude-orchestrator agents:suggest "optimize performance"\n');

  if (!claudeOk) {
    console.log('⚠️  Note: Claude Code CLI is required for full functionality');
    console.log('   Install it before using the orchestrator\n');
  }

  if (!nodeOk) {
    console.log('❌ Please upgrade Node.js to version 16 or higher');
    process.exit(1);
  }
}

// Only run if called directly (not required)
if (require.main === module) {
  main();
}

module.exports = { checkClaudeCodeCLI, checkNodeVersion, createSampleConfig };
