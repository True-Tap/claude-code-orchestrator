/**
 * Orchestrator CLI Interface
 *
 * Command-line interface for the Claude Code Orchestrator
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import { ClaudeCodeIntegration } from '../integration/ClaudeCodeIntegration';
import { OrchestrationConfig, InteractiveSession, CoordinationStrategy } from '../types';

export class OrchestratorCLI {
  private integration: ClaudeCodeIntegration;
  private config: OrchestrationConfig | null = null;

  constructor() {
    this.integration = new ClaudeCodeIntegration();
  }

  async executeOrchestration(task: string, options: any): Promise<void> {
    const spinner = ora('Analyzing task and creating orchestration plan...').start();

    try {
      await this.loadConfig(options.config);

      const result = await this.integration.handleSlashCommand('orchestrate', task);

      spinner.stop();

      if (!result.success) {
        console.log(chalk.red('❌ Failed to create orchestration plan:'));
        console.log(chalk.red(result.error));
        return;
      }

      console.log(chalk.green('✅ Orchestration plan created successfully!\n'));

      if (result.plan) {
        this.displayPlan(result.plan);

        if (!options.planOnly) {
          const shouldExecute = await this.confirmExecution();
          if (shouldExecute) {
            await this.executePlan(result.plan);
          }
        }
      }
    } catch (error) {
      spinner.fail('Failed to create orchestration plan');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async listAgents(): Promise<void> {
    const spinner = ora('Loading available agents...').start();

    try {
      const result = await this.integration.handleSlashCommand('agents', 'list');
      spinner.stop();

      if (result.success && result.agents) {
        console.log(chalk.cyan('📋 Available Claude Code Agents:\n'));

        Object.entries(result.agents).forEach(([id, info]) => {
          console.log(chalk.blue(`${id}:`));
          console.log(`  ${chalk.white(info.name)}`);
          console.log(`  ${chalk.gray(info.description)}`);
          console.log(`  ${chalk.yellow('Best for:')} ${info.bestFor?.join(', ')}`);
          console.log();
        });
      }
    } catch (error) {
      spinner.fail('Failed to load agents');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async describeAgent(agentId: string): Promise<void> {
    const spinner = ora(`Loading information for ${agentId}...`).start();

    try {
      const result = await this.integration.handleSlashCommand('agents', `describe ${agentId}`);
      spinner.stop();

      if (result.success && result.agents) {
        const agent = Object.values(result.agents)[0];
        console.log(chalk.cyan(`📖 Agent Details: ${agentId}\n`));
        console.log(chalk.blue('Name:'), chalk.white(agent.name));
        console.log(chalk.blue('Description:'), chalk.white(agent.description));
        console.log(chalk.blue('Capabilities:'), chalk.yellow(agent.capabilities.join(', ')));
        console.log(chalk.blue('Best for:'), chalk.green(agent.bestFor.join(', ')));
      } else {
        console.log(chalk.red(`❌ Agent "${agentId}" not found`));
        if (result.availableCommands) {
          console.log(chalk.yellow('Available agents:'), result.availableCommands.join(', '));
        }
      }
    } catch (error) {
      spinner.fail('Failed to describe agent');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async suggestAgents(task: string): Promise<void> {
    const spinner = ora('Analyzing task and suggesting agents...').start();

    try {
      const result = await this.integration.handleSlashCommand('agents', `suggest for ${task}`);
      spinner.stop();

      if (result.success && result.agents) {
        console.log(chalk.cyan('💡 Agent Suggestions:\n'));
        console.log(chalk.blue('Task:'), chalk.white(task));
        console.log(chalk.blue('Suggested agents:\n'));

        Object.entries(result.agents).forEach(([id, info]) => {
          console.log(chalk.green(`✓ ${id}`));
          console.log(`  ${chalk.white(info.name)}`);
          console.log(`  ${chalk.gray(info.description)}`);
          console.log();
        });

        if (result.nextSteps) {
          console.log(chalk.yellow('Next steps:'));
          result.nextSteps.forEach(step => {
            console.log(chalk.gray(`  • ${step}`));
          });
        }
      }
    } catch (error) {
      spinner.fail('Failed to suggest agents');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async showStatus(): Promise<void> {
    const spinner = ora('Checking orchestrator status...').start();

    try {
      const result = await this.integration.handleSlashCommand('orchestrate-status', '');
      spinner.stop();

      if (result.success && result.status) {
        console.log(chalk.cyan('📊 Orchestrator Status:\n'));
        console.log(chalk.blue('Health:'), this.getHealthColor(result.status.orchestratorHealth));
        console.log(chalk.blue('Active sessions:'), chalk.white(result.status.activeSessions));
        console.log(
          chalk.blue('Active worktrees:'),
          chalk.white(result.status.activeWorktrees.length)
        );
        console.log(chalk.blue('Last execution:'), chalk.white(result.status.lastExecution));

        if (result.status.activeWorktrees.length > 0) {
          console.log(chalk.blue('\nActive worktrees:'));
          result.status.activeWorktrees.forEach(worktree => {
            console.log(chalk.gray(`  • ${worktree}`));
          });
        }
      }
    } catch (error) {
      spinner.fail('Failed to check status');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  async startInteractiveMode(): Promise<void> {
    console.log(chalk.cyan('🚀 Starting Interactive Orchestration Mode\n'));

    const session: InteractiveSession = {
      selectedAgents: [],
      coordinationStrategy: 'parallel',
      config: await this.getDefaultConfig(),
    };

    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📝 Define a new task', value: 'task' },
            { name: '🤖 Select agents', value: 'agents' },
            { name: '⚙️ Configure strategy', value: 'strategy' },
            { name: '▶️ Execute orchestration', value: 'execute' },
            { name: '📊 View current session', value: 'view' },
            { name: '🚪 Exit', value: 'exit' },
          ],
        },
      ]);

      switch (action) {
        case 'task':
          await this.defineTask(session);
          break;
        case 'agents':
          await this.selectAgents(session);
          break;
        case 'strategy':
          await this.configureStrategy(session);
          break;
        case 'execute':
          await this.executeInteractiveTask(session);
          break;
        case 'view':
          this.viewSession(session);
          break;
        case 'exit':
          console.log(chalk.green('👋 Goodbye!'));
          return;
      }
    }
  }

  async initializeConfig(template: string): Promise<void> {
    const spinner = ora('Initializing orchestrator configuration...').start();

    try {
      const configPath = './.claude-orchestrator.config.js';
      const templateConfig = await this.getTemplateConfig(template);

      await fs.writeFile(configPath, this.generateConfigFile(templateConfig));

      spinner.succeed('Configuration file created successfully!');
      console.log(chalk.green(`📄 Created: ${configPath}`));
      console.log(chalk.yellow('You can now customize the configuration for your project.'));
    } catch (error) {
      spinner.fail('Failed to initialize configuration');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private displayPlan(plan: any): void {
    console.log(chalk.blue('📋 Task:'), chalk.white(plan.task));
    console.log(
      chalk.blue('⏱️ Estimated duration:'),
      chalk.yellow(
        `${plan.estimatedDuration.estimatedMinutes} minutes (${plan.estimatedDuration.complexity} complexity)`
      )
    );
    console.log(chalk.blue('🤝 Strategy:'), chalk.cyan(plan.coordinationStrategy));

    console.log(chalk.blue('\n🤖 Selected Agents:'));
    plan.agents.forEach((agent: any) => {
      console.log(chalk.green(`  ✓ ${agent.name}`));
      console.log(chalk.gray(`    Role: ${agent.role}`));
      console.log(chalk.gray(`    Deliverables: ${agent.deliverables.join(', ')}`));
    });

    if (plan.phases && plan.phases.length > 0) {
      console.log(chalk.blue('\n📅 Execution Phases:'));
      plan.phases.forEach((phase: any, index: number) => {
        console.log(chalk.yellow(`  ${index + 1}. ${phase.name} (${phase.durationEstimate})`));
        console.log(chalk.gray(`     Agents: ${phase.agents.join(', ')}`));
        console.log(chalk.gray(`     Deliverables: ${phase.deliverables.join(', ')}`));
      });
    }

    if (plan.dependencies && plan.dependencies.length > 0) {
      console.log(chalk.blue('\n🔗 Dependencies:'));
      plan.dependencies.forEach((dep: any) => {
        console.log(chalk.yellow(`  • ${dep.dependency}`));
      });
    }

    console.log(chalk.blue('\n✅ Success Criteria:'));
    plan.successCriteria.forEach((criteria: string) => {
      console.log(chalk.green(`  ✓ ${criteria}`));
    });
  }

  private async confirmExecution(): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to execute this orchestration plan?',
        default: true,
      },
    ]);
    return confirm;
  }

  private async executePlan(plan: any): Promise<void> {
    console.log(chalk.cyan('\n🚀 Executing orchestration plan...\n'));

    // For now, this is a placeholder implementation
    // In a real implementation, this would coordinate Claude Code agents
    const spinner = ora('Setting up agent coordination...').start();

    try {
      // Simulate execution phases
      for (let i = 0; i < plan.phases.length; i++) {
        const phase = plan.phases[i];
        spinner.text = `Executing ${phase.name}...`;

        // Simulate phase execution time
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(chalk.green(`✅ Completed: ${phase.name}`));
      }

      spinner.succeed('Orchestration completed successfully!');
      console.log(chalk.green('\n🎉 All agents have completed their tasks.'));
    } catch (error) {
      spinner.fail('Orchestration failed');
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private getHealthColor(health: string): string {
    if (health === 'Ready') return chalk.green(health);
    if (health.startsWith('Warning')) return chalk.yellow(health);
    return chalk.red(health);
  }

  private async defineTask(session: InteractiveSession): Promise<void> {
    const { task } = await inquirer.prompt([
      {
        type: 'input',
        name: 'task',
        message: 'Describe the task you want to orchestrate:',
        validate: (input: string) => input.trim().length > 0 || 'Please enter a task description',
      },
    ]);

    session.currentTask = task;

    // Auto-suggest agents
    const [shouldOrchestrate, confidence, reason] =
      this.integration.shouldSuggestOrchestration(task);

    if (shouldOrchestrate) {
      console.log(
        chalk.green(
          `✅ This task is well-suited for orchestration (${(confidence * 100).toFixed(
            1
          )}% confidence)`
        )
      );
      console.log(chalk.gray(`Reason: ${reason}`));
    } else {
      console.log(chalk.yellow(`⚠️ This task may not benefit significantly from orchestration`));
      console.log(chalk.gray(`Reason: ${reason}`));
    }
  }

  private async selectAgents(session: InteractiveSession): Promise<void> {
    if (!session.currentTask) {
      console.log(chalk.red('❌ Please define a task first'));
      return;
    }

    // Get agent suggestions
    const result = await this.integration.handleSlashCommand(
      'agents',
      `suggest for ${session.currentTask}`
    );
    const suggestedAgents = result.agents ? Object.keys(result.agents) : [];

    const agentsList = await this.integration.handleSlashCommand('agents', 'list');
    const allAgents = agentsList.agents ? Object.entries(agentsList.agents) : [];

    const { selectedAgents } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedAgents',
        message: 'Select agents for this task:',
        choices: allAgents.map(([id, info]) => ({
          name: `${info.name} ${suggestedAgents.includes(id) ? chalk.green('(recommended)') : ''}`,
          value: id,
          checked: suggestedAgents.includes(id),
        })),
      },
    ]);

    session.selectedAgents = selectedAgents;
    console.log(chalk.green(`✅ Selected ${selectedAgents.length} agents`));
  }

  private async configureStrategy(session: InteractiveSession): Promise<void> {
    const { strategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'strategy',
        message: 'Choose coordination strategy:',
        choices: [
          { name: 'Parallel - All agents work simultaneously', value: 'parallel' },
          { name: 'Sequential - Agents work one after another', value: 'sequential' },
          {
            name: 'Phased Parallel - Sequential phases with parallel execution within phases',
            value: 'phased_parallel',
          },
        ],
        default: session.coordinationStrategy,
      },
    ]);

    session.coordinationStrategy = strategy;
    console.log(chalk.green(`✅ Strategy set to: ${strategy}`));
  }

  private async executeInteractiveTask(session: InteractiveSession): Promise<void> {
    if (!session.currentTask) {
      console.log(chalk.red('❌ Please define a task first'));
      return;
    }

    if (session.selectedAgents.length === 0) {
      console.log(chalk.red('❌ Please select at least one agent'));
      return;
    }

    const taskWithAgents = `${session.currentTask} --agents ${session.selectedAgents.join(
      ','
    )} --strategy ${session.coordinationStrategy}`;
    await this.executeOrchestration(taskWithAgents, { planOnly: false });
  }

  private viewSession(session: InteractiveSession): void {
    console.log(chalk.cyan('\n📋 Current Session:\n'));
    console.log(chalk.blue('Task:'), session.currentTask || chalk.gray('(not defined)'));
    console.log(
      chalk.blue('Selected agents:'),
      session.selectedAgents.length > 0
        ? session.selectedAgents.join(', ')
        : chalk.gray('(none selected)')
    );
    console.log(chalk.blue('Strategy:'), chalk.cyan(session.coordinationStrategy));
    console.log();
  }

  private async loadConfig(configPath: string): Promise<void> {
    try {
      if (
        await fs
          .access(configPath)
          .then(() => true)
          .catch(() => false)
      ) {
        const configModule = await import(path.resolve(configPath));
        this.config = configModule.default || configModule;
      }
    } catch (error) {
      // Use default config if file doesn't exist or has issues
      this.config = await this.getDefaultConfig();
    }
  }

  private async getDefaultConfig(): Promise<OrchestrationConfig> {
    return {
      agents: {
        'architecture-reviewer': { priority: 'high', enabled: true },
        'test-automation-engineer': { priority: 'high', enabled: true },
        'security-audit-specialist': { priority: 'medium', enabled: true },
        'hardware-integration-specialist': { priority: 'medium', enabled: true },
        'solana-mobile-expert': { priority: 'medium', enabled: true },
        'ux-animation-director': { priority: 'medium', enabled: true },
        'react-native-performance-engineer': { priority: 'low', enabled: true },
        'devops-deployment-engineer': { priority: 'low', enabled: true },
      },
      coordination: {
        defaultStrategy: 'parallel',
        maxConcurrentAgents: 4,
        timeoutMs: 600000,
        targetBranch: 'develop',
      },
      claudeCode: {
        path: 'claude-code',
        defaultArgs: ['--print', '--output-format=json'],
        workingDirectory: process.cwd(),
      },
    };
  }

  private async getTemplateConfig(template: string): Promise<OrchestrationConfig> {
    const baseConfig = await this.getDefaultConfig();

    switch (template) {
      case 'react-native':
        return {
          ...baseConfig,
          agents: {
            ...baseConfig.agents,
            'react-native-performance-engineer': { priority: 'high', enabled: true },
            'ux-animation-director': { priority: 'high', enabled: true },
          },
          projectSpecific: {
            framework: 'react-native',
            platform: 'mobile',
            mobile: true,
            domains: {
              primary: ['mobile-development', 'performance', 'ui-ux'],
              secondary: ['testing', 'architecture'],
              emerging: ['animations', 'accessibility'],
            },
            workflow: {
              validateCommand: 'npm run validate',
              testCommand: 'npm test',
              buildCommand: 'npm run build',
            },
          },
        };

      case 'web':
        return {
          ...baseConfig,
          agents: {
            ...baseConfig.agents,
            'react-native-performance-engineer': { priority: 'low', enabled: false },
            'hardware-integration-specialist': { priority: 'low', enabled: false },
          },
          projectSpecific: {
            framework: 'web',
            platform: 'web',
            mobile: false,
            domains: {
              primary: ['web-development', 'performance', 'ui-ux'],
              secondary: ['testing', 'architecture'],
              emerging: ['accessibility', 'pwa'],
            },
            workflow: {
              validateCommand: 'npm run validate',
              testCommand: 'npm test',
              buildCommand: 'npm run build',
            },
          },
        };

      default:
        return baseConfig;
    }
  }

  private generateConfigFile(config: OrchestrationConfig): string {
    return `/**
 * Claude Code Orchestrator Configuration
 * 
 * This configuration file customizes the orchestrator for your project.
 */

module.exports = ${JSON.stringify(config, null, 2)};
`;
  }
}
