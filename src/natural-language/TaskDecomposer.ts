/**
 * Task Decomposer
 * 
 * Intelligent task breakdown system that analyzes natural language descriptions
 * and creates structured, agent-specific subtasks with dependencies.
 */

import { 
  TaskDecomposition, 
  SubTask, 
  TaskDependencyGraph, 
  CoordinationStrategy,
  AgentInfo 
} from '../types';

export interface DecompositionOptions {
  availableAgents: Record<string, AgentInfo>;
  projectContext?: {
    framework: string;
    platform: string;
    domain: string[];
  };
  complexity?: 'simple' | 'moderate' | 'complex';
  timeConstraints?: {
    deadline?: Date;
    preferredDuration?: number; // in hours
  };
}

export interface TaskPattern {
  pattern: RegExp;
  agentTypes: string[];
  complexity: number;
  dependencies?: string[];
  templates: string[];
}

export class TaskDecomposer {
  private taskPatterns: TaskPattern[] = [];
  private agentCapabilityMap: Map<string, string[]> = new Map();

  constructor() {
    this.initializeTaskPatterns();
  }

  /**
   * Decompose a natural language task into structured subtasks
   */
  async decomposeTask(
    taskDescription: string, 
    options: DecompositionOptions
  ): Promise<TaskDecomposition> {
    // Analyze the task
    const analysis = this.analyzeTaskDescription(taskDescription);
    
    // Extract key components
    const components = this.extractTaskComponents(taskDescription, analysis);
    
    // Generate subtasks
    const subtasks = await this.generateSubtasks(taskDescription, components, options);
    
    // Build dependency graph
    const dependencies = this.buildDependencyGraph(subtasks);
    
    // Determine coordination strategy
    const recommendedStrategy = this.determineCoordinationStrategy(subtasks, dependencies);
    
    // Calculate complexity
    const estimatedComplexity = this.calculateComplexity(subtasks, dependencies);

    return {
      originalTask: taskDescription,
      subtasks,
      dependencies,
      estimatedComplexity,
      recommendedStrategy,
    };
  }

  /**
   * Generate contextual prompts for each agent based on subtasks
   */
  generateAgentPrompts(
    decomposition: TaskDecomposition,
    options: DecompositionOptions
  ): Map<string, string> {
    const prompts = new Map<string, string>();

    for (const subtask of decomposition.subtasks) {
      const agent = options.availableAgents[subtask.assignedAgent];
      if (!agent) continue;

      const contextualPrompt = this.buildContextualPrompt(
        subtask,
        agent,
        decomposition,
        options
      );
      
      prompts.set(subtask.assignedAgent, contextualPrompt);
    }

    return prompts;
  }

  /**
   * Analyze dependencies and suggest optimization
   */
  optimizeTaskFlow(decomposition: TaskDecomposition): TaskDecomposition {
    const optimizedSubtasks = this.parallelizeIndependentTasks(decomposition.subtasks);
    const optimizedGraph = this.optimizeDependencyGraph(decomposition.dependencies);
    
    return {
      ...decomposition,
      subtasks: optimizedSubtasks,
      dependencies: optimizedGraph,
    };
  }

  private analyzeTaskDescription(description: string): {
    domain: string[];
    complexity: number;
    keyVerbs: string[];
    technologies: string[];
    deliverables: string[];
  } {
    const domains = this.identifyDomains(description);
    const complexity = this.estimateTaskComplexity(description);
    const keyVerbs = this.extractActionVerbs(description);
    const technologies = this.identifyTechnologies(description);
    const deliverables = this.identifyDeliverables(description);

    return {
      domain: domains,
      complexity,
      keyVerbs,
      technologies,
      deliverables,
    };
  }

  private extractTaskComponents(description: string, analysis: any): {
    mainObjective: string;
    constraints: string[];
    requirements: string[];
    quality: string[];
  } {
    const mainObjective = this.extractMainObjective(description);
    const constraints = this.extractConstraints(description);
    const requirements = this.extractRequirements(description);
    const quality = this.extractQualityRequirements(description);

    return {
      mainObjective,
      constraints,
      requirements,
      quality,
    };
  }

