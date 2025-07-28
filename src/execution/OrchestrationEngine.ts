/**
 * Orchestration Engine
 * 
 * Core engine for coordinating multiple Claude Code agents asynchronously.
 * Manages execution strategies, agent communication, and task coordination.
 */

import { EventEmitter } from 'events';
import { ClaudeCodeRunner } from './ClaudeCodeRunner';
import { AgentSessionManager } from './AgentSessionManager';
import { TaskQueue } from './TaskQueue';
import { AdvancedCoordinationStrategies, StrategyContext } from '../coordination/AdvancedCoordinationStrategies';
import { 
  AgentSession, 
  CoordinationStrategy, 
  OrchestrationPlan, 
  AgentTask, 
  ExecutionResult,
  TaskResult,
  OrchestrationResult,
  ExecutionMetrics,
} from '../types';

export interface OrchestrationOptions {
  maxConcurrentAgents?: number;
  taskTimeoutMs?: number;
  retryAttempts?: number;
  claudeCodePath?: string;
  workspaceRoot?: string;
}

export interface ExecutionProgress {
  sessionId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeAgents: string[];
  currentPhase: string;
  estimatedCompletion?: Date;
}

export class OrchestrationEngine extends EventEmitter {
  private runner: ClaudeCodeRunner;
  private sessionManager: AgentSessionManager;
  private taskQueue: TaskQueue;
  private advancedStrategies: AdvancedCoordinationStrategies;
  private activeSessions: Map<string, AgentSession> = new Map();
  private executionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private performanceHistory: Map<string, ExecutionMetrics[]> = new Map();

  constructor(options: OrchestrationOptions = {}) {
    super();
    
    this.runner = new ClaudeCodeRunner({
      maxInstances: options.maxConcurrentAgents || 5,
      claudeCodePath: options.claudeCodePath,
      baseWorkingDirectory: options.workspaceRoot,
    });
    
    this.sessionManager = new AgentSessionManager({
      workspaceRoot: options.workspaceRoot,
    });
    
    this.taskQueue = new TaskQueue({
      maxConcurrentTasks: options.maxConcurrentAgents || 3,
      taskTimeoutMs: options.taskTimeoutMs || 300000,
      defaultMaxRetries: options.retryAttempts || 2,
    });

    this.advancedStrategies = new AdvancedCoordinationStrategies();

    this.setupEventHandlers();
  }

