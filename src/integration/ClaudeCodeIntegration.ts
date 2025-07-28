/**
 * Claude Code Integration Layer
 *
 * Provides seamless integration between Claude Code CLI and the orchestrator,
 * enabling natural language orchestration requests through slash commands and
 * intelligent task detection.
 */

import {
  OrchestrationResult,
  OrchestrationPlan,
  AgentInfo,
  TaskAnalysis,
  TaskDuration,
  CoordinationStrategy,
  AgentPlanInfo,
  ExecutionPhase,
  TaskDependency,
  RiskMitigation,
  OrchestrationStatus,
} from '../types';

export class ClaudeCodeIntegration {
  private availableAgents: Record<string, AgentInfo>;
  private orchestrationPatterns: RegExp[];

  constructor() {
    this.availableAgents = {
      'architecture-reviewer': {
        name: 'Architecture Review Agent',
        description: 'Reviews code architecture, design patterns, and SOLID principles',
        capabilities: ['code_analysis', 'refactoring', 'documentation'],
        bestFor: [
          'architecture review',
          'design patterns',
          'code structure',
          'typescript patterns',
        ],
      },
      'test-automation-engineer': {
        name: 'Test Automation Engineer',
        description: 'Creates comprehensive test coverage and automation',
        capabilities: ['test_creation', 'coverage_analysis', 'mock_services'],
        bestFor: ['unit tests', 'integration tests', 'test coverage', 'debugging tests'],
      },
      'hardware-integration-specialist': {
        name: 'Hardware Integration Specialist',
        description: 'Handles NFC, BLE, and hardware-level integrations',
        capabilities: ['hardware_integration', 'bluetooth', 'nfc', 'permissions'],
        bestFor: ['NFC integration', 'BLE development', 'hardware permissions', 'device testing'],
      },
      'ux-animation-director': {
        name: 'UX Animation Director',
        description: 'Creates smooth animations and optimal user experiences',
        capabilities: ['animation_design', 'user_experience', 'accessibility'],
        bestFor: ['payment animations', 'UI interactions', 'accessibility', 'user journey'],
      },
      'solana-mobile-expert': {
        name: 'Solana Mobile Expert',
        description: 'Blockchain integration and Solana Mobile Stack development',
        capabilities: ['blockchain_integration', 'wallet_connectivity', 'token_operations'],
        bestFor: [
          'Genesis Token verification',
          'wallet integration',
          'BONK payments',
          'transaction processing',
        ],
      },
      'security-audit-specialist': {
        name: 'Security Audit Specialist',
        description: 'Security analysis and vulnerability assessment for crypto applications',
        capabilities: ['security_analysis', 'vulnerability_assessment', 'crypto_security'],
        bestFor: [
          'payment security',
          'private key handling',
          'vulnerability assessment',
          'security review',
        ],
      },
      'react-native-performance-engineer': {
        name: 'React Native Performance Engineer',
        description: 'Optimizes React Native app performance and bundle sizes',
        capabilities: ['performance_optimization', 'bundle_analysis', 'memory_management'],
        bestFor: ['app performance', 'bundle size optimization', 'memory leaks', 'startup time'],
      },
      'devops-deployment-engineer': {
        name: 'DevOps Deployment Engineer',
        description: 'CI/CD pipeline optimization and deployment automation',
        capabilities: ['cicd_optimization', 'deployment_automation', 'build_optimization'],
        bestFor: [
          'build optimization',
          'CI/CD pipelines',
          'deployment automation',
          'development workflow',
        ],
      },
    };

    this.orchestrationPatterns = [
      // Complex feature implementation
      /implement.*(?:feature|system|integration)/i,
      /build.*(?:complete|full|entire)/i,
      /create.*(?:comprehensive|full|complete)/i,

      // Multi-domain tasks
      /.*(?:with|and|including).*(?:test|security|performance|animation)/i,
      /.*(?:architecture|design).*(?:test|implementation)/i,
      /.*(?:bluetooth|ble|nfc).*(?:payment|integration)/i,

      // Specific features
      /bluetooth revolution/i,
      /bonk rain/i,
      /payment.*(?:orchestrat|integrat)/i,
      /genesis token.*(?:verification|integration)/i,

      // Quality assurance combinations
      /.*(?:review|audit|analyz).*(?:and|with).*(?:implement|fix|improv)/i,
    ];
  }