  private async generateSubtasks(
    originalTask: string,
    components: any,
    options: DecompositionOptions
  ): Promise<SubTask[]> {
    const subtasks: SubTask[] = [];
    
    // Match task patterns to generate initial subtasks
    const matchedPatterns = this.matchTaskPatterns(originalTask);
    
    for (const pattern of matchedPatterns) {
      const agentId = this.selectBestAgent(pattern.agentTypes, options.availableAgents);
      if (!agentId) continue;

      // Generate subtasks based on pattern templates
      for (const template of pattern.templates) {
        const subtask = this.createSubtaskFromTemplate(
          template,
          originalTask,
          agentId,
          pattern
        );
        subtasks.push(subtask);
      }
    }

    // Add specialized subtasks based on project context
    if (options.projectContext) {
      const contextualSubtasks = this.generateContextualSubtasks(
        originalTask,
        options.projectContext,
        options.availableAgents
      );
      subtasks.push(...contextualSubtasks);
    }

    // Ensure all critical phases are covered
    this.ensureCriticalPhases(subtasks, originalTask, options.availableAgents);

    return this.prioritizeSubtasks(subtasks);
  }

  private buildDependencyGraph(subtasks: SubTask[]): TaskDependencyGraph {
    const nodes = subtasks.map(st => st.id);
    const edges: { from: string; to: string; type: 'blocks' | 'depends_on' | 'parallel' }[] = [];

    // Analyze natural dependencies
    for (const subtask of subtasks) {
      for (const depId of subtask.dependencies) {
        edges.push({
          from: depId,
          to: subtask.id,
          type: 'depends_on',
        });
      }
    }

    // Add implicit dependencies based on task types
    this.addImplicitDependencies(subtasks, edges);

    return { nodes, edges };
  }

  private determineCoordinationStrategy(
    subtasks: SubTask[],
    dependencies: TaskDependencyGraph
  ): CoordinationStrategy {
    const parallelTasks = subtasks.filter(st => st.dependencies.length === 0);
    const sequentialChains = this.identifySequentialChains(dependencies);
    
    if (sequentialChains.length > 2 && parallelTasks.length < 3) {
      return 'sequential';
    } else if (parallelTasks.length > 3 && sequentialChains.length > 1) {
      return 'phased_parallel';
    } else {
      return 'parallel';
    }
  }

  private calculateComplexity(subtasks: SubTask[], dependencies: TaskDependencyGraph): number {
    let complexity = 0;
    
    // Base complexity from number of subtasks
    complexity += subtasks.length * 0.5;
    
    // Complexity from dependencies
    complexity += dependencies.edges.length * 0.3;
    
    // Complexity from diverse agent requirements
    const uniqueAgents = new Set(subtasks.map(st => st.assignedAgent));
    complexity += uniqueAgents.size * 0.2;
    
    // Complexity from estimated durations
    const totalDuration = subtasks.reduce((sum, st) => sum + st.estimatedDuration, 0);
    complexity += totalDuration / 60; // Convert minutes to hours
    
    return Math.min(complexity, 10); // Cap at 10
  }

  private buildContextualPrompt(
    subtask: SubTask,
    agent: AgentInfo,
    decomposition: TaskDecomposition,
    options: DecompositionOptions
  ): string {
    let prompt = `You are working as a ${agent.name} on the following task:\n\n`;
    prompt += `**Main Objective:** ${decomposition.originalTask}\n\n`;
    prompt += `**Your Specific Task:** ${subtask.description}\n\n`;
    
    if (subtask.deliverables.length > 0) {
      prompt += `**Expected Deliverables:**\n`;
      subtask.deliverables.forEach(deliverable => {
        prompt += `- ${deliverable}\n`;
      });
      prompt += '\n';
    }

    if (options.projectContext) {
      prompt += `**Project Context:**\n`;
      prompt += `- Framework: ${options.projectContext.framework}\n`;
      prompt += `- Platform: ${options.projectContext.platform}\n`;
      prompt += `- Domain: ${options.projectContext.domain.join(', ')}\n\n`;
    }

    if (subtask.dependencies.length > 0) {
      prompt += `**Dependencies:** This task depends on the completion of other subtasks. `;
      prompt += `Please coordinate with other agents and wait for their deliverables before proceeding.\n\n`;
    }

    prompt += `**Your Specializations:** ${agent.capabilities.join(', ')}\n\n`;
    
    prompt += `**Instructions:**\n`;
    prompt += `1. Focus on your area of expertise: ${agent.description}\n`;
    prompt += `2. Collaborate with other agents as needed\n`;
    prompt += `3. Ensure all deliverables meet quality standards\n`;
    prompt += `4. Document your work and provide clear handoffs\n`;
    prompt += `5. Communicate any blockers or issues immediately\n`;

    return prompt;
  }

