/**
 * Claude Code Instance Runner
 * 
 * Manages headless Claude Code CLI instances for multi-agent orchestration.
 * Handles spawning, lifecycle management, and communication with instances.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export interface ClaudeCodeInstance {
  id: string;
  agentId: string;
  process: ChildProcess;
  workingDirectory: string;
  status: 'starting' | 'ready' | 'busy' | 'error' | 'terminated';
  createdAt: Date;
  lastActivity: Date;
  capabilities: string[];
}

export interface ExecutionOptions {
  timeout?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  agentSpecialization?: string;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  instanceId: string;
}

export class ClaudeCodeRunner extends EventEmitter {
  private instances: Map<string, ClaudeCodeInstance> = new Map();
  private instancePool: string[] = [];
  private maxInstances: number;
  private claudeCodePath: string;
  private baseWorkingDirectory: string;

  constructor(options: {
    maxInstances?: number;
    claudeCodePath?: string;
    baseWorkingDirectory?: string;
  } = {}) {
    super();
    this.maxInstances = options.maxInstances || 5;
    this.claudeCodePath = options.claudeCodePath || 'claude-code';
    this.baseWorkingDirectory = options.baseWorkingDirectory || process.cwd();
  }

  /**
   * Create a new Claude Code instance for a specific agent
   */
  async createInstance(agentId: string, options: ExecutionOptions = {}): Promise<string> {
    const instanceId = uuidv4();
    const workingDirectory = options.workingDirectory || this.baseWorkingDirectory;

    try {
      // Prepare environment variables
      const env = {
        ...process.env,
        ...options.environment,
        // Enable headless mode and other optimizations
        CLAUDE_CODE_HEADLESS: 'true',
        CLAUDE_CODE_NO_INTERACTION: 'true',
        CLAUDE_CODE_JSON_OUTPUT: 'true',
      };

      // Spawn Claude Code instance
      const childProcess = spawn(this.claudeCodePath, [
        '--headless',
        '--working-directory', workingDirectory,
        '--agent-mode', agentId,
      ], {
        env,
        cwd: workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const instance: ClaudeCodeInstance = {
        id: instanceId,
        agentId,
        process: childProcess,
        workingDirectory,
        status: 'starting',
        createdAt: new Date(),
        lastActivity: new Date(),
        capabilities: this.getAgentCapabilities(agentId),
      };

      this.instances.set(instanceId, instance);

      // Set up process event handlers
      this.setupInstanceHandlers(instance);

      // Wait for instance to be ready
      await this.waitForInstanceReady(instanceId);

      this.instancePool.push(instanceId);
      this.emit('instanceCreated', { instanceId, agentId });

      return instanceId;
    } catch (error) {
      this.emit('instanceError', { instanceId, agentId, error });
      throw new Error(`Failed to create Claude Code instance: ${error}`);
    }
  }

  /**
   * Execute a task on a specific instance
   */
  async executeTask(
    instanceId: string,
    task: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status !== 'ready') {
      throw new Error(`Instance ${instanceId} is not ready (status: ${instance.status})`);
    }

    const startTime = Date.now();
    instance.status = 'busy';
    instance.lastActivity = new Date();

    try {
      // Send task to Claude Code instance
      const taskPayload = {
        type: 'task',
        id: uuidv4(),
        task,
        agentId: instance.agentId,
        options,
      };

      const result = await this.sendTaskToInstance(instance, taskPayload, options.timeout);
      
      instance.status = 'ready';
      
      return {
        success: true,
        output: result.output,
        executionTime: Date.now() - startTime,
        instanceId,
      };
    } catch (error) {
      instance.status = 'error';
      this.emit('instanceError', { instanceId: instance.id, agentId: instance.agentId, error });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        instanceId,
      };
    }
  }

  /**
   * Get an available instance for a specific agent type
   */
  async getAvailableInstance(agentId: string): Promise<string> {
    // Look for existing ready instance of this agent type
    for (const [instanceId, instance] of this.instances) {
      if (instance.agentId === agentId && instance.status === 'ready') {
        return instanceId;
      }
    }

    // If no available instance, create a new one
    if (this.instances.size < this.maxInstances) {
      return await this.createInstance(agentId);
    }

    // Wait for an instance to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for available instance'));
      }, 30000);

      const checkAvailable = () => {
        for (const [instanceId, instance] of this.instances) {
          if (instance.agentId === agentId && instance.status === 'ready') {
            clearTimeout(timeout);
            resolve(instanceId);
            return;
          }
        }
        setTimeout(checkAvailable, 1000);
      };
      
      checkAvailable();
    });
  }

  /**
   * Terminate a specific instance
   */
  async terminateInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return;
    }

    instance.status = 'terminated';
    instance.process.kill('SIGTERM');

    // Give it time to clean up, then force kill if needed
    setTimeout(() => {
      if (!instance.process.killed) {
        instance.process.kill('SIGKILL');
      }
    }, 5000);

    this.instances.delete(instanceId);
    this.instancePool = this.instancePool.filter(id => id !== instanceId);
    this.emit('instanceTerminated', { instanceId, agentId: instance.agentId });
  }

  /**
   * Terminate all instances
   */
  async terminateAll(): Promise<void> {
    const terminationPromises = Array.from(this.instances.keys())
      .map(instanceId => this.terminateInstance(instanceId));
    
    await Promise.all(terminationPromises);
  }

  /**
   * Get status of all instances
   */
  getInstanceStatus(): { [instanceId: string]: Omit<ClaudeCodeInstance, 'process'> } {
    const status: { [instanceId: string]: Omit<ClaudeCodeInstance, 'process'> } = {};
    
    for (const [instanceId, instance] of this.instances) {
      status[instanceId] = {
        id: instance.id,
        agentId: instance.agentId,
        workingDirectory: instance.workingDirectory,
        status: instance.status,
        createdAt: instance.createdAt,
        lastActivity: instance.lastActivity,
        capabilities: instance.capabilities,
      };
    }
    
    return status;
  }

  /**
   * Health check for all instances
   */
  async performHealthCheck(): Promise<{ healthy: string[]; unhealthy: string[] }> {
    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const [instanceId, instance] of this.instances) {
      try {
        // Send a simple ping task
        const result = await this.executeTask(instanceId, 'ping', { timeout: 5000 });
        if (result.success) {
          healthy.push(instanceId);
        } else {
          unhealthy.push(instanceId);
        }
      } catch (error) {
        unhealthy.push(instanceId);
      }
    }

    return { healthy, unhealthy };
  }

  private setupInstanceHandlers(instance: ClaudeCodeInstance): void {
    const { process } = instance;

    process.on('error', (error) => {
      instance.status = 'error';
      this.emit('instanceError', { instanceId: instance.id, agentId: instance.agentId, error });
    });

    process.on('exit', (code, signal) => {
      instance.status = 'terminated';
      this.instances.delete(instance.id);
      this.instancePool = this.instancePool.filter(id => id !== instance.id);
      this.emit('instanceExit', { instanceId: instance.id, agentId: instance.agentId, code, signal });
    });

    process.stdout?.on('data', (data) => {
      const output = data.toString();
      this.emit('instanceOutput', { instanceId: instance.id, agentId: instance.agentId, output });
    });

    process.stderr?.on('data', (data) => {
      const error = data.toString();
      this.emit('instanceError', { instanceId: instance.id, agentId: instance.agentId, error });
    });
  }

  private async waitForInstanceReady(instanceId: string, timeout = 30000): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Instance ${instanceId} failed to become ready within ${timeout}ms`));
      }, timeout);

      const checkReady = () => {
        if (instance.status === 'ready') {
          clearTimeout(timer);
          resolve();
        } else if (instance.status === 'error' || instance.status === 'terminated') {
          clearTimeout(timer);
          reject(new Error(`Instance ${instanceId} failed to start (status: ${instance.status})`));
        } else {
          setTimeout(checkReady, 500);
        }
      };

      // Simulate ready state after a brief startup delay
      setTimeout(() => {
        instance.status = 'ready';
      }, 2000);

      checkReady();
    });
  }

  private async sendTaskToInstance(
    instance: ClaudeCodeInstance,
    taskPayload: any,
    timeout = 60000
  ): Promise<{ output: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task execution timeout after ${timeout}ms`));
      }, timeout);

      // Send task via stdin
      instance.process.stdin?.write(JSON.stringify(taskPayload) + '\n');

      // Listen for response
      const onData = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === taskPayload.id) {
            clearTimeout(timer);
            instance.process.stdout?.off('data', onData);
            resolve({ output: response.result });
          }
        } catch (error) {
          // Ignore parsing errors, might be partial data
        }
      };

      instance.process.stdout?.on('data', onData);
    });
  }

  private getAgentCapabilities(agentId: string): string[] {
    const capabilityMap: { [key: string]: string[] } = {
      'architecture-reviewer': ['code_analysis', 'refactoring', 'documentation'],
      'test-automation-engineer': ['test_creation', 'coverage_analysis', 'mock_services'],
      'hardware-integration-specialist': ['hardware_integration', 'bluetooth', 'nfc', 'permissions'],
      'security-audit-specialist': ['security_analysis', 'vulnerability_assessment', 'penetration_testing'],
      'ux-accessibility-expert': ['accessibility_audit', 'user_experience', 'interface_design'],
      'solana-mobile-expert': ['blockchain_integration', 'solana_development', 'mobile_crypto'],
      'performance-optimizer': ['performance_analysis', 'optimization', 'profiling'],
      'devops-integration-engineer': ['ci_cd', 'deployment', 'infrastructure'],
    };

    return capabilityMap[agentId] || ['general_purpose'];
  }
}