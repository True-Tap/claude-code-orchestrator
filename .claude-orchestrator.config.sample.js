/**
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
