#!/usr/bin/env node

/**
 * Claude Code Orchestrator
 *
 * Multi-agent orchestration tool for Claude Code CLI instances.
 * Enables natural language orchestration and specialized agent coordination.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ClaudeCodeIntegration } from './integration/ClaudeCodeIntegration';
import { OrchestratorCLI } from './cli/OrchestratorCLI';
import { version } from '../package.json';

const program = new Command();

async function main() {
  program
    .name('claude-orchestrator')
    .description('Multi-agent orchestration tool for Claude Code CLI')
    .version(version);

  // Direct orchestration command
  program
    .command('orchestrate <task>')
    .description('Orchestrate a task using multiple Claude Code agents')
    .option('-a, --agents <agents>', 'Comma-separated list of specific agents to use')
    .option(
      '-s, --strategy <strategy>',
      'Coordination strategy: parallel, sequential, phased',
      'parallel'
    )
    .option('-p, --plan-only', 'Create plan without execution')
    .option('-c, --config <config>', 'Configuration file path', './.claude-orchestrator.config.js')
    .action(async (task, options) => {
      const cli = new OrchestratorCLI();
      await cli.executeOrchestration(task, options);
    });

  // Agent management commands
  program
    .command('agents')
    .description('Manage and view available agents')
    .action(async () => {
      const cli = new OrchestratorCLI();
      await cli.listAgents();
    });

  program
    .command('agents:describe <agentId>')
    .description('Get detailed information about a specific agent')
    .action(async agentId => {
      const cli = new OrchestratorCLI();
      await cli.describeAgent(agentId);
    });

  program
    .command('agents:suggest <task>')
    .description('Get agent suggestions for a specific task')
    .action(async task => {
      const cli = new OrchestratorCLI();
      await cli.suggestAgents(task);
    });

  // Status and monitoring
  program
    .command('status')
    .description('Check orchestrator status and active sessions')
    .action(async () => {
      const cli = new OrchestratorCLI();
      await cli.showStatus();
    });

  // Interactive mode
  program
    .command('interactive')
    .alias('i')
    .description('Start interactive orchestration mode')
    .action(async () => {
      const cli = new OrchestratorCLI();
      await cli.startInteractiveMode();
    });

  // Natural language processing
  program
    .command('analyze <request>')
    .description('Analyze if a request would benefit from orchestration')
    .action(async request => {
      const integration = new ClaudeCodeIntegration();
      const [shouldOrchestrate, confidence, reason] =
        integration.shouldSuggestOrchestration(request);

      console.log(chalk.cyan('Orchestration Analysis:'));
      console.log(
        `Should orchestrate: ${shouldOrchestrate ? chalk.green('Yes') : chalk.red('No')}`
      );
      console.log(`Confidence: ${chalk.yellow((confidence * 100).toFixed(1))}%`);
      console.log(`Reason: ${reason}`);

      if (shouldOrchestrate) {
        console.log(
          chalk.green(
            '\n💡 Suggestion: Use `claude-orchestrator orchestrate "${request}"` for optimal results'
          )
        );
      }
    });

  // Configuration management
  program
    .command('init')
    .description('Initialize orchestrator configuration for current project')
    .option(
      '-t, --template <template>',
      'Configuration template: react-native, web, general',
      'general'
    )
    .action(async options => {
      const cli = new OrchestratorCLI();
      await cli.initializeConfig(options.template);
    });

  // Slash command handler (for integration with Claude Code CLI)
  program
    .command('slash <command> [args...]')
    .description('Handle slash commands from Claude Code CLI')
    .action(async (command, args) => {
      const integration = new ClaudeCodeIntegration();
      const argsString = args.join(' ');
      const result = await integration.handleSlashCommand(command, argsString);
      console.log(JSON.stringify(result, null, 2));
    });

  // Parse command line arguments
  await program.parseAsync(process.argv);
}

// Handle unhandled errors
process.on('unhandledRejection', error => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error(chalk.red('Uncaught exception:'), error);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { ClaudeCodeIntegration, OrchestratorCLI };
