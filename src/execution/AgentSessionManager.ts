/**
 * Agent Session Manager
 * 
 * Manages agent sessions, git worktrees, and workspace isolation for multi-agent coordination.
 * Handles session lifecycle, state persistence, and cleanup.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import simpleGit, { SimpleGit } from 'simple-git';
import { SessionInfo, WorktreeInfo, AgentSession, SessionState, CoordinationStrategy } from '../types';

export interface CreateSessionOptions {
  task: string;
  agents: string[];
  coordinationStrategy: CoordinationStrategy;
  baseRepository?: string;
  baseBranch?: string;
  workspaceRoot?: string;
}

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageExecutionTime: number;
  activeWorktrees: number;
}

export class AgentSessionManager extends EventEmitter {
  private sessions: Map<string, AgentSession> = new Map();
  private worktrees: Map<string, WorktreeInfo> = new Map();
  private git: SimpleGit;
  private workspaceRoot: string;
  private baseRepository: string;
  private sessionStateFile: string;

  constructor(options: {
    workspaceRoot?: string;
    baseRepository?: string;
    sessionStateFile?: string;
  } = {}) {
    super();
    this.workspaceRoot = options.workspaceRoot || path.join(process.cwd(), '.orchestrator-workspace');
    this.baseRepository = options.baseRepository || process.cwd();
    this.sessionStateFile = options.sessionStateFile || path.join(this.workspaceRoot, 'sessions.json');
    this.git = simpleGit(this.baseRepository);
    
    this.initializeWorkspace();
    this.loadPersistedSessions();
  }

  /**
   * Create a new orchestration session
   */
  async createSession(options: CreateSessionOptions): Promise<string> {
    const sessionId = uuidv4();
    const session: AgentSession = {
      id: sessionId,
      task: options.task,
      agents: options.agents,
      coordinationStrategy: options.coordinationStrategy,
      status: 'planning',
      startTime: new Date(),
      worktrees: [],
      state: {
        currentPhase: 'initialization',
        completedAgents: [],
        activeAgents: [...options.agents],
        sharedContext: {},
        dependencies: new Map(),
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailes: 0,
        totalExecutionTime: 0,
        agentUtilization: {},
      },
    };

    this.sessions.set(sessionId, session);
    
    // Create isolated worktrees for each agent
    await this.createWorktreesForSession(session);
    
    this.emit('sessionCreated', { sessionId, session });
    await this.persistSessionState();
    
    return sessionId;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: SessionInfo['status']): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const previousStatus = session.status;
    session.status = status;
    
    if (status === 'completed' || status === 'failed') {
      session.endTime = new Date();
    }

    this.emit('sessionStatusChanged', { sessionId, previousStatus, newStatus: status });
    await this.persistSessionState();
  }

  /**
   * Update session state
   */
  async updateSessionState(sessionId: string, stateUpdate: Partial<SessionState>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.state = {
      ...session.state,
      ...stateUpdate,
    };

    this.emit('sessionStateUpdated', { sessionId, state: session.state });
    await this.persistSessionState();
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status === 'planning' || session.status === 'executing'
    );
  }

  /**
   * Create worktrees for all agents in a session
   */
  private async createWorktreesForSession(session: AgentSession): Promise<void> {
    const baseBranch = await this.getCurrentBranch();
    
    for (const agentId of session.agents) {
      const worktreeId = uuidv4();
      const branchName = `orchestrator/${session.id}/${agentId}`;
      const worktreePath = path.join(this.workspaceRoot, 'worktrees', worktreeId);

      try {
        // Create new branch from current branch
        await this.git.checkoutBranch(branchName, baseBranch);
        
        // Create worktree
        await this.git.raw(['worktree', 'add', worktreePath, branchName]);

        const worktree: WorktreeInfo = {
          id: worktreeId,
          path: worktreePath,
          branch: branchName,
          agentId,
          sessionId: session.id,
          created: new Date(),
          status: 'active',
        };

        this.worktrees.set(worktreeId, worktree);
        session.worktrees.push(worktree);

        this.emit('worktreeCreated', { worktreeId, worktree });
      } catch (error) {
        this.emit('worktreeError', { sessionId: session.id, agentId, error });
        throw new Error(`Failed to create worktree for agent ${agentId}: ${error}`);
      }
    }
  }

  /**
   * Get worktree for a specific agent in a session
   */
  getAgentWorktree(sessionId: string, agentId: string): WorktreeInfo | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    return session.worktrees.find(wt => wt.agentId === agentId);
  }

  /**
   * Clean up session and its worktrees
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Clean up all worktrees for this session
    for (const worktree of session.worktrees) {
      await this.cleanupWorktree(worktree.id);
    }

    // Remove session
    this.sessions.delete(sessionId);
    this.emit('sessionCleaned', { sessionId });
    await this.persistSessionState();
  }

  /**
   * Clean up a specific worktree
   */
  async cleanupWorktree(worktreeId: string): Promise<void> {
    const worktree = this.worktrees.get(worktreeId);
    if (!worktree) {
      return;
    }

    try {
      // Remove worktree
      await this.git.raw(['worktree', 'remove', worktree.path, '--force']);
      
      // Delete branch
      await this.git.deleteLocalBranch(worktree.branch, true);
      
      worktree.status = 'cleaned';
      this.worktrees.delete(worktreeId);
      
      this.emit('worktreeCleaned', { worktreeId, worktree });
    } catch (error) {
      this.emit('worktreeError', { worktreeId, error });
      console.warn(`Failed to clean up worktree ${worktreeId}:`, error);
    }
  }

  /**
   * Merge agent changes back to main branch
   */
  async mergeAgentChanges(sessionId: string, agentId: string): Promise<void> {
    const worktree = this.getAgentWorktree(sessionId, agentId);
    if (!worktree) {
      throw new Error(`No worktree found for agent ${agentId} in session ${sessionId}`);
    }

    try {
      const agentGit = simpleGit(worktree.path);
      
      // Commit any pending changes
      const status = await agentGit.status();
      if (!status.isClean()) {
        await agentGit.add('.');
        await agentGit.commit(`Agent ${agentId} changes from session ${sessionId}`);
      }

      // Switch to main branch
      const mainBranch = await this.getCurrentBranch();
      await this.git.checkout(mainBranch);

      // Merge agent branch
      await this.git.merge([worktree.branch]);

      worktree.status = 'merged';
      this.emit('agentChangesMerged', { sessionId, agentId, worktreeId: worktree.id });
    } catch (error) {
      worktree.status = 'error';
      this.emit('mergeError', { sessionId, agentId, worktreeId: worktree.id, error });
      throw new Error(`Failed to merge changes from agent ${agentId}: ${error}`);
    }
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(): SessionMetrics {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => s.status === 'planning' || s.status === 'executing');
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const failedSessions = sessions.filter(s => s.status === 'failed');
    
    const totalExecutionTime = completedSessions.reduce((total, session) => {
      if (session.endTime && session.startTime) {
        return total + (session.endTime.getTime() - session.startTime.getTime());
      }
      return total;
    }, 0);

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length,
      failedSessions: failedSessions.length,
      averageExecutionTime: completedSessions.length > 0 ? totalExecutionTime / completedSessions.length : 0,
      activeWorktrees: Array.from(this.worktrees.values()).filter(wt => wt.status === 'active').length,
    };
  }

  /**
   * Perform health check on all active sessions
   */
  async performHealthCheck(): Promise<{
    healthySessions: string[];
    unhealthySessions: string[];
    orphanedWorktrees: string[];
  }> {
    const healthySessions: string[] = [];
    const unhealthySessions: string[] = [];
    const orphanedWorktrees: string[] = [];

    // Check sessions
    for (const [sessionId, session] of this.sessions) {
      try {
        // Check if session worktrees exist
        let healthy = true;
        for (const worktree of session.worktrees) {
          if (!(await this.worktreeExists(worktree.path))) {
            healthy = false;
            break;
          }
        }
        
        if (healthy) {
          healthySessions.push(sessionId);
        } else {
          unhealthySessions.push(sessionId);
        }
      } catch (error) {
        unhealthySessions.push(sessionId);
      }
    }

    // Check for orphaned worktrees
    for (const [worktreeId, worktree] of this.worktrees) {
      const session = this.sessions.get(worktree.sessionId);
      if (!session) {
        orphanedWorktrees.push(worktreeId);
      }
    }

    return { healthySessions, unhealthySessions, orphanedWorktrees };
  }

  /**
   * Clean up orphaned resources
   */
  async cleanupOrphanedResources(): Promise<void> {
    const { orphanedWorktrees } = await this.performHealthCheck();
    
    for (const worktreeId of orphanedWorktrees) {
      await this.cleanupWorktree(worktreeId);
    }
  }

  private async initializeWorkspace(): Promise<void> {
    try {
      await fs.mkdir(this.workspaceRoot, { recursive: true });
      await fs.mkdir(path.join(this.workspaceRoot, 'worktrees'), { recursive: true });
    } catch (error) {
      throw new Error(`Failed to initialize workspace: ${error}`);
    }
  }

  private async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'main';
  }

  private async worktreeExists(worktreePath: string): Promise<boolean> {
    try {
      await fs.access(worktreePath);
      return true;
    } catch {
      return false;
    }
  }

  private async persistSessionState(): Promise<void> {
    try {
      const sessionsData = Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
        ...session,
        // Convert dates to ISO strings for JSON serialization
        startTime: session.startTime.toISOString(),
        endTime: session.endTime?.toISOString(),
        worktrees: session.worktrees.map(wt => ({
          ...wt,
          created: wt.created.toISOString(),
        })),
      }));

      await fs.writeFile(this.sessionStateFile, JSON.stringify(sessionsData, null, 2));
    } catch (error) {
      console.warn('Failed to persist session state:', error);
    }
  }

  private async loadPersistedSessions(): Promise<void> {
    try {
      const data = await fs.readFile(this.sessionStateFile, 'utf-8');
      const sessionsData = JSON.parse(data);

      for (const sessionData of sessionsData) {
        const session: AgentSession = {
          ...sessionData,
          startTime: new Date(sessionData.startTime),
          endTime: sessionData.endTime ? new Date(sessionData.endTime) : undefined,
          worktrees: sessionData.worktrees.map((wt: any) => ({
            ...wt,
            created: new Date(wt.created),
          })),
        };

        this.sessions.set(session.id, session);
        
        // Rebuild worktrees map
        for (const worktree of session.worktrees) {
          this.worktrees.set(worktree.id, worktree);
        }
      }
    } catch (error) {
      // No existing sessions file or invalid format - start fresh
    }
  }
}