  private initializeTaskPatterns(): void {
    this.taskPatterns = [
      // Development patterns
      {
        pattern: /implement|create|build|develop|add.*feature/i,
        agentTypes: ['architecture-reviewer', 'test-automation-engineer'],
        complexity: 3,
        templates: [
          'Review architecture and design patterns for the implementation',
          'Create comprehensive test suite for the feature',
          'Implement core functionality with proper error handling',
        ],
      },
      
      // Security patterns
      {
        pattern: /security|audit|vulnerability|penetration|encrypt/i,
        agentTypes: ['security-audit-specialist'],
        complexity: 4,
        templates: [
          'Perform security analysis and vulnerability assessment',
          'Implement security measures and encryption',
          'Conduct penetration testing and audit',
        ],
      },
      
      // Performance patterns
      {
        pattern: /optimize|performance|speed|memory|cpu|latency/i,
        agentTypes: ['performance-optimizer'],
        complexity: 3,
        templates: [
          'Analyze current performance metrics and bottlenecks',
          'Implement performance optimizations',
          'Set up monitoring and profiling tools',
        ],
      },
      
      // Hardware/BLE patterns
      {
        pattern: /ble|bluetooth|nfc|hardware|device|sensor/i,
        agentTypes: ['hardware-integration-specialist'],
        complexity: 4,
        templates: [
          'Design hardware integration architecture',
          'Implement device communication protocols',
          'Handle permissions and device compatibility',
        ],
      },
      
      // Blockchain patterns
      {
        pattern: /blockchain|solana|crypto|wallet|token|smart.*contract/i,
        agentTypes: ['solana-mobile-expert'],
        complexity: 5,
        templates: [
          'Design blockchain integration architecture',
          'Implement wallet connectivity and transactions',
          'Create smart contract interactions',
        ],
      },
      
      // UX/Accessibility patterns
      {
        pattern: /ui|ux|accessibility|design|user.*interface|usability/i,
        agentTypes: ['ux-accessibility-expert'],
        complexity: 2,
        templates: [
          'Audit accessibility compliance and usability',
          'Design user interface improvements',
          'Implement accessibility features',
        ],
      },
      
      // DevOps patterns
      {
        pattern: /deploy|ci\/cd|pipeline|docker|kubernetes|infrastructure/i,
        agentTypes: ['devops-integration-engineer'],
        complexity: 3,
        templates: [
          'Set up deployment pipeline and infrastructure',
          'Configure CI/CD workflows',
          'Implement monitoring and logging',
        ],
      },
    ];
  }

