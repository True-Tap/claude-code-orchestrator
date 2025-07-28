/**
 * Task Queue Manager
 * 
 * Manages task queuing, scheduling, and execution for multi-agent coordination.
 * Handles priority-based scheduling, dependency resolution, and retry logic.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentTask, TaskResult } from '../types';

export interface QueueOptions {
  maxConcurrentTasks?: number;
  defaultMaxRetries?: number;
  retryDelayMs?: number;
  taskTimeoutMs?: number;
}

export interface TaskSchedulingResult {
  taskId: string;
  estimatedStartTime: Date;
  queuePosition: number;
}

export class TaskQueue extends EventEmitter {
  private tasks: Map<string, AgentTask> = new Map();
  private pendingTasks: string[] = [];
  private inProgressTasks: Set<string> = new Set();
  private completedTasks: Set<string> = new Set();
  private failedTasks: Set<string> = new Set();
  private blockedTasks: Set<string> = new Set();
  
  private maxConcurrentTasks: number;
  private defaultMaxRetries: number;
  private retryDelayMs: number;
  private taskTimeoutMs: number;
  
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(options: QueueOptions = {}) {
    super();
    this.maxConcurrentTasks = options.maxConcurrentTasks || 3;
    this.defaultMaxRetries = options.defaultMaxRetries || 2;
    this.retryDelayMs = options.retryDelayMs || 5000;
    this.taskTimeoutMs = options.taskTimeoutMs || 300000; // 5 minutes
    
    this.startProcessing();
  }

  /**
   * Add a new task to the queue
   */
  addTask(
    sessionId: string,
    agentId: string,
    description: string,
    options: {
      priority?: 'high' | 'medium' | 'low';
      dependencies?: string[];
      maxRetries?: number;
    } = {}
  ): TaskSchedulingResult {
    const taskId = uuidv4();
    const task: AgentTask = {
      id: taskId,
      sessionId,
      agentId,
      description,
      priority: options.priority || 'medium',
      dependencies: options.dependencies || [],
      status: 'pending',
      assignedAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.defaultMaxRetries,
    };

    this.tasks.set(taskId, task);
    this.insertTaskInQueue(taskId);

    const queuePosition = this.pendingTasks.indexOf(taskId) + 1;
    const estimatedStartTime = this.estimateStartTime(queuePosition);

    this.emit('taskAdded', { taskId, task });
    
    return {
      taskId,
      estimatedStartTime,
      queuePosition,
    };
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: AgentTask['status']): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const previousStatus = task.status;
    task.status = status;

    // Update internal tracking sets
    this.removeFromAllSets(taskId);
    
    switch (status) {
      case 'pending':
        if (!this.pendingTasks.includes(taskId)) {
          this.insertTaskInQueue(taskId);
        }
        break;
      case 'in_progress':
        this.inProgressTasks.add(taskId);
        task.startedAt = new Date();
        break;
      case 'completed':
        this.completedTasks.add(taskId);
        task.completedAt = new Date();
        break;
      case 'failed':
        this.failedTasks.add(taskId);
        task.completedAt = new Date();
        break;
      case 'blocked':
        this.blockedTasks.add(taskId);
        break;
    }

    this.emit('taskStatusChanged', { taskId, previousStatus, newStatus: status });
  }

  /**
   * Complete a task with result
   */
  completeTask(taskId: string, result: TaskResult): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.result = result;
    
    if (result.success) {
      this.updateTaskStatus(taskId, 'completed');
      this.unblockDependentTasks(taskId);
    } else {
      this.handleTaskFailure(taskId);
    }

    this.emit('taskCompleted', { taskId, task, result });
  }

  /**
   * Get next task for execution
   */
  getNextTask(agentId?: string): AgentTask | null {
    if (this.inProgressTasks.size >= this.maxConcurrentTasks) {
      return null;
    }

    // Find the highest priority task that can be executed
    for (const taskId of this.pendingTasks) {
      const task = this.tasks.get(taskId);
      if (!task) continue;
      
      // Check agent match if specified
      if (agentId && task.agentId !== agentId) {
        continue;
      }

      // Check if dependencies are satisfied
      if (this.areDependenciesSatisfied(task)) {
        this.updateTaskStatus(taskId, 'in_progress');
        return task;
      } else {
        // Move to blocked if dependencies aren't ready
        this.updateTaskStatus(taskId, 'blocked');
      }
    }

    return null;
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: AgentTask['status']): AgentTask[] {
    const taskIds = this.getTaskIdsByStatus(status);
    return taskIds.map(id => this.tasks.get(id)!).filter(Boolean);
  }

  /**
   * Get tasks for a specific session
   */
  getSessionTasks(sessionId: string): AgentTask[] {
    return Array.from(this.tasks.values()).filter(task => task.sessionId === sessionId);
  }

  /**
   * Get tasks for a specific agent
   */
  getAgentTasks(agentId: string): AgentTask[] {
    return Array.from(this.tasks.values()).filter(task => task.agentId === agentId);
  }

  /**
   * Get queue size for a specific agent
   */
  getQueueSize(agentId: string): number {
    return this.getAgentTasks(agentId).filter(task => 
      task.status === 'pending' || task.status === 'in_progress'
    ).length;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    completedTasks: number;
    failedTasks: number;
    blockedTasks: number;
    averageWaitTime: number;
    averageExecutionTime: number;
  } {
    const completedTaskList = this.getTasksByStatus('completed');
    const averageWaitTime = this.calculateAverageWaitTime(completedTaskList);
    const averageExecutionTime = this.calculateAverageExecutionTime(completedTaskList);

    return {
      totalTasks: this.tasks.size,
      pendingTasks: this.pendingTasks.length,
      inProgressTasks: this.inProgressTasks.size,
      completedTasks: this.completedTasks.size,
      failedTasks: this.failedTasks.size,
      blockedTasks: this.blockedTasks.size,
      averageWaitTime,
      averageExecutionTime,
    };
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string, reason?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === 'completed') {
      throw new Error(`Cannot cancel completed task ${taskId}`);
    }

    task.result = { success: false, error: reason || 'Task cancelled' };
    this.updateTaskStatus(taskId, 'failed');
    
    this.emit('taskCancelled', { taskId, task, reason });
  }

  /**
   * Clear completed and failed tasks
   */
  clearFinishedTasks(): number {
    const finishedTaskIds = [
      ...Array.from(this.completedTasks),
      ...Array.from(this.failedTasks),
    ];

    let clearedCount = 0;
    for (const taskId of finishedTaskIds) {
      const task = this.tasks.get(taskId);
      if (task && task.completedAt) {
        // Only clear tasks older than 1 hour
        const hourAgo = new Date(Date.now() - 3600000);
        if (task.completedAt < hourAgo) {
          this.tasks.delete(taskId);
          this.completedTasks.delete(taskId);
          this.failedTasks.delete(taskId);
          clearedCount++;
        }
      }
    }

    if (clearedCount > 0) {
      this.emit('tasksCleared', { clearedCount });
    }

    return clearedCount;
  }

  /**
   * Stop processing and cleanup
   */
  shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.emit('queueShutdown');
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
      this.checkForTimeouts();
    }, 1000);
  }

  private processQueue(): void {
    // Check for blocked tasks that can now proceed
    for (const taskId of Array.from(this.blockedTasks)) {
      const task = this.tasks.get(taskId);
      if (task && this.areDependenciesSatisfied(task)) {
        this.updateTaskStatus(taskId, 'pending');
      }
    }

    // Process pending tasks based on priority
    this.sortPendingTasks();
  }

  private checkForTimeouts(): void {
    const now = new Date();
    
    for (const taskId of Array.from(this.inProgressTasks)) {
      const task = this.tasks.get(taskId);
      if (task && task.startedAt) {
        const elapsed = now.getTime() - task.startedAt.getTime();
        if (elapsed > this.taskTimeoutMs) {
          this.handleTaskTimeout(taskId);
        }
      }
    }
  }

  private handleTaskFailure(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.retryCount++;
    
    if (task.retryCount <= task.maxRetries) {
      // Retry after delay
      setTimeout(() => {
        this.updateTaskStatus(taskId, 'pending');
        this.emit('taskRetry', { taskId, task, retryCount: task.retryCount });
      }, this.retryDelayMs);
    } else {
      // Max retries exceeded
      this.updateTaskStatus(taskId, 'failed');
      this.emit('taskMaxRetriesExceeded', { taskId, task });
    }
  }

  private handleTaskTimeout(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.result = { success: false, error: 'Task timeout' };
    this.handleTaskFailure(taskId);
    this.emit('taskTimeout', { taskId, task });
  }

  private areDependenciesSatisfied(task: AgentTask): boolean {
    return task.dependencies.every(depId => this.completedTasks.has(depId));
  }

  private unblockDependentTasks(completedTaskId: string): void {
    for (const [taskId, task] of this.tasks) {
      if (task.dependencies.includes(completedTaskId) && task.status === 'blocked') {
        if (this.areDependenciesSatisfied(task)) {
          this.updateTaskStatus(taskId, 'pending');
        }
      }
    }
  }

  private insertTaskInQueue(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Insert based on priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const taskPriority = priorityOrder[task.priority];

    let insertIndex = this.pendingTasks.length;
    for (let i = 0; i < this.pendingTasks.length; i++) {
      const existingTask = this.tasks.get(this.pendingTasks[i]);
      if (existingTask && priorityOrder[existingTask.priority] > taskPriority) {
        insertIndex = i;
        break;
      }
    }

    this.pendingTasks.splice(insertIndex, 0, taskId);
  }

  private sortPendingTasks(): void {
    this.pendingTasks.sort((a, b) => {
      const taskA = this.tasks.get(a);
      const taskB = this.tasks.get(b);
      if (!taskA || !taskB) return 0;

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDiff = priorityOrder[taskA.priority] - priorityOrder[taskB.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Same priority, sort by assignment time
      return taskA.assignedAt.getTime() - taskB.assignedAt.getTime();
    });
  }

  private removeFromAllSets(taskId: string): void {
    const index = this.pendingTasks.indexOf(taskId);
    if (index > -1) {
      this.pendingTasks.splice(index, 1);
    }
    
    this.inProgressTasks.delete(taskId);
    this.completedTasks.delete(taskId);
    this.failedTasks.delete(taskId);
    this.blockedTasks.delete(taskId);
  }

  private getTaskIdsByStatus(status: AgentTask['status']): string[] {
    switch (status) {
      case 'pending':
        return [...this.pendingTasks];
      case 'in_progress':
        return Array.from(this.inProgressTasks);
      case 'completed':
        return Array.from(this.completedTasks);
      case 'failed':
        return Array.from(this.failedTasks);
      case 'blocked':
        return Array.from(this.blockedTasks);
      default:
        return [];
    }
  }

  private estimateStartTime(queuePosition: number): Date {
    const averageTaskTime = 60000; // 1 minute default
    const estimatedDelay = (queuePosition - 1) * (averageTaskTime / this.maxConcurrentTasks);
    return new Date(Date.now() + estimatedDelay);
  }

  private calculateAverageWaitTime(completedTasks: AgentTask[]): number {
    if (completedTasks.length === 0) return 0;
    
    const totalWaitTime = completedTasks.reduce((total, task) => {
      if (task.startedAt) {
        return total + (task.startedAt.getTime() - task.assignedAt.getTime());
      }
      return total;
    }, 0);
    
    return totalWaitTime / completedTasks.length;
  }

  private calculateAverageExecutionTime(completedTasks: AgentTask[]): number {
    if (completedTasks.length === 0) return 0;
    
    const totalExecutionTime = completedTasks.reduce((total, task) => {
      if (task.startedAt && task.completedAt) {
        return total + (task.completedAt.getTime() - task.startedAt.getTime());
      }
      return total;
    }, 0);
    
    return totalExecutionTime / completedTasks.length;
  }
}