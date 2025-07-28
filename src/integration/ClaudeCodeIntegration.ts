/**
 * Claude Code Integration Layer
 *
 * Enhanced with context-aware natural language processing, multi-turn conversations,
 * domain-specific understanding, and adaptive prompt generation for intelligent
 * orchestration requests through slash commands and conversational interfaces.
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

export interface ConversationContext {
  id: string;
  userId?: string;
  sessionId?: string;
  history: ConversationTurn[];
  projectContext?: ProjectContext;
  preferences?: UserPreferences;
  activeTask?: string;
  lastIntent?: string;
  confidence?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  entities?: Record<string, string>;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ProjectContext {
  framework: string;
  platform: string;
  domain: string[];
  technologies: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  teamSize: number;
  timeline?: string;
  constraints?: string[];
  preferences?: {
    coordination: CoordinationStrategy;
    agentPriorities: Record<string, number>;
    qualityThresholds: Record<string, number>;
  };
}

export interface UserPreferences {
  preferredAgents: string[];
  avoidedAgents: string[];
  defaultStrategy: CoordinationStrategy;
  verbosity: 'minimal' | 'standard' | 'detailed';
  autoConfirm: boolean;
  notificationPreferences: {
    progress: boolean;
    completion: boolean;
    errors: boolean;
  };
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  context: Record<string, any>;
  suggestions?: string[];
}

export interface ContextualPrompt {
  agentId: string;
  prompt: string;
  context: Record<string, any>;
  priority: number;
  estimatedComplexity: number;
  dependencies: string[];
}

interface DomainKnowledge {
  vocabulary: Record<string, string[]>;
  patterns: RegExp[];
  commonTasks: string[];
  agentAffinities: Record<string, number>;
  complexityFactors: string[];
}

export class ClaudeCodeIntegration {
  private availableAgents: Record<string, AgentInfo>;
  private orchestrationPatterns: RegExp[];
  private conversations: Map<string, ConversationContext> = new Map();
  private intentPatterns: Map<string, RegExp[]> = new Map();
  private domainModels: Map<string, DomainKnowledge> = new Map();
  private contextualMemory: Map<string, any> = new Map();

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

    this.initializeNLPCapabilities();
    this.initializeDomainKnowledge();
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
              capabilities: info.bestFor, // Use bestFor as capabilities
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

  /**
   * Enhanced conversational interface with context awareness
   */
  async handleConversationalInput(
    input: string,
    conversationId?: string,
    userId?: string
  ): Promise<OrchestrationResult> {
    const context = this.getOrCreateConversationContext(conversationId, userId);
    
    // Classify intent
    const intent = this.classifyIntent(input, context);
    
    // Update conversation history
    this.addConversationTurn(context, {
      id: `turn_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
      intent: intent.intent,
      entities: intent.entities,
      confidence: intent.confidence,
    });

    // Generate contextual response
    const response = await this.generateContextualResponse(intent, context);
    
    // Add assistant response to history
    this.addConversationTurn(context, {
      id: `turn_${Date.now()}_response`,
      role: 'assistant',
      content: response.nextSteps?.join(' ') || 'I understand your request.',
      timestamp: new Date(),
    });

    return response;
  }

  /**
   * Generate contextual prompts for agents based on conversation history
   */
  generateContextualPrompts(
    task: string,
    agents: string[],
    conversationId?: string
  ): Map<string, ContextualPrompt> {
    const prompts = new Map<string, ContextualPrompt>();
    const context = conversationId ? this.conversations.get(conversationId) : null;
    
    for (const agentId of agents) {
      const agentInfo = this.availableAgents[agentId];
      if (!agentInfo) continue;

      const basePrompt = this.generateBasePrompt(task, agentInfo);
      const contextualEnhancements = this.getContextualEnhancements(agentId, context || null);
      const domainSpecificInfo = this.getDomainSpecificInfo(task, agentId);
      
      const enhancedPrompt = this.combinePromptElements(
        basePrompt,
        contextualEnhancements,
        domainSpecificInfo,
        context || null
      );

      prompts.set(agentId, {
        agentId,
        prompt: enhancedPrompt,
        context: {
          task,
          conversationHistory: context?.history || [],
          projectContext: context?.projectContext,
          userPreferences: context?.preferences,
        },
        priority: this.calculateAgentPriority(agentId, task, context || null),
        estimatedComplexity: this.estimateAgentComplexity(agentId, task),
        dependencies: this.identifyAgentDependencies(agentId, agents, task),
      });
    }

    return prompts;
  }

  /**
   * Analyze task context and extract relevant information
   */
  analyzeTaskContext(task: string, conversationHistory?: ConversationTurn[]): {
    domain: string[];
    complexity: number;
    urgency: 'low' | 'medium' | 'high';
    constraints: string[];
    preferences: Record<string, any>;
  } {
    const taskLower = task.toLowerCase();
    
    // Domain detection
    const domains: string[] = [];
    for (const [domain, knowledge] of this.domainModels) {
      if (knowledge.patterns.some(pattern => pattern.test(taskLower))) {
        domains.push(domain);
      }
    }

    // Complexity analysis
    let complexity = this.calculateTaskComplexity(task);
    
    // Analyze conversation history for additional context
    if (conversationHistory) {
      const recentTurns = conversationHistory.slice(-5);
      const urgencyKeywords = ['urgent', 'asap', 'quick', 'immediately', 'priority'];
      const complexityKeywords = ['complex', 'difficult', 'challenging', 'comprehensive'];
      
      for (const turn of recentTurns) {
        if (urgencyKeywords.some(keyword => turn.content.toLowerCase().includes(keyword))) {
          complexity += 1;
        }
        if (complexityKeywords.some(keyword => turn.content.toLowerCase().includes(keyword))) {
          complexity += 2;
        }
      }
    }

    // Extract constraints
    const constraints = this.extractConstraints(task, conversationHistory);

    // Determine urgency
    const urgency = this.determineUrgency(task, conversationHistory);

    // Extract preferences
    const preferences = this.extractPreferences(conversationHistory);

    return {
      domain: domains,
      complexity: Math.min(complexity, 10),
      urgency,
      constraints,
      preferences,
    };
  }

  /**
   * Update user preferences based on interaction patterns
   */
  updateUserPreferences(
    conversationId: string,
    preferences: Partial<UserPreferences>
  ): void {
    const context = this.conversations.get(conversationId);
    if (!context) return;

    // Filter out undefined values before merging
    const definedPreferences = Object.fromEntries(
      Object.entries(preferences).filter(([_, value]) => value !== undefined)
    ) as Partial<UserPreferences>;
    
    context.preferences = {
      ...context.preferences,
      ...definedPreferences,
    } as UserPreferences;
    
    context.updatedAt = new Date();
    this.conversations.set(conversationId, context);
  }

  /**
   * Get intelligent suggestions based on context
   */
  getIntelligentSuggestions(
    task: string,
    conversationId?: string
  ): {
    agentSuggestions: string[];
    strategySuggestions: CoordinationStrategy[];
    optimizations: string[];
    risks: string[];
  } {
    const context = conversationId ? this.conversations.get(conversationId) : null;
    const taskAnalysis = this.analyzeTaskContext(task, context?.history);
    
    // Enhanced agent suggestions
    const agentSuggestions = this.getEnhancedAgentSuggestions(task, taskAnalysis, context || null);
    
    // Strategy suggestions
    const strategySuggestions = this.getStrategySuggestions(taskAnalysis, agentSuggestions.length);
    
    // Optimization suggestions
    const optimizations = this.getOptimizationSuggestions(task, taskAnalysis, context || null);
    
    // Risk identification
    const risks = this.identifyRisks(task, taskAnalysis, agentSuggestions);

    return {
      agentSuggestions,
      strategySuggestions,
      optimizations,
      risks,
    };
  }

  private initializeNLPCapabilities(): void {
    // Initialize intent patterns
    this.intentPatterns.set('orchestrate', [
      /(?:orchestrate|coordinate|manage)\s+(.+)/i,
      /(?:run|execute|start)\s+(?:orchestration|coordination)\s+for\s+(.+)/i,
      /(?:help me|can you)\s+(?:implement|build|create)\s+(.+)/i,
    ]);

    this.intentPatterns.set('query_status', [
      /(?:what'?s|how'?s)\s+(?:the\s+)?(?:status|progress)/i,
      /(?:check|show)\s+(?:status|progress)/i,
      /(?:how\s+is|what\s+about)\s+(?:the\s+)?(?:orchestration|task)/i,
    ]);

    this.intentPatterns.set('modify_task', [
      /(?:change|modify|update|adjust)\s+(.+)/i,
      /(?:add|include|also)\s+(.+)/i,
      /(?:remove|exclude|skip)\s+(.+)/i,
    ]);

    this.intentPatterns.set('request_help', [
      /(?:help|assist|guide)\s*(?:me)?/i,
      /(?:how\s+(?:do|can)\s+I|what\s+should\s+I)/i,
      /(?:explain|tell\s+me\s+about)/i,
    ]);

    this.intentPatterns.set('express_preference', [
      /(?:I\s+(?:prefer|like|want|need))\s+(.+)/i,
      /(?:use|employ|leverage)\s+(.+)/i,
      /(?:avoid|don'?t\s+use|skip)\s+(.+)/i,
    ]);
  }

  private initializeDomainKnowledge(): void {
    // Blockchain/Crypto domain
    this.domainModels.set('blockchain', {
      vocabulary: {
        tokens: ['token', 'cryptocurrency', 'crypto', 'coin', 'genesis', 'bonk'],
        operations: ['transaction', 'transfer', 'payment', 'verification', 'validation'],
        platforms: ['solana', 'ethereum', 'blockchain', 'web3', 'defi'],
        security: ['wallet', 'private key', 'signature', 'encryption', 'audit'],
      },
      patterns: [
        /(?:solana|blockchain|crypto|token|wallet)/i,
        /(?:payment|transaction|transfer)/i,
        /(?:genesis\s+token|bonk|cryptocurrency)/i,
      ],
      commonTasks: [
        'wallet integration',
        'token verification',
        'payment processing',
        'transaction handling',
      ],
      agentAffinities: {
        'solana-mobile-expert': 0.9,
        'security-audit-specialist': 0.7,
        'architecture-reviewer': 0.6,
      },
      complexityFactors: ['security', 'compliance', 'integration', 'testing'],
    });

    // Hardware domain
    this.domainModels.set('hardware', {
      vocabulary: {
        connectivity: ['bluetooth', 'ble', 'nfc', 'wifi', 'radio'],
        devices: ['phone', 'device', 'hardware', 'sensor', 'peripheral'],
        operations: ['scan', 'connect', 'pair', 'transmit', 'receive'],
        protocols: ['protocol', 'communication', 'data', 'signal'],
      },
      patterns: [
        /(?:bluetooth|ble|nfc|hardware)/i,
        /(?:device|peripheral|sensor)/i,
        /(?:connect|pair|communicate)/i,
      ],
      commonTasks: [
        'device integration',
        'bluetooth connectivity',
        'NFC implementation',
        'hardware permissions',
      ],
      agentAffinities: {
        'hardware-integration-specialist': 0.9,
        'test-automation-engineer': 0.6,
        'security-audit-specialist': 0.5,
      },
      complexityFactors: ['permissions', 'compatibility', 'protocols', 'testing'],
    });

    // Performance domain
    this.domainModels.set('performance', {
      vocabulary: {
        metrics: ['performance', 'speed', 'latency', 'throughput', 'efficiency'],
        optimization: ['optimize', 'improve', 'enhance', 'accelerate', 'streamline'],
        issues: ['slow', 'lag', 'bottleneck', 'memory leak', 'crash'],
        tools: ['profiler', 'monitor', 'benchmark', 'analysis'],
      },
      patterns: [
        /(?:performance|optimization|speed|memory)/i,
        /(?:slow|lag|bottleneck|crash)/i,
        /(?:optimize|improve|enhance)/i,
      ],
      commonTasks: [
        'performance optimization',
        'memory management',
        'bundle size reduction',
        'startup time improvement',
      ],
      agentAffinities: {
        'react-native-performance-engineer': 0.9,
        'architecture-reviewer': 0.6,
        'test-automation-engineer': 0.5,
      },
      complexityFactors: ['profiling', 'measurement', 'optimization', 'validation'],
    });

    // Add more domains as needed...
  }

  private getOrCreateConversationContext(
    conversationId?: string,
    userId?: string
  ): ConversationContext {
    const id = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.conversations.has(id)) {
      return this.conversations.get(id)!;
    }

    const context: ConversationContext = {
      id,
      userId,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(id, context);
    return context;
  }

  private classifyIntent(input: string, context: ConversationContext): IntentClassification {
    const inputLower = input.toLowerCase();
    let bestMatch: IntentClassification = {
      intent: 'unknown',
      confidence: 0,
      entities: {},
      context: {},
    };

    for (const [intentName, patterns] of this.intentPatterns) {
      for (const pattern of patterns) {
        const match = pattern.exec(inputLower);
        if (match) {
          const confidence = this.calculateIntentConfidence(match, context);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              intent: intentName,
              confidence,
              entities: this.extractEntities(input, match),
              context: { match: match[0], groups: match.slice(1) },
            };
          }
        }
      }
    }

    // Apply context-based confidence adjustment
    bestMatch.confidence = this.adjustConfidenceBasedOnContext(bestMatch, context);

    return bestMatch;
  }

  private addConversationTurn(context: ConversationContext, turn: ConversationTurn): void {
    context.history.push(turn);
    context.updatedAt = new Date();
    
    // Keep only last 20 turns for efficiency
    if (context.history.length > 20) {
      context.history = context.history.slice(-20);
    }
  }

  private async generateContextualResponse(
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<OrchestrationResult> {
    switch (intent.intent) {
      case 'orchestrate':
        return await this.handleContextualOrchestration(intent, context);
      
      case 'query_status':
        return await this.handleStatusQuery(intent, context);
      
      case 'modify_task':
        return await this.handleTaskModification(intent, context);
      
      case 'request_help':
        return await this.handleHelpRequest(intent, context);
      
      case 'express_preference':
        return await this.handlePreferenceExpression(intent, context);
      
      default:
        return {
          success: false,
          action: 'unclear_intent',
          error: 'I didn\'t understand your request. Could you please rephrase?',
          nextSteps: [
            'Try: "orchestrate [task description]"',
            'Or: "help with [specific topic]"',
            'Or: "what\'s the status?"',
          ],
        };
    }
  }

  private async handleContextualOrchestration(
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<OrchestrationResult> {
    const taskDescription = intent.context.groups?.[0] || intent.entities.task || '';
    
    if (!taskDescription.trim()) {
      return {
        success: false,
        action: 'missing_task_description',
        error: 'What would you like me to orchestrate?',
        nextSteps: [
          'Describe the task you want to implement',
          'For example: "implement payment system with security review"',
        ],
      };
    }

    // Use existing orchestration logic but with enhanced context
    const result = await this.handleOrchestrateCommand(taskDescription);
    
    // Enhance with conversational context
    if (result.success && result.plan) {
      result.plan = this.enhancePlanWithContext(result.plan, context);
    }

    return result;
  }

  private async handleStatusQuery(
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<OrchestrationResult> {
    if (context.activeTask) {
      return {
        success: true,
        action: 'status_update',
        status: await this.getOrchestrationStatus(),
        nextSteps: [
          'Current task: ' + context.activeTask,
          'Use "modify task" to make changes',
          'Use "orchestrate [new task]" to start fresh',
        ],
      };
    } else {
      return {
        success: true,
        action: 'no_active_task',
        nextSteps: [
          'No active orchestration',
          'Start with: "orchestrate [task description]"',
          'Or: "help me implement [feature]"',
        ],
      };
    }
  }

  private async handleTaskModification(
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<OrchestrationResult> {
    const modification = intent.context.groups?.[0] || '';
    
    if (!context.activeTask) {
      return {
        success: false,
        action: 'no_active_task',
        error: 'No active task to modify',
        nextSteps: ['Start with: "orchestrate [task description]"'],
      };
    }

    // Apply modification to active task
    const modifiedTask = this.applyTaskModification(context.activeTask, modification);
    context.activeTask = modifiedTask;

    return await this.handleOrchestrateCommand(modifiedTask);
  }

  private async handleHelpRequest(
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<OrchestrationResult> {
    const topic = intent.context.groups?.[0] || '';
    
    return {
      success: true,
      action: 'help_provided',
      nextSteps: this.getContextualHelp(topic, context),
      examples: [
        'orchestrate implement BLE payments with security review',
        'help me optimize performance',
        'what agents are available?',
        'show status',
      ],
    };
  }

  private async handlePreferenceExpression(
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<OrchestrationResult> {
    const preference = intent.context.groups?.[0] || '';
    
    // Parse and store preference
    const parsedPreferences = this.parsePreference(preference);
    this.updateUserPreferences(context.id, parsedPreferences);

    return {
      success: true,
      action: 'preference_updated',
      nextSteps: [
        `Preference noted: ${preference}`,
        'This will be applied to future orchestrations',
        'Continue with your task description',
      ],
    };
  }

  // Additional helper methods for enhanced NLP capabilities

  private generateBasePrompt(task: string, agentInfo: AgentInfo): string {
    return `As a ${agentInfo.name}, you are tasked with: ${task}. 
Your expertise includes: ${agentInfo.capabilities.join(', ')}. 
Focus on: ${agentInfo.bestFor.join(', ')}.`;
  }

  private getContextualEnhancements(agentId: string, context: ConversationContext | null): string {
    if (!context?.projectContext) return '';

    const enhancements: string[] = [];
    
    if (context.projectContext.framework) {
      enhancements.push(`Framework: ${context.projectContext.framework}`);
    }
    
    if (context.projectContext.constraints?.length) {
      enhancements.push(`Constraints: ${context.projectContext.constraints.join(', ')}`);
    }

    return enhancements.length > 0 ? `\nContext: ${enhancements.join('; ')}` : '';
  }

  private getDomainSpecificInfo(task: string, agentId: string): string {
    const taskLower = task.toLowerCase();
    let domainInfo = '';

    for (const [domain, knowledge] of this.domainModels) {
      if (knowledge.patterns.some(pattern => pattern.test(taskLower))) {
        const affinity = knowledge.agentAffinities[agentId] || 0;
        if (affinity > 0.5) {
          domainInfo += `\nDomain expertise: ${domain} (relevance: ${(affinity * 100).toFixed(0)}%)`;
          domainInfo += `\nKey considerations: ${knowledge.complexityFactors.join(', ')}`;
        }
      }
    }

    return domainInfo;
  }

  private combinePromptElements(
    basePrompt: string,
    contextualEnhancements: string,
    domainSpecificInfo: string,
    context: ConversationContext | null
  ): string {
    let combinedPrompt = basePrompt;
    
    if (contextualEnhancements) {
      combinedPrompt += contextualEnhancements;
    }
    
    if (domainSpecificInfo) {
      combinedPrompt += domainSpecificInfo;
    }

    if (context?.preferences?.verbosity === 'detailed') {
      combinedPrompt += '\nProvide detailed explanations and step-by-step reasoning.';
    } else if (context?.preferences?.verbosity === 'minimal') {
      combinedPrompt += '\nBe concise and focus on key deliverables.';
    }

    return combinedPrompt;
  }

  private calculateAgentPriority(agentId: string, task: string, context: ConversationContext | null): number {
    let priority = 1;

    // Base priority from task relevance
    const taskLower = task.toLowerCase();
    for (const [domain, knowledge] of this.domainModels) {
      if (knowledge.patterns.some(pattern => pattern.test(taskLower))) {
        const affinity = knowledge.agentAffinities[agentId] || 0;
        priority += affinity;
      }
    }

    // Adjust based on user preferences
    if (context?.preferences?.preferredAgents.includes(agentId)) {
      priority += 0.5;
    }
    
    if (context?.preferences?.avoidedAgents.includes(agentId)) {
      priority -= 0.5;
    }

    return priority;
  }

  private estimateAgentComplexity(agentId: string, task: string): number {
    const baseComplexity = this.calculateTaskComplexity(task);
    
    // Adjust based on agent specialization
    const agentInfo = this.availableAgents[agentId];
    if (!agentInfo) return baseComplexity;

    const taskLower = task.toLowerCase();
    let adjustment = 0;

    // If task matches agent's expertise, complexity is lower for them
    for (const expertise of agentInfo.bestFor) {
      if (taskLower.includes(expertise.toLowerCase())) {
        adjustment -= 1;
      }
    }

    return Math.max(1, baseComplexity + adjustment);
  }

  private identifyAgentDependencies(agentId: string, allAgents: string[], task: string): string[] {
    const dependencies: string[] = [];

    // Architecture review should come first for complex tasks
    if (agentId !== 'architecture-reviewer' && 
        allAgents.includes('architecture-reviewer') && 
        this.calculateTaskComplexity(task) > 5) {
      dependencies.push('architecture-reviewer');
    }

    // Security should review blockchain implementations
    if (agentId === 'security-audit-specialist' && 
        allAgents.includes('solana-mobile-expert')) {
      dependencies.push('solana-mobile-expert');
    }

    // Testing should come after implementation
    if (agentId === 'test-automation-engineer') {
      const implementationAgents = allAgents.filter(id => 
        !['test-automation-engineer', 'architecture-reviewer', 'security-audit-specialist'].includes(id)
      );
      dependencies.push(...implementationAgents);
    }

    return dependencies;
  }

  private calculateIntentConfidence(match: RegExpExecArray, context: ConversationContext): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence if similar intents in recent history
    const recentIntents = context.history.slice(-3).map(turn => turn.intent).filter(Boolean);
    if (recentIntents.length > 0) {
      // Context consistency bonus
      confidence += 0.1;
    }

    // Adjust based on match quality
    if (match[0].length > 10) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private extractEntities(input: string, match: RegExpExecArray): Record<string, string> {
    const entities: Record<string, string> = {};
    
    if (match.length > 1) {
      entities.task = match[1].trim();
    }

    // Extract common entities
    const entityPatterns = {
      agent: /(?:using|with|include)\s+([a-z-]+(?:\s+[a-z-]+)*)\s+agent/i,
      strategy: /(?:strategy|approach|method):\s*([a-z_]+)/i,
      timeline: /(?:by|within|in)\s+(\d+\s+(?:days?|weeks?|months?))/i,
    };

    for (const [entityType, pattern] of Object.entries(entityPatterns)) {
      const entityMatch = pattern.exec(input);
      if (entityMatch) {
        entities[entityType] = entityMatch[1];
      }
    }

    return entities;
  }

  private adjustConfidenceBasedOnContext(
    classification: IntentClassification,
    context: ConversationContext
  ): number {
    let adjustedConfidence = classification.confidence;

    // If there's an active task and user is asking about status, boost confidence
    if (classification.intent === 'query_status' && context.activeTask) {
      adjustedConfidence += 0.2;
    }

    // If user has clear preferences that match the intent, boost confidence
    if (context.preferences && classification.intent === 'express_preference') {
      adjustedConfidence += 0.1;
    }

    return Math.min(adjustedConfidence, 1.0);
  }

  private enhancePlanWithContext(plan: OrchestrationPlan, context: ConversationContext): OrchestrationPlan {
    const enhanced = { ...plan };

    // Apply user preferences
    if (context.preferences?.defaultStrategy) {
      enhanced.coordinationStrategy = context.preferences.defaultStrategy;
    }

    // Filter agents based on preferences
    if (context.preferences?.avoidedAgents.length) {
      enhanced.suggestedAgents = enhanced.suggestedAgents.filter(
        agentId => !context.preferences!.avoidedAgents.includes(agentId)
      );
    }

    // Add preferred agents if they're relevant
    if (context.preferences?.preferredAgents.length) {
      const relevantPreferred = context.preferences.preferredAgents.filter(
        agentId => this.isAgentRelevantForTask(agentId, plan.task)
      );
      
      for (const agentId of relevantPreferred) {
        if (!enhanced.suggestedAgents.includes(agentId)) {
          enhanced.suggestedAgents.push(agentId);
        }
      }
    }

    return enhanced;
  }

  private applyTaskModification(currentTask: string, modification: string): string {
    const modLower = modification.toLowerCase();
    
    if (modLower.startsWith('add') || modLower.startsWith('include') || modLower.startsWith('also')) {
      const addition = modification.replace(/^(add|include|also)\s+/i, '');
      return `${currentTask} and ${addition}`;
    }
    
    if (modLower.startsWith('remove') || modLower.startsWith('exclude') || modLower.startsWith('skip')) {
      // Simple implementation - would be more sophisticated in practice
      return currentTask + ` (excluding ${modification.replace(/^(remove|exclude|skip)\s+/i, '')})`;
    }
    
    if (modLower.startsWith('change') || modLower.startsWith('modify') || modLower.startsWith('update')) {
      const change = modification.replace(/^(change|modify|update)\s+/i, '');
      return `${currentTask} (modified: ${change})`;
    }

    return `${currentTask} (${modification})`;
  }

  private getContextualHelp(topic: string, context: ConversationContext): string[] {
    if (!topic) {
      return [
        'Available commands:',
        '• "orchestrate [task]" - Start a new orchestration',
        '• "status" - Check current progress',
        '• "help with [topic]" - Get specific help',
        '• "I prefer [preference]" - Set preferences',
      ];
    }

    const topicLower = topic.toLowerCase();
    
    if (topicLower.includes('agent')) {
      return [
        'Available agents:',
        '• architecture-reviewer - Code design and patterns',
        '• test-automation-engineer - Testing and quality',
        '• security-audit-specialist - Security analysis',
        '• hardware-integration-specialist - Device connectivity',
        '• solana-mobile-expert - Blockchain integration',
        '• performance-engineer - Optimization',
        '• ux-director - User experience',
        '• devops-engineer - Deployment',
      ];
    }

    if (topicLower.includes('strategy') || topicLower.includes('coordination')) {
      return [
        'Coordination strategies:',
        '• parallel - Agents work simultaneously',
        '• sequential - Agents work one after another',
        '• phased_parallel - Phases with parallel execution',
        'Strategy is auto-selected based on task complexity',
      ];
    }

    return [`Help topic "${topic}" - ask more specifically about agents, strategies, or commands`];
  }

  private parsePreference(preference: string): Partial<UserPreferences> {
    const prefLower = preference.toLowerCase();
    const parsed: Partial<UserPreferences> = {};

    // Parse agent preferences
    if (prefLower.includes('agent')) {
      const agentIds = Object.keys(this.availableAgents);
      const mentionedAgents = agentIds.filter(id => prefLower.includes(id.replace('-', ' ')));
      
      if (prefLower.includes('avoid') || prefLower.includes("don't")) {
        parsed.avoidedAgents = mentionedAgents;
      } else {
        parsed.preferredAgents = mentionedAgents;
      }
    }

    // Parse strategy preferences
    if (prefLower.includes('parallel')) {
      parsed.defaultStrategy = 'parallel';
    } else if (prefLower.includes('sequential')) {
      parsed.defaultStrategy = 'sequential';
    } else if (prefLower.includes('phased')) {
      parsed.defaultStrategy = 'phased_parallel';
    }

    // Parse verbosity preferences
    if (prefLower.includes('detailed') || prefLower.includes('verbose')) {
      parsed.verbosity = 'detailed';
    } else if (prefLower.includes('minimal') || prefLower.includes('concise')) {
      parsed.verbosity = 'minimal';
    }

    return parsed;
  }

  private getEnhancedAgentSuggestions(
    task: string,
    analysis: any,
    context: ConversationContext | null
  ): string[] {
    let suggestions = this.suggestAgentsForTask(task);

    // Apply domain-specific enhancements
    for (const domain of analysis.domain) {
      const domainKnowledge = this.domainModels.get(domain);
      if (domainKnowledge) {
        const domainAgents = Object.entries(domainKnowledge.agentAffinities)
          .filter(([_, affinity]) => affinity > 0.6)
          .map(([agentId]) => agentId);
        
        for (const agentId of domainAgents) {
          if (!suggestions.includes(agentId)) {
            suggestions.push(agentId);
          }
        }
      }
    }

    // Apply user preferences
    if (context?.preferences) {
      const prefs = context.preferences;
      
      // Remove avoided agents
      suggestions = suggestions.filter(id => !prefs.avoidedAgents.includes(id));
      
      // Prioritize preferred agents
      const preferred = prefs.preferredAgents.filter(id => this.isAgentRelevantForTask(id, task));
      suggestions = [...preferred, ...suggestions.filter(id => !preferred.includes(id))];
    }

    return suggestions.slice(0, 5); // Limit to top 5
  }

  private getStrategySuggestions(analysis: any, agentCount: number): CoordinationStrategy[] {
    const strategies: CoordinationStrategy[] = [];

    if (analysis.urgency === 'high' && agentCount >= 2) {
      strategies.push('parallel');
    }

    if (analysis.complexity > 7) {
      strategies.push('phased_parallel');
    }

    if (agentCount <= 2 || analysis.complexity <= 3) {
      strategies.push('sequential');
    }

    // Always include parallel as an option
    if (!strategies.includes('parallel')) {
      strategies.push('parallel');
    }

    return strategies;
  }

  private getOptimizationSuggestions(
    task: string,
    analysis: any,
    context: ConversationContext | null
  ): string[] {
    const optimizations: string[] = [];

    if (analysis.complexity > 6) {
      optimizations.push('Consider breaking down into smaller subtasks');
    }

    if (analysis.domain.length > 3) {
      optimizations.push('Use phased execution to manage complexity');
    }

    if (context?.history && context.history.length > 5) {
      optimizations.push('Leverage previous conversation context');
    }

    return optimizations;
  }

  private identifyRisks(task: string, analysis: any, agents: string[]): string[] {
    const risks: string[] = [];

    if (analysis.complexity > 8) {
      risks.push('High complexity may lead to longer execution time');
    }

    if (agents.length > 4) {
      risks.push('Multiple agents may require careful coordination');
    }

    if (analysis.domain.includes('blockchain') && analysis.domain.includes('hardware')) {
      risks.push('Cross-domain integration complexity');
    }

    return risks;
  }

  private extractConstraints(task: string, history?: ConversationTurn[]): string[] {
    const constraints: string[] = [];
    const taskLower = task.toLowerCase();

    // Time constraints
    const timePatterns = [
      /(?:by|within|before)\s+(\d+\s+(?:days?|weeks?|months?|hours?))/i,
      /(?:urgent|asap|quickly|immediately)/i,
    ];

    for (const pattern of timePatterns) {
      const match = pattern.exec(taskLower);
      if (match) {
        constraints.push(`Time constraint: ${match[1] || 'urgent'}`);
      }
    }

    // Resource constraints
    if (taskLower.includes('budget') || taskLower.includes('cost')) {
      constraints.push('Budget constraints mentioned');
    }

    // Technical constraints
    if (taskLower.includes('must use') || taskLower.includes('required to')) {
      constraints.push('Technical requirements specified');
    }

    return constraints;
  }

  private determineUrgency(task: string, history?: ConversationTurn[]): 'low' | 'medium' | 'high' {
    const taskLower = task.toLowerCase();
    const urgencyKeywords = {
      high: ['urgent', 'asap', 'immediately', 'critical', 'emergency'],
      medium: ['soon', 'quickly', 'priority', 'important'],
      low: ['eventually', 'when possible', 'later'],
    };

    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      if (keywords.some(keyword => taskLower.includes(keyword))) {
        return level as 'low' | 'medium' | 'high';
      }
    }

    // Check conversation history for urgency indicators
    if (history) {
      const recentContent = history.slice(-3).map(turn => turn.content.toLowerCase()).join(' ');
      for (const [level, keywords] of Object.entries(urgencyKeywords)) {
        if (keywords.some(keyword => recentContent.includes(keyword))) {
          return level as 'low' | 'medium' | 'high';
        }
      }
    }

    return 'medium'; // Default
  }

  private extractPreferences(history?: ConversationTurn[]): Record<string, any> {
    const preferences: Record<string, any> = {};

    if (!history) return preferences;

    const recentContent = history.slice(-5).map(turn => turn.content.toLowerCase()).join(' ');

    // Extract quality preferences
    if (recentContent.includes('high quality') || recentContent.includes('thorough')) {
      preferences.quality = 'high';
    }

    // Extract speed preferences
    if (recentContent.includes('fast') || recentContent.includes('quick')) {
      preferences.speed = 'high';
    }

    return preferences;
  }

  private isAgentRelevantForTask(agentId: string, task: string): boolean {
    const agentInfo = this.availableAgents[agentId];
    if (!agentInfo) return false;

    const taskLower = task.toLowerCase();
    
    return agentInfo.bestFor.some(expertise => 
      taskLower.includes(expertise.toLowerCase())
    );
  }
}