  async handleSlashCommand(command: string, args: string): Promise<OrchestrationResult> {
    try {
      switch (command) {
        case 'orchestrate':
          return await this.handleOrchestrateCommand(args);
        case 'agents':
          return await this.handleAgentsCommand(args);
        case 'orchestrate-plan':
          return await this.handleOrchestratePlanCommand(args);
        case 'orchestrate-status':
          return await this.handleOrchestrateStatusCommand(args);
        default:
          return {
            success: false,
            action: 'unknown_command',
            error: `Unknown slash command: /${command}`,
            availableCommands: ['orchestrate', 'agents', 'orchestrate-plan', 'orchestrate-status'],
          };
      }
    } catch (error) {
      return {
        success: false,
        action: 'command_error',
        error: `Command execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async handleOrchestrateCommand(args: string): Promise<OrchestrationResult> {
    if (!args.trim()) {
      return {
        success: false,
        action: 'missing_task',
        error: 'Please specify a task to orchestrate',
        examples: [
          '/orchestrate implement BLE payments with architecture review and testing',
          '/orchestrate optimize payment performance with security audit',
          '/orchestrate create Genesis Token verification system',
        ],
      };
    }

    const [taskDescription, suggestedAgents] = this.parseOrchestrationRequest(args);
    const finalAgents =
      suggestedAgents.length > 0 ? suggestedAgents : this.suggestAgentsForTask(taskDescription);

    const plan: OrchestrationPlan = {
      task: taskDescription,
      suggestedAgents: finalAgents,
      estimatedDuration: this.estimateTaskDuration(taskDescription, finalAgents),
      coordinationStrategy: this.determineCoordinationStrategy(taskDescription, finalAgents),
      agents: this.createAgentPlanInfo(taskDescription, finalAgents),
      phases: this.createExecutionPhases(taskDescription, finalAgents),
      dependencies: this.identifyTaskDependencies(taskDescription, finalAgents),
      successCriteria: this.defineSuccessCriteria(taskDescription),
      riskMitigation: this.identifyRisksAndMitigation(taskDescription, finalAgents),
    };

    return {
      success: true,
      action: 'orchestration_plan_created',
      plan,
      nextSteps: [
        'Review the suggested agents and coordination strategy',
        'Confirm execution with: /orchestrate-execute',
        'Or modify agents with: /orchestrate --agents agent1,agent2,agent3',
      ],
    };
  }

  private async handleAgentsCommand(args: string): Promise<OrchestrationResult> {
    if (!args.trim() || args.trim() === 'list') {
      return {
        success: true,
        action: 'list_agents',
        agents: Object.fromEntries(
          Object.entries(this.availableAgents).map(([id, info]) => [
            id,
            {
              name: info.name,
              description: info.description,
              bestFor: info.bestFor.slice(0, 3), // Top 3 use cases
            },
          ])
        ),
      };
    }

    if (args.startsWith('describe ')) {
      const agentId = args.replace('describe ', '').trim();
      if (agentId in this.availableAgents) {
        return {
          success: true,
          action: 'describe_agent',
          agents: { [agentId]: this.availableAgents[agentId] },
        };
      } else {
        return {
          success: false,
          action: 'agent_not_found',
          error: `Agent "${agentId}" not found`,
          availableCommands: Object.keys(this.availableAgents),
        };
      }
    }

    if (args.startsWith('suggest for ')) {
      const task = args.replace('suggest for ', '').trim();
      const suggested = this.suggestAgentsForTask(task);
      return {
        success: true,
        action: 'suggest_agents',
        agents: Object.fromEntries(
          suggested.map(agentId => [agentId, this.availableAgents[agentId]])
        ),
        nextSteps: [`Use: /orchestrate ${task} --agents ${suggested.join(',')}`],
      };
    }

    return {
      success: false,
      action: 'invalid_agents_command',
      error: 'Invalid agents command format',
      examples: [
        '/agents list',
        '/agents describe architecture-reviewer',
        '/agents suggest for payment implementation',
      ],
    };
  }

  private async handleOrchestratePlanCommand(args: string): Promise<OrchestrationResult> {
    if (!args.trim()) {
      return {
        success: false,
        action: 'missing_task',
        error: 'Please specify a task to plan',
      };
    }

    const taskDescription = args.trim();
    const suggestedAgents = this.suggestAgentsForTask(taskDescription);
    const plan = await this.createDetailedPlan(taskDescription, suggestedAgents);

    return {
      success: true,
      action: 'detailed_plan_created',
      plan,
      nextSteps: [
        'Review the detailed execution plan',
        'Execute with: /orchestrate-execute',
        'Modify plan with: /orchestrate-plan --modify',
      ],
    };
  }

  private async handleOrchestrateStatusCommand(args: string): Promise<OrchestrationResult> {
    const status = await this.getOrchestrationStatus();
    return {
      success: true,
      action: 'orchestration_status',
      status,
    };
  }

  private parseOrchestrationRequest(request: string): [string, string[]] {
    const agentKeywords: Record<string, string> = {
      architecture: 'architecture-reviewer',
      test: 'test-automation-engineer',
      testing: 'test-automation-engineer',
      hardware: 'hardware-integration-specialist',
      bluetooth: 'hardware-integration-specialist',
      ble: 'hardware-integration-specialist',
      nfc: 'hardware-integration-specialist',
      animation: 'ux-animation-director',
      ux: 'ux-animation-director',
      ui: 'ux-animation-director',
      solana: 'solana-mobile-expert',
      wallet: 'solana-mobile-expert',
      token: 'solana-mobile-expert',
      security: 'security-audit-specialist',
      audit: 'security-audit-specialist',
      performance: 'react-native-performance-engineer',
      optimization: 'react-native-performance-engineer',
      deployment: 'devops-deployment-engineer',
      cicd: 'devops-deployment-engineer',
      'ci/cd': 'devops-deployment-engineer',
    };

    const requestLower = request.toLowerCase();
    const suggestedAgents: string[] = [];

    for (const [keyword, agentId] of Object.entries(agentKeywords)) {
      if (requestLower.includes(keyword) && !suggestedAgents.includes(agentId)) {
        suggestedAgents.push(agentId);
      }
    }

    return [request, suggestedAgents];
  }

  private suggestAgentsForTask(task: string): string[] {
    const taskLower = task.toLowerCase();
    const suggested: string[] = [];

    // Task complexity analysis
    const complexityIndicators = ['implement', 'build', 'create', 'develop', 'integrate', 'design'];
    const isComplex = complexityIndicators.some(indicator => taskLower.includes(indicator));

    // Domain-specific suggestions
    if (
      ['payment', 'transaction', 'wallet', 'solana', 'token'].some(word => taskLower.includes(word))
    ) {
      suggested.push('solana-mobile-expert');
    }

    if (['bluetooth', 'ble', 'nfc', 'hardware', 'device'].some(word => taskLower.includes(word))) {
      suggested.push('hardware-integration-specialist');
    }

    if (['test', 'coverage', 'mock', 'debug'].some(word => taskLower.includes(word))) {
      suggested.push('test-automation-engineer');
    }

    if (['architecture', 'design', 'pattern', 'structure'].some(word => taskLower.includes(word))) {
      suggested.push('architecture-reviewer');
    }

    if (['animation', 'ui', 'ux', 'user', 'interface'].some(word => taskLower.includes(word))) {
      suggested.push('ux-animation-director');
    }

    if (['security', 'audit', 'vulnerability', 'crypto'].some(word => taskLower.includes(word))) {
      suggested.push('security-audit-specialist');
    }

    if (
      ['performance', 'optimization', 'bundle', 'memory'].some(word => taskLower.includes(word))
    ) {
      suggested.push('react-native-performance-engineer');
    }

    if (['deploy', 'ci', 'cd', 'build', 'pipeline'].some(word => taskLower.includes(word))) {
      suggested.push('devops-deployment-engineer');
    }

    // Always include architecture review for complex tasks
    if (isComplex && !suggested.includes('architecture-reviewer')) {
      suggested.unshift('architecture-reviewer');
    }

    // Always include testing for implementation tasks
    if (
      ['implement', 'build', 'create'].some(word => taskLower.includes(word)) &&
      !suggested.includes('test-automation-engineer')
    ) {
      suggested.push('test-automation-engineer');
    }

    return suggested.slice(0, 4); // Limit to 4 agents for manageability
  }

  private estimateTaskDuration(task: string, agents: string[]): TaskDuration {
    const complexityScore = this.calculateTaskComplexity(task);
    const agentCount = agents.length;

    const baseTime = complexityScore * 10;
    const parallelFactor = Math.max(1, agentCount / 2);
    const estimatedMinutes = Math.round(baseTime / parallelFactor);

    return {
      estimatedMinutes,
      complexity: complexityScore > 7 ? 'high' : complexityScore > 4 ? 'medium' : 'low',
      parallelAgents: agentCount,
      explanation: `Task complexity: ${complexityScore}/10, parallel execution with ${agentCount} agents`,
    };
  }

  private calculateTaskComplexity(task: string): number {
    const taskLower = task.toLowerCase();
    let score = 3; // Base complexity

    // Complexity indicators
    if (taskLower.includes('implement')) score += 2;
    if (taskLower.includes('integrate')) score += 2;
    if (taskLower.includes('optimize')) score += 1;
    if (taskLower.includes('comprehensive')) score += 2;
    if (taskLower.includes('complete')) score += 2;
    if (taskLower.includes('entire')) score += 2;
    if (taskLower.includes('security')) score += 1;
    if (taskLower.includes('testing')) score += 1;
    if (taskLower.includes('animation')) score += 1;

    // Project-specific complexity
    if (taskLower.includes('bluetooth revolution')) score += 3;
    if (taskLower.includes('bonk rain')) score += 2;
    if (taskLower.includes('genesis token')) score += 2;

    return Math.min(score, 10);
  }

  private determineCoordinationStrategy(task: string, agents: string[]): CoordinationStrategy {
    const agentCount = agents.length;
    const complexity = this.calculateTaskComplexity(task);

    if (agentCount <= 2) {
      return 'sequential';
    } else if (complexity > 7) {
      return 'phased_parallel';
    } else {
      return 'parallel';
    }
  }

  private createAgentPlanInfo(task: string, agents: string[]): AgentPlanInfo[] {
    return agents
      .filter(agentId => agentId in this.availableAgents)
      .map(agentId => ({
        id: agentId,
        name: this.availableAgents[agentId].name,
        role: this.determineAgentRole(task, agentId),
        deliverables: this.determineAgentDeliverables(task, agentId),
      }));
  }

  private determineAgentRole(task: string, agentId: string): string {
    const roleMappings: Record<string, string> = {
      'architecture-reviewer': 'Design system architecture and review code structure',
      'test-automation-engineer': 'Create comprehensive test coverage and automation',
      'hardware-integration-specialist': 'Implement hardware integrations and device communication',
      'ux-animation-director': 'Design user experience and smooth animations',
      'solana-mobile-expert': 'Handle blockchain integration and wallet connectivity',
      'security-audit-specialist': 'Perform security analysis and vulnerability assessment',
      'react-native-performance-engineer': 'Optimize performance and bundle size',
      'devops-deployment-engineer': 'Set up CI/CD and deployment automation',
    };

    return roleMappings[agentId] || 'Support task execution';
  }

  private determineAgentDeliverables(task: string, agentId: string): string[] {
    const deliverableMappings: Record<string, string[]> = {
      'architecture-reviewer': [
        'Architecture review report',
        'Design pattern recommendations',
        'Code structure improvements',
      ],
      'test-automation-engineer': ['Unit test suite', 'Integration tests', 'Test coverage report'],
      'hardware-integration-specialist': [
        'Hardware integration implementation',
        'Device communication protocols',
        'Permission handling',
      ],
      'ux-animation-director': [
        'UI/UX design specifications',
        'Animation implementations',
        'Accessibility compliance',
      ],
      'solana-mobile-expert': [
        'Blockchain integration code',
        'Wallet connectivity',
        'Transaction processing',
      ],
      'security-audit-specialist': [
        'Security audit report',
        'Vulnerability assessment',
        'Security recommendations',
      ],
      'react-native-performance-engineer': [
        'Performance optimization',
        'Bundle size analysis',
        'Memory usage improvements',
      ],
      'devops-deployment-engineer': [
        'CI/CD pipeline configuration',
        'Deployment automation',
        'Build optimization',
      ],
    };

    return deliverableMappings[agentId] || ['Task completion'];
  }

  private createExecutionPhases(task: string, agents: string[]): ExecutionPhase[] {
    const phases: ExecutionPhase[] = [];

    // Phase 1: Analysis and Planning
    const analysisAgents = agents.filter(agent =>
      ['architecture-reviewer', 'security-audit-specialist'].includes(agent)
    );
    if (analysisAgents.length > 0) {
      phases.push({
        name: 'Analysis and Planning',
        agents: analysisAgents,
        durationEstimate: '15-30 minutes',
        deliverables: ['Architecture analysis', 'Security assessment', 'Implementation plan'],
      });
    }

    // Phase 2: Core Implementation
    const implementationAgents = agents.filter(agent =>
      ['hardware-integration-specialist', 'solana-mobile-expert', 'ux-animation-director'].includes(
        agent
      )
    );
    if (implementationAgents.length > 0) {
      phases.push({
        name: 'Core Implementation',
        agents: implementationAgents,
        durationEstimate: '30-60 minutes',
        deliverables: ['Feature implementation', 'Integration code', 'UI components'],
      });
    }

    // Phase 3: Testing and Optimization
    const testingAgents = agents.filter(agent =>
      ['test-automation-engineer', 'react-native-performance-engineer'].includes(agent)
    );
    if (testingAgents.length > 0) {
      phases.push({
        name: 'Testing and Optimization',
        agents: testingAgents,
        durationEstimate: '20-40 minutes',
        deliverables: ['Test suite', 'Performance optimizations', 'Quality assurance'],
      });
    }

    // Phase 4: Deployment and CI/CD
    const deploymentAgents = agents.filter(agent => ['devops-deployment-engineer'].includes(agent));
    if (deploymentAgents.length > 0) {
      phases.push({
        name: 'Deployment and CI/CD',
        agents: deploymentAgents,
        durationEstimate: '10-20 minutes',
        deliverables: ['CI/CD configuration', 'Deployment automation'],
      });
    }

    return phases;
  }

  private identifyTaskDependencies(task: string, agents: string[]): TaskDependency[] {
    const dependencies: TaskDependency[] = [];

    if (agents.includes('architecture-reviewer') && agents.includes('test-automation-engineer')) {
      dependencies.push({
        dependency: 'Architecture review must complete before test creation',
        prerequisite: 'architecture-reviewer',
        dependent: 'test-automation-engineer',
      });
    }

    if (agents.includes('solana-mobile-expert') && agents.includes('security-audit-specialist')) {
      dependencies.push({
        dependency: 'Blockchain implementation should be reviewed for security',
        prerequisite: 'solana-mobile-expert',
        dependent: 'security-audit-specialist',
      });
    }

    return dependencies;
  }

  private defineSuccessCriteria(task: string): string[] {
    const criteria = [
      'All agent deliverables completed successfully',
      'Code passes all tests and quality checks',
      'Implementation follows architectural guidelines',
    ];

    const taskLower = task.toLowerCase();

    if (taskLower.includes('security')) {
      criteria.push('Security audit passes with no critical vulnerabilities');
    }

    if (taskLower.includes('performance')) {
      criteria.push('Performance targets met (e.g., <2s startup time)');
    }

    if (taskLower.includes('test')) {
      criteria.push('Test coverage >90%');
    }

    return criteria;
  }

  private identifyRisksAndMitigation(task: string, agents: string[]): RiskMitigation[] {
    const risks: RiskMitigation[] = [];

    if (agents.length > 3) {
      risks.push({
        risk: 'Coordination complexity with multiple agents',
        mitigation: 'Use phased execution with clear handoffs',
      });
    }

    if (agents.includes('hardware-integration-specialist')) {
      risks.push({
        risk: 'Hardware integration may require physical device testing',
        mitigation: 'Ensure physical devices available for testing',
      });
    }

    if (agents.includes('security-audit-specialist')) {
      risks.push({
        risk: 'Security vulnerabilities may require significant rework',
        mitigation: 'Run security review early in development cycle',
      });
    }

    return risks;
  }

  private async createDetailedPlan(task: string, agents: string[]): Promise<OrchestrationPlan> {
    return {
      task,
      suggestedAgents: agents,
      estimatedDuration: this.estimateTaskDuration(task, agents),
      coordinationStrategy: this.determineCoordinationStrategy(task, agents),
      agents: this.createAgentPlanInfo(task, agents),
      phases: this.createExecutionPhases(task, agents),
      dependencies: this.identifyTaskDependencies(task, agents),
      successCriteria: this.defineSuccessCriteria(task),
      riskMitigation: this.identifyRisksAndMitigation(task, agents),
    };
  }

  private async getOrchestrationStatus(): Promise<OrchestrationStatus> {
    // In a real implementation, this would check for active sessions, worktrees, etc.
    return {
      activeSessions: 0,
      activeWorktrees: [],
      lastExecution: 'None',
      orchestratorHealth: 'Ready',
    };
  }

  public shouldSuggestOrchestration(userRequest: string): [boolean, number, string] {
    const requestLower = userRequest.toLowerCase();
    let confidence = 0.0;
    const reasons: string[] = [];

    // Check for orchestration patterns
    for (const pattern of this.orchestrationPatterns) {
      if (pattern.test(requestLower)) {
        confidence += 0.2;
        reasons.push(`Matches pattern: ${pattern.source}`);
      }
    }

    // Check for multiple domain indicators
    const domains: string[] = [];
    if (['test', 'testing', 'coverage'].some(word => requestLower.includes(word))) {
      domains.push('testing');
    }
    if (['security', 'audit', 'vulnerability'].some(word => requestLower.includes(word))) {
      domains.push('security');
    }
    if (['performance', 'optimization', 'bundle'].some(word => requestLower.includes(word))) {
      domains.push('performance');
    }
    if (['architecture', 'design', 'pattern'].some(word => requestLower.includes(word))) {
      domains.push('architecture');
    }
    if (['bluetooth', 'ble', 'nfc', 'hardware'].some(word => requestLower.includes(word))) {
      domains.push('hardware');
    }
    if (['solana', 'wallet', 'token', 'payment'].some(word => requestLower.includes(word))) {
      domains.push('blockchain');
    }

    if (domains.length >= 2) {
      confidence += 0.3 * domains.length;
      reasons.push(`Multi-domain task involving: ${domains.join(', ')}`);
    }

    // Check for complexity indicators
    const complexityWords = [
      'implement',
      'build',
      'create',
      'comprehensive',
      'complete',
      'entire',
      'full',
    ];
    const complexityCount = complexityWords.filter(word => requestLower.includes(word)).length;
    if (complexityCount >= 2) {
      confidence += 0.2;
      reasons.push('High complexity indicators detected');
    }

    const shouldOrchestrate = confidence >= 0.4;
    const reason =
      reasons.length > 0 ? reasons.join('; ') : 'No clear orchestration benefits detected';

    return [shouldOrchestrate, Math.min(confidence, 1.0), reason];
  }
}
