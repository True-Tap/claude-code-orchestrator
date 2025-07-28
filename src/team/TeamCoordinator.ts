/**
 * Team Coordinator
 * 
 * Advanced team workflow management with sophisticated coordination strategies,
 * conflict resolution, and dynamic role assignment for multi-agent collaboration.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
  TeamWorkflow, 
  WorkflowPhase, 
  WorkflowTrigger, 
  AgentSession, 
  AgentTask,
  CoordinationStrategy 
} from '../types';

export interface TeamCoordinationOptions {
  maxConcurrentPhases?: number;
  phaseTimeoutMs?: number;
  conflictResolutionStrategy?: 'vote' | 'priority' | 'expertise' | 'manual';
  communicationProtocol?: 'broadcast' | 'direct' | 'hierarchical';
}

export interface AgentConflict {
  id: string;
  sessionId: string;
  conflictingAgents: string[];
  conflictType: 'resource' | 'decision' | 'dependency' | 'priority';
  description: string;
  possibleResolutions: ConflictResolution[];
  status: 'pending' | 'resolving' | 'resolved' | 'escalated';
  createdAt: Date;
  resolvedAt?: Date;
}

export interface ConflictResolution {
  id: string;
  strategy: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  estimatedTime: number;
  agentVotes?: Record<string, boolean>;
}

export interface AgentCommunication {
  id: string;
  fromAgent: string;
  toAgent: string | 'broadcast';
  type: 'request' | 'response' | 'notification' | 'coordination';
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
}

export interface TeamPerformanceMetrics {
  teamId: string;
  sessionId: string;
  totalAgents: number;
  activePhases: number;
  completedPhases: number;
  failedPhases: number;
  averagePhaseTime: number;
  communicationVolume: number;
  conflictRate: number;
  resolutionTime: number;
  teamEfficiency: number;
}

export class TeamCoordinator extends EventEmitter {
  private workflows: Map<string, TeamWorkflow> = new Map();
  private activePhases: Map<string, WorkflowPhase[]> = new Map();
  private conflicts: Map<string, AgentConflict> = new Map();
  private communications: Map<string, AgentCommunication[]> = new Map();
  private agentWorkloads: Map<string, number> = new Map();
  private expertiseMatrix: Map<string, Record<string, number>> = new Map();
  
  private options: TeamCoordinationOptions;

  constructor(options: TeamCoordinationOptions = {}) {
    super();
    this.options = {
      maxConcurrentPhases: options.maxConcurrentPhases || 3,
      phaseTimeoutMs: options.phaseTimeoutMs || 1800000, // 30 minutes
      conflictResolutionStrategy: options.conflictResolutionStrategy || 'expertise',
      communicationProtocol: options.communicationProtocol || 'direct',
    };
    
    this.initializeExpertiseMatrix();
    this.startConflictMonitoring();
  }

  /**
   * Create and register a new team workflow
   */
  async createWorkflow(workflow: Omit<TeamWorkflow, 'id'>): Promise<string> {
    const workflowId = uuidv4();
    const fullWorkflow: TeamWorkflow = {
      id: workflowId,
      ...workflow,
    };

    this.workflows.set(workflowId, fullWorkflow);
    this.emit('workflowCreated', { workflowId, workflow: fullWorkflow });
    
    return workflowId;
  }

  /**
   * Execute a team workflow for a session
   */
  async executeWorkflow(
    workflowId: string, 
    sessionId: string, 
    context: Record<string, any> = {}
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    this.emit('workflowStarted', { workflowId, sessionId });

    try {
      // Initialize session communications
      this.communications.set(sessionId, []);
      
      // Execute phases based on workflow definition
      await this.executeWorkflowPhases(workflow, sessionId, context);
      
      this.emit('workflowCompleted', { workflowId, sessionId });
    } catch (error) {
      this.emit('workflowFailed', { workflowId, sessionId, error });
      throw error;
    }
  }

  /**
   * Dynamically assign roles based on current workload and expertise
   */
  async assignOptimalRoles(
    sessionId: string, 
    availableAgents: string[], 
    requiredRoles: string[]
  ): Promise<Record<string, string>> {
    const assignments: Record<string, string> = {};
    
    for (const role of requiredRoles) {
      const optimalAgent = await this.findOptimalAgentForRole(role, availableAgents, sessionId);
      if (optimalAgent) {
        assignments[role] = optimalAgent;
        this.updateAgentWorkload(optimalAgent, 1);
      }
    }

    this.emit('rolesAssigned', { sessionId, assignments });
    return assignments;
  }

  /**
   * Handle inter-agent communication
   */
  async sendCommunication(
    sessionId: string,
    fromAgent: string,
    toAgent: string | 'broadcast',
    type: AgentCommunication['type'],
    message: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const communicationId = uuidv4();
    const communication: AgentCommunication = {
      id: communicationId,
      fromAgent,
      toAgent,
      type,
      message,
      metadata,
      timestamp: new Date(),
      acknowledged: false,
    };

    const sessionComms = this.communications.get(sessionId) || [];
    sessionComms.push(communication);
    this.communications.set(sessionId, sessionComms);

    // Route communication based on protocol
    await this.routeCommunication(sessionId, communication);

    this.emit('communicationSent', { sessionId, communication });
    return communicationId;
  }

  /**
   * Detect and resolve conflicts between agents
   */
  async detectConflict(
    sessionId: string,
    conflictType: AgentConflict['conflictType'],
    description: string,
    involvedAgents: string[]
  ): Promise<string> {
    const conflictId = uuidv4();
    const conflict: AgentConflict = {
      id: conflictId,
      sessionId,
      conflictingAgents: involvedAgents,
      conflictType,
      description,
      possibleResolutions: await this.generateResolutionOptions(conflictType, involvedAgents),
      status: 'pending',
      createdAt: new Date(),
    };

    this.conflicts.set(conflictId, conflict);
    this.emit('conflictDetected', { conflictId, conflict });

    // Automatically attempt resolution based on strategy
    await this.attemptConflictResolution(conflictId);

    return conflictId;
  }

  /**
   * Get team performance metrics for a session
   */
  getTeamPerformanceMetrics(sessionId: string): TeamPerformanceMetrics {
    const sessionComms = this.communications.get(sessionId) || [];
    const sessionConflicts = Array.from(this.conflicts.values())
      .filter(c => c.sessionId === sessionId);
    
    const activePhases = this.activePhases.get(sessionId) || [];
    const totalAgents = new Set(sessionComms.map(c => c.fromAgent)).size;

    const resolvedConflicts = sessionConflicts.filter(c => c.status === 'resolved');
    const averageResolutionTime = resolvedConflicts.length > 0 
      ? resolvedConflicts.reduce((sum, c) => {
          return sum + (c.resolvedAt!.getTime() - c.createdAt.getTime());
        }, 0) / resolvedConflicts.length
      : 0;

    return {
      teamId: sessionId,
      sessionId,
      totalAgents,
      activePhases: activePhases.length,
      completedPhases: 0, // Would track this in real implementation
      failedPhases: 0,
      averagePhaseTime: 0,
      communicationVolume: sessionComms.length,
      conflictRate: sessionConflicts.length / Math.max(totalAgents, 1),
      resolutionTime: averageResolutionTime,
      teamEfficiency: this.calculateTeamEfficiency(sessionId),
    };
  }

  /**
   * Optimize team collaboration patterns
   */
  async optimizeCollaboration(sessionId: string): Promise<{
    recommendations: string[];
    estimatedImprovement: number;
  }> {
    const metrics = this.getTeamPerformanceMetrics(sessionId);
    const recommendations: string[] = [];
    let estimatedImprovement = 0;

    // Analyze communication patterns
    const sessionComms = this.communications.get(sessionId) || [];
    const commPattern = this.analyzeCommunicationPatterns(sessionComms);

    if (commPattern.broadcastRatio > 0.7) {
      recommendations.push('Reduce broadcast communications in favor of direct messaging');
      estimatedImprovement += 15;
    }

    if (metrics.conflictRate > 0.3) {
      recommendations.push('Implement proactive conflict prevention measures');
      estimatedImprovement += 25;
    }

    if (metrics.teamEfficiency < 0.7) {
      recommendations.push('Rebalance workload distribution among agents');
      estimatedImprovement += 20;
    }

    // Check for communication bottlenecks
    const communicationHubs = commPattern.hubAgents;
    if (communicationHubs.length > 0) {
      recommendations.push(`Distribute communication load from hub agents: ${communicationHubs.join(', ')}`);
      estimatedImprovement += 10;
    }

    return { recommendations, estimatedImprovement };
  }

  private async executeWorkflowPhases(
    workflow: TeamWorkflow,
    sessionId: string,
    context: Record<string, any>
  ): Promise<void> {
    const phases = [...workflow.phases];
    let currentPhaseIndex = 0;

    while (currentPhaseIndex < phases.length) {
      const phase = phases[currentPhaseIndex];
      
      this.emit('phaseStarted', { workflowId: workflow.id, sessionId, phase });

      try {
        await this.executePhase(phase, sessionId, context);
        this.emit('phaseCompleted', { workflowId: workflow.id, sessionId, phase });
        currentPhaseIndex++;
      } catch (error) {
        this.emit('phaseFailed', { workflowId: workflow.id, sessionId, phase, error });
        
        // Execute failure actions if defined
        await this.executeFailureActions(phase, sessionId, error);
        
        // Determine if we should continue or abort
        const shouldContinue = await this.shouldContinueAfterFailure(phase, error);
        if (!shouldContinue) {
          throw error;
        }
        currentPhaseIndex++;
      }
    }
  }

  private async executePhase(
    phase: WorkflowPhase,
    sessionId: string,
    context: Record<string, any>
  ): Promise<void> {
    // Update active phases
    const activePhasesForSession = this.activePhases.get(sessionId) || [];
    activePhasesForSession.push(phase);
    this.activePhases.set(sessionId, activePhasesForSession);

    try {
      // Coordinate agents for this phase
      await this.coordinatePhaseAgents(phase, sessionId, context);
      
      // Monitor phase progress
      await this.monitorPhaseProgress(phase, sessionId);
      
    } finally {
      // Remove from active phases
      const updatedPhases = activePhasesForSession.filter(p => p.id !== phase.id);
      this.activePhases.set(sessionId, updatedPhases);
    }
  }

  private async coordinatePhaseAgents(
    phase: WorkflowPhase,
    sessionId: string,
    context: Record<string, any>
  ): Promise<void> {
    // Assign tasks to agents based on phase requirements
    const agentAssignments = await this.assignOptimalRoles(
      sessionId,
      phase.agents,
      phase.tasks
    );

    // Coordinate agent interactions
    for (const [task, agent] of Object.entries(agentAssignments)) {
      await this.sendCommunication(
        sessionId,
        'coordinator',
        agent,
        'request',
        `Execute task: ${task}`,
        { phase: phase.id, context }
      );
    }
  }

  private async monitorPhaseProgress(
    phase: WorkflowPhase,
    sessionId: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Phase ${phase.name} timed out`));
      }, this.options.phaseTimeoutMs);

      // Monitor success criteria
      const checkProgress = () => {
        const isComplete = this.checkPhaseCompletion(phase, sessionId);
        if (isComplete) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkProgress, 5000); // Check every 5 seconds
        }
      };

      checkProgress();
    });
  }

  private checkPhaseCompletion(phase: WorkflowPhase, sessionId: string): boolean {
    // Simple implementation - would be more sophisticated in practice
    const sessionComms = this.communications.get(sessionId) || [];
    const phaseComms = sessionComms.filter(c => 
      c.metadata?.phase === phase.id && c.type === 'response'
    );

    return phaseComms.length >= phase.tasks.length;
  }

  private async findOptimalAgentForRole(
    role: string,
    availableAgents: string[],
    sessionId: string
  ): Promise<string | null> {
    let bestAgent: string | null = null;
    let bestScore = -1;

    for (const agent of availableAgents) {
      const workload = this.agentWorkloads.get(agent) || 0;
      const expertise = this.expertiseMatrix.get(agent)?.[role] || 0;
      
      // Score based on expertise and inverse workload
      const score = expertise * (1 / Math.max(workload + 1, 1));
      
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  private updateAgentWorkload(agentId: string, delta: number): void {
    const currentWorkload = this.agentWorkloads.get(agentId) || 0;
    this.agentWorkloads.set(agentId, Math.max(0, currentWorkload + delta));
  }

  private async routeCommunication(
    sessionId: string,
    communication: AgentCommunication
  ): Promise<void> {
    switch (this.options.communicationProtocol) {
      case 'broadcast':
        if (communication.toAgent === 'broadcast') {
          this.emit('broadcastMessage', { sessionId, communication });
        } else {
          this.emit('directMessage', { sessionId, communication });
        }
        break;
      
      case 'direct':
        this.emit('directMessage', { sessionId, communication });
        break;
      
      case 'hierarchical':
        await this.routeHierarchicalCommunication(sessionId, communication);
        break;
    }
  }

  private async routeHierarchicalCommunication(
    sessionId: string,
    communication: AgentCommunication
  ): Promise<void> {
    // Simple hierarchy: coordinator -> team leads -> team members
    if (communication.fromAgent === 'coordinator') {
      this.emit('directMessage', { sessionId, communication });
    } else {
      // Route through coordinator
      const routedComm: AgentCommunication = {
        ...communication,
        metadata: { ...communication.metadata, originalTo: communication.toAgent },
        toAgent: 'coordinator',
      };
      this.emit('directMessage', { sessionId, communication: routedComm });
    }
  }

  private async generateResolutionOptions(
    conflictType: AgentConflict['conflictType'],
    involvedAgents: string[]
  ): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    switch (conflictType) {
      case 'resource':
        resolutions.push({
          id: uuidv4(),
          strategy: 'time_sharing',
          description: 'Implement time-based resource sharing between agents',
          impact: 'low',
          estimatedTime: 5,
        });
        resolutions.push({
          id: uuidv4(),
          strategy: 'priority_based',
          description: 'Allocate resource to highest priority agent',
          impact: 'medium',
          estimatedTime: 2,
        });
        break;

      case 'decision':
        resolutions.push({
          id: uuidv4(),
          strategy: 'voting',
          description: 'Hold a vote among involved agents',
          impact: 'low',
          estimatedTime: 10,
        });
        resolutions.push({
          id: uuidv4(),
          strategy: 'expertise_based',
          description: 'Defer to agent with highest expertise in this domain',
          impact: 'medium',
          estimatedTime: 3,
        });
        break;

      case 'dependency':
        resolutions.push({
          id: uuidv4(),
          strategy: 'reorder_tasks',
          description: 'Reorder tasks to resolve dependency conflicts',
          impact: 'high',
          estimatedTime: 15,
        });
        break;

      case 'priority':
        resolutions.push({
          id: uuidv4(),
          strategy: 'escalate',
          description: 'Escalate priority conflict to human supervisor',
          impact: 'high',
          estimatedTime: 30,
        });
        break;
    }

    return resolutions;
  }

  private async attemptConflictResolution(conflictId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return;

    conflict.status = 'resolving';
    this.emit('conflictResolving', { conflictId, conflict });

    try {
      const resolution = await this.selectBestResolution(conflict);
      await this.executeResolution(conflict, resolution);
      
      conflict.status = 'resolved';
      conflict.resolvedAt = new Date();
      this.emit('conflictResolved', { conflictId, conflict, resolution });
    } catch (error) {
      conflict.status = 'escalated';
      this.emit('conflictEscalated', { conflictId, conflict, error });
    }
  }

  private async selectBestResolution(conflict: AgentConflict): Promise<ConflictResolution> {
    const { conflictResolutionStrategy } = this.options;
    
    switch (conflictResolutionStrategy) {
      case 'vote':
        return await this.selectResolutionByVote(conflict);
      case 'priority':
        return conflict.possibleResolutions.reduce((best, current) => 
          current.impact === 'low' ? current : best
        );
      case 'expertise':
        return await this.selectResolutionByExpertise(conflict);
      case 'manual':
        throw new Error('Manual resolution required');
      default:
        return conflict.possibleResolutions[0];
    }
  }

  private async selectResolutionByVote(conflict: AgentConflict): Promise<ConflictResolution> {
    // Simulate voting process
    for (const resolution of conflict.possibleResolutions) {
      resolution.agentVotes = {};
      for (const agent of conflict.conflictingAgents) {
        // Simplified voting logic
        resolution.agentVotes[agent] = Math.random() > 0.5;
      }
    }

    return conflict.possibleResolutions.reduce((best, current) => {
      const bestVotes = Object.values(best.agentVotes || {}).filter(v => v).length;
      const currentVotes = Object.values(current.agentVotes || {}).filter(v => v).length;
      return currentVotes > bestVotes ? current : best;
    });
  }

  private async selectResolutionByExpertise(conflict: AgentConflict): Promise<ConflictResolution> {
    // Find agent with highest expertise in conflict domain
    let expertAgent = conflict.conflictingAgents[0];
    let maxExpertise = 0;

    for (const agent of conflict.conflictingAgents) {
      const agentExpertise = this.expertiseMatrix.get(agent);
      if (agentExpertise) {
        const relevantExpertise = Object.values(agentExpertise).reduce((a, b) => a + b, 0);
        if (relevantExpertise > maxExpertise) {
          maxExpertise = relevantExpertise;
          expertAgent = agent;
        }
      }
    }

    // Return resolution favored by expert agent
    return conflict.possibleResolutions[0]; // Simplified
  }

  private async executeResolution(
    conflict: AgentConflict,
    resolution: ConflictResolution
  ): Promise<void> {
    // Implement resolution logic based on strategy
    switch (resolution.strategy) {
      case 'time_sharing':
        await this.implementTimeSharing(conflict.conflictingAgents);
        break;
      case 'priority_based':
        await this.implementPriorityAllocation(conflict.conflictingAgents);
        break;
      case 'reorder_tasks':
        await this.reorderConflictingTasks(conflict);
        break;
      default:
        // Generic resolution
        break;
    }
  }

  private async implementTimeSharing(agents: string[]): Promise<void> {
    // Implement time-based resource sharing
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const timeSlot = i * 1000; // 1 second intervals
      setTimeout(() => {
        this.emit('resourceAllocated', { agent, duration: 1000 });
      }, timeSlot);
    }
  }

  private async implementPriorityAllocation(agents: string[]): Promise<void> {
    // Allocate to highest priority agent (first in list)
    const priorityAgent = agents[0];
    this.emit('resourceAllocated', { agent: priorityAgent, exclusive: true });
  }

  private async reorderConflictingTasks(conflict: AgentConflict): Promise<void> {
    // Emit task reordering event
    this.emit('tasksReordered', { 
      sessionId: conflict.sessionId, 
      agents: conflict.conflictingAgents 
    });
  }

  private async executeFailureActions(
    phase: WorkflowPhase,
    sessionId: string,
    error: any
  ): Promise<void> {
    for (const action of phase.failureActions) {
      try {
        await this.executeAction(action, sessionId, { error, phase });
      } catch (actionError) {
        this.emit('failureActionFailed', { 
          sessionId, 
          phase, 
          action, 
          error: actionError 
        });
      }
    }
  }

  private async executeAction(
    action: string,
    sessionId: string,
    context: Record<string, any>
  ): Promise<void> {
    // Simple action execution - would be more sophisticated
    switch (action) {
      case 'retry':
        this.emit('retryRequested', { sessionId, context });
        break;
      case 'rollback':
        this.emit('rollbackRequested', { sessionId, context });
        break;
      case 'escalate':
        this.emit('escalationRequested', { sessionId, context });
        break;
      default:
        this.emit('customAction', { sessionId, action, context });
    }
  }

  private async shouldContinueAfterFailure(
    phase: WorkflowPhase,
    error: any
  ): Promise<boolean> {
    // Determine if workflow should continue after phase failure
    return phase.failureActions.includes('continue') || 
           phase.failureActions.includes('retry');
  }

  private calculateTeamEfficiency(sessionId: string): number {
    const metrics = this.getBasicMetrics(sessionId);
    
    // Simple efficiency calculation with safe defaults
    const conflictPenalty = (metrics.conflictRate || 0) * 0.3;
    const communicationEfficiency = Math.min((metrics.communicationVolume || 0) / Math.max(metrics.totalAgents || 1, 1), 1);
    
    return Math.max(0, communicationEfficiency - conflictPenalty);
  }

  private getBasicMetrics(sessionId: string): Partial<TeamPerformanceMetrics> {
    const sessionComms = this.communications.get(sessionId) || [];
    const sessionConflicts = Array.from(this.conflicts.values())
      .filter(c => c.sessionId === sessionId);
    
    const totalAgents = new Set(sessionComms.map(c => c.fromAgent)).size;

    return {
      totalAgents,
      communicationVolume: sessionComms.length,
      conflictRate: sessionConflicts.length / Math.max(totalAgents, 1),
    };
  }

  private analyzeCommunicationPatterns(communications: AgentCommunication[]): {
    broadcastRatio: number;
    hubAgents: string[];
    averageResponseTime: number;
  } {
    const broadcastCount = communications.filter(c => c.toAgent === 'broadcast').length;
    const broadcastRatio = broadcastCount / Math.max(communications.length, 1);

    // Find hub agents (agents with high communication volume)
    const agentCommCounts = new Map<string, number>();
    communications.forEach(c => {
      agentCommCounts.set(c.fromAgent, (agentCommCounts.get(c.fromAgent) || 0) + 1);
    });

    const avgCommCount = Array.from(agentCommCounts.values()).reduce((a, b) => a + b, 0) / agentCommCounts.size;
    const hubAgents = Array.from(agentCommCounts.entries())
      .filter(([_, count]) => count > avgCommCount * 1.5)
      .map(([agent, _]) => agent);

    return {
      broadcastRatio,
      hubAgents,
      averageResponseTime: 0, // Would calculate from actual response times
    };
  }

  private initializeExpertiseMatrix(): void {
    // Initialize expertise matrix for different agents
    const agentExpertise = {
      'architecture-reviewer': { architecture: 0.9, review: 0.85, patterns: 0.8 },
      'test-automation-engineer': { testing: 0.95, automation: 0.9, quality: 0.8 },
      'security-audit-specialist': { security: 0.95, audit: 0.9, crypto: 0.85 },
      'hardware-integration-specialist': { hardware: 0.9, ble: 0.85, nfc: 0.8 },
      'solana-mobile-expert': { blockchain: 0.95, solana: 0.95, mobile: 0.8 },
      'performance-optimizer': { performance: 0.9, optimization: 0.85, profiling: 0.8 },
      'ux-accessibility-expert': { ux: 0.9, accessibility: 0.95, design: 0.8 },
      'devops-integration-engineer': { devops: 0.9, deployment: 0.85, ci_cd: 0.8 },
    };

    for (const [agent, expertise] of Object.entries(agentExpertise)) {
      this.expertiseMatrix.set(agent, expertise);
    }
  }

  private startConflictMonitoring(): void {
    // Start background conflict monitoring
    setInterval(() => {
      this.monitorForConflicts();
    }, 10000); // Check every 10 seconds
  }

  private monitorForConflicts(): void {
    // Monitor for potential conflicts in active sessions
    for (const [sessionId, communications] of this.communications) {
      const recentComms = communications.filter(c => 
        Date.now() - c.timestamp.getTime() < 60000 // Last minute
      );

      // Check for communication bottlenecks
      const bottlenecks = this.detectCommunicationBottlenecks(recentComms);
      if (bottlenecks.length > 0) {
        this.emit('potentialConflictDetected', {
          sessionId,
          type: 'communication_bottleneck',
          agents: bottlenecks,
        });
      }
    }
  }

  private detectCommunicationBottlenecks(communications: AgentCommunication[]): string[] {
    const agentCommCounts = new Map<string, number>();
    
    communications.forEach(c => {
      if (c.toAgent !== 'broadcast') {
        agentCommCounts.set(c.toAgent, (agentCommCounts.get(c.toAgent) || 0) + 1);
      }
    });

    const avgCount = Array.from(agentCommCounts.values()).reduce((a, b) => a + b, 0) / agentCommCounts.size;
    
    return Array.from(agentCommCounts.entries())
      .filter(([_, count]) => count > avgCount * 2)
      .map(([agent, _]) => agent);
  }
}