  /**
   * Execute an orchestration plan
   */
  async executeOrchestration(plan: OrchestrationPlan): Promise<string> {
    // Create session
    const sessionId = await this.sessionManager.createSession({
      task: plan.task,
      agents: plan.suggestedAgents,
      coordinationStrategy: plan.coordinationStrategy,
    });

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Failed to create session for plan: ${plan.task}`);
    }

    this.activeSessions.set(sessionId, session);

    try {
      // Initialize Claude Code instances for each agent
      await this.initializeAgentInstances(sessionId, plan.suggestedAgents);

      // Decompose plan into tasks
      const tasks = await this.decomposePlanIntoTasks(sessionId, plan);

      // Execute based on coordination strategy
      await this.executeWithStrategy(sessionId, plan.coordinationStrategy, tasks);

      this.emit('orchestrationStarted', { sessionId, plan });
      return sessionId;
    } catch (error) {
      await this.sessionManager.updateSessionStatus(sessionId, 'failed');
      this.activeSessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * Get execution progress for a session
   */
  getExecutionProgress(sessionId: string): ExecutionProgress | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    const completedTasks = sessionTasks.filter(t => t.status === 'completed').length;
    const failedTasks = sessionTasks.filter(t => t.status === 'failed').length;
    const activeAgents = sessionTasks
      .filter(t => t.status === 'in_progress')
      .map(t => t.agentId);

    return {
      sessionId,
      totalTasks: sessionTasks.length,
      completedTasks,
      failedTasks,
      activeAgents: [...new Set(activeAgents)],
      currentPhase: session.state.currentPhase,
      estimatedCompletion: this.estimateCompletion(sessionTasks),
    };
  }

  /**
   * Cancel an active orchestration
   */
  async cancelOrchestration(sessionId: string, reason?: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or not active`);
    }

    // Cancel all pending tasks for this session
    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    for (const task of sessionTasks) {
      if (task.status === 'pending' || task.status === 'in_progress') {
        this.taskQueue.cancelTask(task.id, reason);
      }
    }

    // Clean up session
    await this.sessionManager.updateSessionStatus(sessionId, 'failed');
    await this.cleanupSession(sessionId);

    this.emit('orchestrationCancelled', { sessionId, reason });
  }

  /**
   * Get all active orchestrations
   */
  getActiveOrchestrations(): ExecutionProgress[] {
    return Array.from(this.activeSessions.keys())
      .map(sessionId => this.getExecutionProgress(sessionId))
      .filter((progress): progress is ExecutionProgress => progress !== null);
  }

  /**
   * Get orchestration results
   */
  async getOrchestrationResults(sessionId: string): Promise<OrchestrationResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        action: 'get_results',
        error: `Session ${sessionId} not found`,
      };
    }

    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    const completedTasks = sessionTasks.filter(t => t.status === 'completed');
    const failedTasks = sessionTasks.filter(t => t.status === 'failed');

    const success = failedTasks.length === 0 && completedTasks.length === sessionTasks.length;

    return {
      success,
      action: 'orchestration_complete',
      status: {
        activeSessions: this.activeSessions.size,
        activeWorktrees: session.worktrees.filter(wt => wt.status === 'active').map(wt => wt.path),
        lastExecution: session.endTime?.toISOString() || new Date().toISOString(),
        orchestratorHealth: 'healthy',
      },
      nextSteps: success 
        ? ['Review generated code', 'Run tests', 'Deploy changes']
        : ['Check failed tasks', 'Retry failed operations', 'Review error logs'],
    };
  }

  /**
   * Shutdown the orchestration engine
   */
  async shutdown(): Promise<void> {
    // Cancel all active orchestrations
    for (const sessionId of this.activeSessions.keys()) {
      await this.cancelOrchestration(sessionId, 'Engine shutdown');
    }

    // Stop all intervals
    for (const interval of this.executionIntervals.values()) {
      clearInterval(interval);
    }
    this.executionIntervals.clear();

    // Shutdown components
    this.taskQueue.shutdown();
    await this.runner.terminateAll();

    this.emit('engineShutdown');
  }

  private async initializeAgentInstances(sessionId: string, agents: string[]): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    for (const agentId of agents) {
      try {
        const worktree = this.sessionManager.getAgentWorktree(sessionId, agentId);
        if (!worktree) {
          throw new Error(`No worktree found for agent ${agentId}`);
        }

        await this.runner.createInstance(agentId, {
          workingDirectory: worktree.path,
          agentSpecialization: agentId,
        });

        this.emit('agentInstanceInitialized', { sessionId, agentId });
      } catch (error) {
        this.emit('agentInstanceError', { sessionId, agentId, error });
        throw new Error(`Failed to initialize agent ${agentId}: ${error}`);
      }
    }
  }

  private async decomposePlanIntoTasks(sessionId: string, plan: OrchestrationPlan): Promise<string[]> {
    const taskIds: string[] = [];

    // Create tasks for each phase of the plan
    for (const phase of plan.phases) {
      for (const agentId of phase.agents) {
        const agentPlan = plan.agents.find(a => a.id === agentId);
        if (!agentPlan) continue;

        for (const deliverable of agentPlan.deliverables) {
          const result = this.taskQueue.addTask(
            sessionId,
            agentId,
            `${phase.name}: ${deliverable}`,
            {
              priority: 'high',
              dependencies: this.getDependenciesForTask(phase.name, plan.dependencies),
            }
          );
          taskIds.push(result.taskId);
        }
      }
    }

    return taskIds;
  }

  private async executeWithStrategy(
    sessionId: string,
    strategy: CoordinationStrategy,
    taskIds: string[]
  ): Promise<void> {
    await this.sessionManager.updateSessionStatus(sessionId, 'executing');

    // Check if we should use an advanced strategy
    if (['adaptive', 'consensus', 'pipeline', 'recovery'].includes(strategy)) {
      await this.executeAdvancedStrategy(sessionId, strategy);
    } else {
      // Use traditional strategies
      switch (strategy) {
        case 'parallel':
          await this.executeParallel(sessionId);
          break;
        case 'sequential':
          await this.executeSequential(sessionId);
          break;
        case 'phased_parallel':
          await this.executePhasedParallel(sessionId);
          break;
        default:
          throw new Error(`Unknown coordination strategy: ${strategy}`);
      }
    }
  }

  private async executeParallel(sessionId: string): Promise<void> {
    const interval = setInterval(async () => {
      await this.processSessionTasks(sessionId);
    }, 2000);

    this.executionIntervals.set(sessionId, interval);
  }

  private async executeSequential(sessionId: string): Promise<void> {
    const interval = setInterval(async () => {
      const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
      const inProgress = sessionTasks.filter(t => t.status === 'in_progress');
      
      // Only process one task at a time for sequential execution
      if (inProgress.length === 0) {
        await this.processSessionTasks(sessionId, 1);
      }
    }, 2000);

    this.executionIntervals.set(sessionId, interval);
  }

  private async executePhasedParallel(sessionId: string): Promise<void> {
    const interval = setInterval(async () => {
      await this.processSessionTasks(sessionId);
    }, 2000);

    this.executionIntervals.set(sessionId, interval);
  }

  private async executeAdvancedStrategy(sessionId: string, strategy: CoordinationStrategy): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    
    // Create strategy context
    const context: StrategyContext = {
      sessionId,
      tasks: sessionTasks,
      agents: session.agents,
      currentPhase: session.state.currentPhase,
      performanceHistory: this.performanceHistory,
      errors: this.getSessionErrors(sessionId),
      progress: this.calculateSessionProgress(sessionTasks),
      timeElapsed: Date.now() - session.startTime.getTime(),
      estimatedTimeRemaining: this.estimateRemainingTime(sessionTasks),
    };

    // Execute the advanced strategy
    switch (strategy) {
      case 'adaptive':
        await this.advancedStrategies.executeAdaptiveStrategy(context);
        break;
      case 'consensus':
        await this.advancedStrategies.executeConsensusStrategy(context);
        break;
      case 'pipeline':
        await this.advancedStrategies.executePipelineStrategy(context);
        break;
      case 'recovery':
        await this.advancedStrategies.executeRecoveryStrategy(context);
        break;
      default:
        throw new Error(`Unsupported advanced strategy: ${strategy}`);
    }

    // Set up interval for task processing (advanced strategies handle their own coordination)
    const interval = setInterval(async () => {
      await this.processSessionTasks(sessionId);
    }, 2000);

    this.executionIntervals.set(sessionId, interval);
  }

  private async processSessionTasks(sessionId: string, maxConcurrent?: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    let processedCount = 0;
    const limit = maxConcurrent || 3;

    for (const agentId of session.agents) {
      if (processedCount >= limit) break;

      const nextTask = this.taskQueue.getNextTask(agentId);
      if (nextTask) {
        await this.executeTask(nextTask);
        processedCount++;
      }
    }

    // Check if session is complete
    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    const pendingTasks = sessionTasks.filter(t => 
      t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked'
    );

    if (pendingTasks.length === 0) {
      await this.completeSession(sessionId);
    }
  }

  private async executeTask(task: AgentTask): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.emit('taskStarted', { task });

      const instanceId = await this.runner.getAvailableInstance(task.agentId);
      const executionResult = await this.runner.executeTask(instanceId, task.description, {
        timeout: 300000, // 5 minutes
      });

      const taskResult: TaskResult = {
        success: executionResult.success,
        output: executionResult.output,
        error: executionResult.error,
        metadata: {
          instanceId: executionResult.instanceId,
          executionTime: executionResult.executionTime,
        },
      };

      // Record performance metrics for advanced strategies
      this.recordTaskMetrics(task, startTime, executionResult.success);

      this.taskQueue.completeTask(task.id, taskResult);
      this.emit('taskCompleted', { task, result: taskResult });
    } catch (error) {
      const taskResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      // Record failure metrics
      this.recordTaskMetrics(task, startTime, false);

      this.taskQueue.completeTask(task.id, taskResult);
      this.emit('taskFailed', { task, error });
    }
  }

  private async completeSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Stop processing interval
    const interval = this.executionIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.executionIntervals.delete(sessionId);
    }

    // Determine session outcome
    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    const failedTasks = sessionTasks.filter(t => t.status === 'failed');
    const success = failedTasks.length === 0;

    // Update session status
    await this.sessionManager.updateSessionStatus(
      sessionId, 
      success ? 'completed' : 'failed'
    );

    // Merge successful agent changes
    if (success) {
      for (const agentId of session.agents) {
        try {
          await this.sessionManager.mergeAgentChanges(sessionId, agentId);
        } catch (error) {
          console.warn(`Failed to merge changes from agent ${agentId}:`, error);
        }
      }
    }

    // Clean up
    await this.cleanupSession(sessionId);

    this.emit('sessionCompleted', { sessionId, success, failedTasks: failedTasks.length });
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    
    // Clean up resources after a delay to allow for result retrieval
    setTimeout(async () => {
      await this.sessionManager.cleanupSession(sessionId);
    }, 60000); // 1 minute delay
  }

  private getDependenciesForTask(phaseName: string, planDependencies: any[]): string[] {
    // This would be enhanced to properly map phase dependencies to task dependencies
    return [];
  }

  private estimateCompletion(tasks: AgentTask[]): Date | undefined {
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    
    if (inProgressTasks.length === 0 && pendingTasks.length === 0) {
      return new Date(); // Already complete
    }

    // Simple estimation: assume 5 minutes per task
    const estimatedMinutes = (inProgressTasks.length + pendingTasks.length) * 5;
    return new Date(Date.now() + estimatedMinutes * 60000);
  }

  private setupEventHandlers(): void {
    // Task queue events
    this.taskQueue.on('taskCompleted', (event) => {
      this.emit('taskProgress', event);
    });

    this.taskQueue.on('taskFailed', (event) => {
      this.emit('taskError', event);
    });

    // Session manager events
    this.sessionManager.on('sessionStatusChanged', (event) => {
      this.emit('sessionStatusChanged', event);
    });

    // Runner events
    this.runner.on('instanceError', (event) => {
      this.emit('agentError', event);
    });

    // Advanced strategy events
    this.advancedStrategies.on('strategyStarted', (event) => {
      this.emit('strategyStarted', event);
    });

    this.advancedStrategies.on('strategyChange', (event) => {
      this.emit('strategyChange', event);
    });

    this.advancedStrategies.on('consensusFailure', (event) => {
      this.emit('consensusFailure', event);
    });

    this.advancedStrategies.on('recoveryPlanGenerated', (event) => {
      this.emit('recoveryPlanGenerated', event);
    });
  }

  /**
   * Helper methods for advanced strategies
   */
  private getSessionErrors(sessionId: string): string[] {
    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    return sessionTasks
      .filter(task => task.status === 'failed' && task.result?.error)
      .map(task => task.result!.error!);
  }

  private calculateSessionProgress(tasks: AgentTask[]): number {
    if (tasks.length === 0) return 0;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    return completedTasks / tasks.length;
  }

  private estimateRemainingTime(tasks: AgentTask[]): number {
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    return pendingTasks * 5 * 60000; // 5 minutes per task estimate
  }

  private recordTaskMetrics(task: AgentTask, startTime: number, success: boolean): void {
    const executionTime = Date.now() - startTime;
    
    const metrics: ExecutionMetrics = {
      sessionId: task.sessionId,
      agentId: task.agentId,
      timestamp: new Date(),
      cpuUsage: Math.random() * 100, // Simplified - would get actual CPU usage
      memoryUsage: Math.random() * 100, // Simplified - would get actual memory usage
      taskQueue: this.taskQueue.getQueueSize(task.agentId),
      responseTime: executionTime,
      errorRate: success ? 0 : 1,
    };

    const agentMetrics = this.performanceHistory.get(task.agentId) || [];
    agentMetrics.push(metrics);
    
    // Keep only last 100 metrics per agent
    if (agentMetrics.length > 100) {
      agentMetrics.shift();
    }
    
    this.performanceHistory.set(task.agentId, agentMetrics);
  }

  /**
   * Get optimal strategy recommendation for a session
   */
  getOptimalStrategy(sessionId: string): CoordinationStrategy {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return 'parallel'; // Default fallback
    }

    const sessionTasks = this.taskQueue.getSessionTasks(sessionId);
    
    const context: StrategyContext = {
      sessionId,
      tasks: sessionTasks,
      agents: session.agents,
      currentPhase: session.state.currentPhase,
      performanceHistory: this.performanceHistory,
      errors: this.getSessionErrors(sessionId),
      progress: this.calculateSessionProgress(sessionTasks),
      timeElapsed: Date.now() - session.startTime.getTime(),
      estimatedTimeRemaining: this.estimateRemainingTime(sessionTasks),
    };

    const decision = this.advancedStrategies.selectOptimalStrategy(context);
    return decision.strategy;
  }

  /**
   * Get performance analytics for the orchestration engine
   */
  getPerformanceAnalytics(): {
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
    successRate: number;
    topPerformingAgents: string[];
  } {
    const totalSessions = this.activeSessions.size;
    const activeSessions = Array.from(this.activeSessions.values())
      .filter(s => s.status === 'executing').length;

    // Calculate success rate from completed sessions
    let successfulSessions = 0;
    let completedSessions = 0;
    
    for (const session of this.activeSessions.values()) {
      if (session.status === 'completed' || session.status === 'failed') {
        completedSessions++;
        if (session.status === 'completed') {
          successfulSessions++;
        }
      }
    }

    const successRate = completedSessions > 0 ? successfulSessions / completedSessions : 0;

    // Get top performing agents based on metrics
    const agentPerformance = new Map<string, number>();
    for (const [agentId, metrics] of this.performanceHistory) {
      const recentMetrics = metrics.slice(-10); // Last 10 metrics
      const avgSuccessRate = recentMetrics.reduce((sum, m) => sum + (1 - m.errorRate), 0) / recentMetrics.length;
      agentPerformance.set(agentId, avgSuccessRate);
    }

    const topPerformingAgents = Array.from(agentPerformance.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([agentId]) => agentId);

    return {
      totalSessions,
      activeSessions,
      averageSessionDuration: 300000, // Simplified calculation
      successRate,
      topPerformingAgents,
    };
  }
}