  private identifyDomains(description: string): string[] {
    const domainKeywords = {
      'web': ['web', 'browser', 'html', 'css', 'javascript', 'react', 'vue', 'angular'],
      'mobile': ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
      'blockchain': ['blockchain', 'crypto', 'bitcoin', 'ethereum', 'solana', 'defi', 'nft'],
      'ai': ['ai', 'machine learning', 'neural network', 'deep learning', 'nlp'],
      'security': ['security', 'encryption', 'authentication', 'vulnerability', 'audit'],
      'performance': ['performance', 'optimization', 'speed', 'memory', 'cpu', 'latency'],
    };

    const domains: string[] = [];
    const lowerDesc = description.toLowerCase();

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        domains.push(domain);
      }
    }

    return domains;
  }

  private estimateTaskComplexity(description: string): number {
    let complexity = 1;
    
    // Length indicator
    if (description.length > 200) complexity += 1;
    if (description.length > 500) complexity += 1;
    
    // Complexity keywords
    const complexityKeywords = [
      'integrate', 'optimize', 'secure', 'scalable', 'distributed',
      'real-time', 'asynchronous', 'concurrent', 'microservice'
    ];
    
    const matchedKeywords = complexityKeywords.filter(keyword => 
      description.toLowerCase().includes(keyword)
    );
    complexity += matchedKeywords.length * 0.5;
    
    // Multiple technologies
    const technologies = this.identifyTechnologies(description);
    if (technologies.length > 2) complexity += 1;
    if (technologies.length > 4) complexity += 1;
    
    return Math.min(complexity, 5);
  }

  private extractActionVerbs(description: string): string[] {
    const actionVerbs = [
      'implement', 'create', 'build', 'develop', 'design', 'optimize',
      'integrate', 'test', 'deploy', 'configure', 'setup', 'analyze',
      'review', 'audit', 'secure', 'monitor', 'document'
    ];
    
    return actionVerbs.filter(verb => 
      description.toLowerCase().includes(verb)
    );
  }

  private identifyTechnologies(description: string): string[] {
    const techKeywords = [
      'react native', 'typescript', 'javascript', 'python', 'node.js',
      'docker', 'kubernetes', 'aws', 'solana', 'ethereum', 'redis',
      'postgresql', 'mongodb', 'graphql', 'rest api', 'websocket'
    ];
    
    return techKeywords.filter(tech => 
      description.toLowerCase().includes(tech.toLowerCase())
    );
  }

  private identifyDeliverables(description: string): string[] {
    const deliverablePatterns = [
      /create.*(?:component|module|service|api)/gi,
      /implement.*(?:feature|functionality|system)/gi,
      /build.*(?:interface|dashboard|tool)/gi,
      /setup.*(?:pipeline|workflow|environment)/gi,
    ];
    
    const deliverables: string[] = [];
    for (const pattern of deliverablePatterns) {
      const matches = description.match(pattern);
      if (matches) {
        deliverables.push(...matches);
      }
    }
    
    return deliverables;
  }

  private extractMainObjective(description: string): string {
    // Extract the first sentence or main clause
    const sentences = description.split(/[.!?]+/);
    return sentences[0].trim();
  }

  private extractConstraints(description: string): string[] {
    const constraintKeywords = ['must', 'should', 'cannot', 'within', 'by', 'using only'];
    const constraints: string[] = [];
    
    for (const keyword of constraintKeywords) {
      const pattern = new RegExp(`${keyword}[^.!?]*`, 'gi');
      const matches = description.match(pattern);
      if (matches) {
        constraints.push(...matches);
      }
    }
    
    return constraints;
  }

  private extractRequirements(description: string): string[] {
    const requirementPatterns = [
      /requires?.*(?:to|that|which)/gi,
      /needs?.*(?:to|that|which)/gi,
      /ensure.*(?:that|to)/gi,
    ];
    
    const requirements: string[] = [];
    for (const pattern of requirementPatterns) {
      const matches = description.match(pattern);
      if (matches) {
        requirements.push(...matches);
      }
    }
    
    return requirements;
  }

  private extractQualityRequirements(description: string): string[] {
    const qualityKeywords = [
      'secure', 'scalable', 'performant', 'maintainable', 'testable',
      'accessible', 'reliable', 'robust', 'efficient'
    ];
    
    return qualityKeywords.filter(quality => 
      description.toLowerCase().includes(quality)
    );
  }

  private matchTaskPatterns(description: string): TaskPattern[] {
    return this.taskPatterns.filter(pattern => 
      pattern.pattern.test(description)
    );
  }

  private selectBestAgent(
    agentTypes: string[], 
    availableAgents: Record<string, AgentInfo>
  ): string | null {
    for (const agentType of agentTypes) {
      if (availableAgents[agentType]) {
        return agentType;
      }
    }
    return null;
  }

  private createSubtaskFromTemplate(
    template: string,
    originalTask: string,
    agentId: string,
    pattern: TaskPattern
  ): SubTask {
    return {
      id: `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: template,
      assignedAgent: agentId,
      estimatedDuration: pattern.complexity * 30, // 30 minutes per complexity point
      dependencies: [],
      priority: 'medium',
      deliverables: [template.toLowerCase().replace(/^(create|implement|setup|analyze)/, '$1d')],
    };
  }

  private generateContextualSubtasks(
    originalTask: string,
    context: any,
    availableAgents: Record<string, AgentInfo>
  ): SubTask[] {
    const contextualTasks: SubTask[] = [];
    
    // Add framework-specific tasks
    if (context.framework === 'react-native' && availableAgents['hardware-integration-specialist']) {
      contextualTasks.push({
        id: `contextual_${Date.now()}_1`,
        description: 'Configure React Native permissions and platform-specific implementations',
        assignedAgent: 'hardware-integration-specialist',
        estimatedDuration: 45,
        dependencies: [],
        priority: 'medium',
        deliverables: ['Platform configuration', 'Permission setup'],
      });
    }
    
    return contextualTasks;
  }

  private ensureCriticalPhases(
    subtasks: SubTask[],
    originalTask: string,
    availableAgents: Record<string, AgentInfo>
  ): void {
    const criticalPhases = ['planning', 'implementation', 'testing', 'deployment'];
    const existingPhases = subtasks.map(st => this.categorizeSubtask(st.description));
    
    for (const phase of criticalPhases) {
      if (!existingPhases.includes(phase)) {
        const agentId = this.selectAgentForPhase(phase, availableAgents);
        if (agentId) {
          subtasks.push({
            id: `critical_${phase}_${Date.now()}`,
            description: `Handle ${phase} phase requirements`,
            assignedAgent: agentId,
            estimatedDuration: 30,
            dependencies: [],
            priority: 'medium',
            deliverables: [`${phase} deliverables`],
          });
        }
      }
    }
  }

  private categorizeSubtask(description: string): string {
    if (/plan|design|architecture/.test(description.toLowerCase())) return 'planning';
    if (/implement|create|build/.test(description.toLowerCase())) return 'implementation';
    if (/test|verify|validate/.test(description.toLowerCase())) return 'testing';
    if (/deploy|setup|configure/.test(description.toLowerCase())) return 'deployment';
    return 'other';
  }

  private selectAgentForPhase(phase: string, availableAgents: Record<string, AgentInfo>): string | null {
    const phaseToAgent = {
      'planning': 'architecture-reviewer',
      'implementation': 'architecture-reviewer',
      'testing': 'test-automation-engineer',
      'deployment': 'devops-integration-engineer',
    };
    
    const preferredAgent = phaseToAgent[phase as keyof typeof phaseToAgent];
    return availableAgents[preferredAgent] ? preferredAgent : Object.keys(availableAgents)[0];
  }

  private prioritizeSubtasks(subtasks: SubTask[]): SubTask[] {
    return subtasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Sort by estimated duration for same priority
      return a.estimatedDuration - b.estimatedDuration;
    });
  }

  private addImplicitDependencies(
    subtasks: SubTask[],
    edges: { from: string; to: string; type: 'blocks' | 'depends_on' | 'parallel' }[]
  ): void {
    // Add dependencies based on common development workflow
    const planningTasks = subtasks.filter(st => /plan|design|architecture/.test(st.description.toLowerCase()));
    const implementationTasks = subtasks.filter(st => /implement|create|build/.test(st.description.toLowerCase()));
    const testingTasks = subtasks.filter(st => /test|verify|validate/.test(st.description.toLowerCase()));
    
    // Planning must come before implementation
    for (const planTask of planningTasks) {
      for (const implTask of implementationTasks) {
        edges.push({ from: planTask.id, to: implTask.id, type: 'blocks' });
      }
    }
    
    // Implementation must come before testing
    for (const implTask of implementationTasks) {
      for (const testTask of testingTasks) {
        edges.push({ from: implTask.id, to: testTask.id, type: 'blocks' });
      }
    }
  }

  private parallelizeIndependentTasks(subtasks: SubTask[]): SubTask[] {
    // Identify tasks that can run in parallel
    const independentTasks = subtasks.filter(st => st.dependencies.length === 0);
    
    // Group related tasks that can be parallelized
    for (const task of independentTasks) {
      if (task.assignedAgent === 'architecture-reviewer') {
        task.priority = 'high'; // Architecture tasks should run first
      }
    }
    
    return subtasks;
  }

  private optimizeDependencyGraph(graph: TaskDependencyGraph): TaskDependencyGraph {
    // Remove redundant dependencies (transitive reduction)
    const optimizedEdges = [...graph.edges];
    
    for (let i = 0; i < optimizedEdges.length; i++) {
      const edge = optimizedEdges[i];
      // Check if there's a path from edge.from to edge.to through other edges
      if (this.hasAlternatePath(edge.from, edge.to, optimizedEdges, edge)) {
        optimizedEdges.splice(i, 1);
        i--;
      }
    }
    
    return {
      ...graph,
      edges: optimizedEdges,
    };
  }

  private hasAlternatePath(
    from: string,
    to: string,
    edges: any[],
    excludeEdge: any
  ): boolean {
    const visited = new Set<string>();
    const queue = [from];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      
      for (const edge of edges) {
        if (edge === excludeEdge) continue;
        if (edge.from === current) {
          if (edge.to === to) return true;
          queue.push(edge.to);
        }
      }
    }
    
    return false;
  }

  private identifySequentialChains(dependencies: TaskDependencyGraph): string[][] {
    const chains: string[][] = [];
    const visited = new Set<string>();
    
    for (const node of dependencies.nodes) {
      if (visited.has(node)) continue;
      
      const chain = this.buildChainFromNode(node, dependencies, visited);
      if (chain.length > 1) {
        chains.push(chain);
      }
    }
    
    return chains;
  }

  private buildChainFromNode(
    startNode: string,
    dependencies: TaskDependencyGraph,
    visited: Set<string>
  ): string[] {
    const chain = [startNode];
    visited.add(startNode);
    
    let currentNode = startNode;
    while (true) {
      const nextEdge = dependencies.edges.find(
        edge => edge.from === currentNode && edge.type === 'blocks'
      );
      
      if (!nextEdge || visited.has(nextEdge.to)) break;
      
      chain.push(nextEdge.to);
      visited.add(nextEdge.to);
      currentNode = nextEdge.to;
    }
    
    return chain;
  }
}