/**
 * Shared Workspace Manager
 * 
 * Real-time collaborative editing system with conflict detection, resolution,
 * and atomic operations for multi-agent development coordination.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { 
  WorkspaceEvent, 
  ConflictResolution as BaseConflictResolution,
  AgentSession 
} from '../types';

export interface FileOperation {
  id: string;
  sessionId: string;
  agentId: string;
  type: 'create' | 'update' | 'delete' | 'move' | 'copy';
  filePath: string;
  content?: string;
  previousContent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  checksum: string;
  applied: boolean;
}

export interface FileLock {
  id: string;
  filePath: string;
  agentId: string;
  sessionId: string;
  lockType: 'exclusive' | 'shared' | 'intent';
  acquiredAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface ConflictDetection {
  id: string;
  sessionId: string;
  filePath: string;
  conflictType: 'concurrent_edit' | 'lock_contention' | 'merge_conflict' | 'semantic_conflict';
  involvedAgents: string[];
  operations: FileOperation[];
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoResolvable: boolean;
}

export interface WorkspaceSnapshot {
  id: string;
  sessionId: string;
  timestamp: Date;
  files: Map<string, FileSnapshot>;
  metadata: Record<string, any>;
}

export interface FileSnapshot {
  filePath: string;
  content: string;
  checksum: string;
  lastModified: Date;
  modifiedBy: string;
  version: number;
}

export interface MergeStrategy {
  name: string;
  description: string;
  priority: number;
  canHandle: (conflict: ConflictDetection) => boolean;
  resolve: (conflict: ConflictDetection, workspace: SharedWorkspace) => Promise<FileOperation[]>;
}

export interface CollaborationMetrics {
  sessionId: string;
  totalOperations: number;
  successfulMerges: number;
  conflictsDetected: number;
  conflictsResolved: number;
  averageResolutionTime: number;
  fileContention: Record<string, number>;
  agentCollaboration: Record<string, Record<string, number>>;
  concurrentOperations: number;
}

export class SharedWorkspace extends EventEmitter {
  private operations: Map<string, FileOperation[]> = new Map();
  private locks: Map<string, FileLock> = new Map();
  private conflicts: Map<string, ConflictDetection> = new Map();
  private snapshots: Map<string, WorkspaceSnapshot> = new Map();
  private fileWatchers: Map<string, any> = new Map();
  private mergeStrategies: MergeStrategy[] = [];
  
  private workspaceRoot: string;
  private enableRealTimeSync: boolean;
  private lockTimeoutMs: number;
  private snapshotIntervalMs: number;

  constructor(options: {
    workspaceRoot: string;
    enableRealTimeSync?: boolean;
    lockTimeoutMs?: number;
    snapshotIntervalMs?: number;
  }) {
    super();
    
    this.workspaceRoot = options.workspaceRoot;
    this.enableRealTimeSync = options.enableRealTimeSync ?? true;
    this.lockTimeoutMs = options.lockTimeoutMs || 300000; // 5 minutes
    this.snapshotIntervalMs = options.snapshotIntervalMs || 60000; // 1 minute
    
    this.initializeMergeStrategies();
    this.startBackgroundTasks();
  }

  /**
   * Apply a file operation with conflict detection and resolution
   */
  async applyOperation(operation: Omit<FileOperation, 'id' | 'timestamp' | 'applied' | 'checksum'>): Promise<string> {
    const fullOperation: FileOperation = {
      id: uuidv4(),
      timestamp: new Date(),
      applied: false,
      checksum: this.calculateChecksum(operation.content || ''),
      ...operation,
    };

    // Check for conflicts before applying
    const conflicts = await this.detectConflicts(fullOperation);
    
    if (conflicts.length > 0) {
      // Attempt automatic resolution
      for (const conflict of conflicts) {
        if (conflict.autoResolvable) {
          await this.resolveConflict(conflict.id);
        } else {
          this.emit('conflictDetected', { conflict });
          return fullOperation.id; // Return without applying
        }
      }
    }

    // Apply the operation
    await this.executeOperation(fullOperation);
    
    // Store operation history
    const sessionOps = this.operations.get(operation.sessionId) || [];
    sessionOps.push(fullOperation);
    this.operations.set(operation.sessionId, sessionOps);

    this.emit('operationApplied', { operation: fullOperation });
    return fullOperation.id;
  }

  /**
   * Acquire a file lock for exclusive or shared access
   */
  async acquireLock(
    sessionId: string,
    agentId: string,
    filePath: string,
    lockType: FileLock['lockType'] = 'exclusive',
    durationMs?: number
  ): Promise<string> {
    const lockId = uuidv4();
    const normalizedPath = path.normalize(filePath);
    
    // Check for existing locks
    const existingLock = this.getActiveLock(normalizedPath);
    if (existingLock && !this.canAcquireLock(existingLock, lockType, agentId)) {
      throw new Error(`Cannot acquire ${lockType} lock on ${filePath} - locked by ${existingLock.agentId}`);
    }

    const expiresAt = new Date(Date.now() + (durationMs || this.lockTimeoutMs));
    const lock: FileLock = {
      id: lockId,
      filePath: normalizedPath,
      agentId,
      sessionId,
      lockType,
      acquiredAt: new Date(),
      expiresAt,
    };

    this.locks.set(lockId, lock);
    this.emit('lockAcquired', { lock });

    // Auto-release lock when it expires
    setTimeout(() => {
      this.releaseLock(lockId);
    }, durationMs || this.lockTimeoutMs);

    return lockId;
  }

  /**
   * Release a file lock
   */
  async releaseLock(lockId: string): Promise<void> {
    const lock = this.locks.get(lockId);
    if (!lock) {
      return;
    }

    this.locks.delete(lockId);
    this.emit('lockReleased', { lock });
  }

  /**
   * Create a workspace snapshot for rollback capability
   */
  async createSnapshot(sessionId: string, metadata: Record<string, any> = {}): Promise<string> {
    const snapshotId = uuidv4();
    const files = new Map<string, FileSnapshot>();

    // Scan workspace directory for files
    const workspaceFiles = await this.scanWorkspaceFiles();
    
    for (const filePath of workspaceFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        const fileSnapshot: FileSnapshot = {
          filePath: path.relative(this.workspaceRoot, filePath),
          content,
          checksum: this.calculateChecksum(content),
          lastModified: stats.mtime,
          modifiedBy: 'unknown', // Would track this in real implementation
          version: 1, // Would increment versions
        };
        
        files.set(filePath, fileSnapshot);
      } catch (error) {
        console.warn(`Failed to snapshot file ${filePath}:`, error);
      }
    }

    const snapshot: WorkspaceSnapshot = {
      id: snapshotId,
      sessionId,
      timestamp: new Date(),
      files,
      metadata,
    };

    this.snapshots.set(snapshotId, snapshot);
    this.emit('snapshotCreated', { snapshot });

    return snapshotId;
  }

  /**
   * Restore workspace from a snapshot
   */
  async restoreFromSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }

    this.emit('restorationStarted', { snapshot });

    try {
      // Restore each file from the snapshot
      for (const [_, fileSnapshot] of snapshot.files) {
        const fullPath = path.join(this.workspaceRoot, fileSnapshot.filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileSnapshot.content);
      }

      this.emit('restorationCompleted', { snapshot });
    } catch (error) {
      this.emit('restorationFailed', { snapshot, error });
      throw error;
    }
  }

  /**
   * Detect conflicts between operations
   */
  async detectConflicts(operation: FileOperation): Promise<ConflictDetection[]> {
    const conflicts: ConflictDetection[] = [];
    const sessionOperations = this.operations.get(operation.sessionId) || [];
    
    // Check for concurrent edits on the same file
    const recentOperations = sessionOperations.filter(op => 
      op.filePath === operation.filePath &&
      Date.now() - op.timestamp.getTime() < 30000 && // Last 30 seconds
      op.agentId !== operation.agentId &&
      !op.applied
    );

    if (recentOperations.length > 0) {
      const conflictId = uuidv4();
      const conflict: ConflictDetection = {
        id: conflictId,
        sessionId: operation.sessionId,
        filePath: operation.filePath,
        conflictType: 'concurrent_edit',
        involvedAgents: [operation.agentId, ...recentOperations.map(op => op.agentId)],
        operations: [operation, ...recentOperations],
        detectedAt: new Date(),
        severity: this.assessConflictSeverity(operation, recentOperations),
        autoResolvable: this.isAutoResolvable(operation, recentOperations),
      };

      conflicts.push(conflict);
      this.conflicts.set(conflictId, conflict);
    }

    // Check for lock conflicts
    const activeLock = this.getActiveLock(operation.filePath);
    if (activeLock && activeLock.agentId !== operation.agentId) {
      const conflictId = uuidv4();
      const conflict: ConflictDetection = {
        id: conflictId,
        sessionId: operation.sessionId,
        filePath: operation.filePath,
        conflictType: 'lock_contention',
        involvedAgents: [operation.agentId, activeLock.agentId],
        operations: [operation],
        detectedAt: new Date(),
        severity: 'high',
        autoResolvable: false,
      };

      conflicts.push(conflict);
      this.conflicts.set(conflictId, conflict);
    }

    return conflicts;
  }

  /**
   * Resolve a detected conflict using appropriate strategy
   */
  async resolveConflict(conflictId: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    this.emit('conflictResolutionStarted', { conflict });

    try {
      // Find appropriate merge strategy
      const strategy = this.mergeStrategies.find(s => s.canHandle(conflict));
      if (!strategy) {
        throw new Error(`No merge strategy available for conflict type: ${conflict.conflictType}`);
      }

      // Apply the merge strategy
      const resolvedOperations = await strategy.resolve(conflict, this);
      
      // Apply resolved operations
      for (const operation of resolvedOperations) {
        await this.executeOperation(operation);
      }

      // Mark conflict as resolved
      this.conflicts.delete(conflictId);
      this.emit('conflictResolved', { conflictId, conflict, strategy: strategy.name });

    } catch (error) {
      this.emit('conflictResolutionFailed', { conflictId, conflict, error });
      throw error;
    }
  }

  /**
   * Get collaboration metrics for a session
   */
  getCollaborationMetrics(sessionId: string): CollaborationMetrics {
    const sessionOperations = this.operations.get(sessionId) || [];
    const sessionConflicts = Array.from(this.conflicts.values())
      .filter(c => c.sessionId === sessionId);

    const resolvedConflicts = sessionConflicts.filter(c => !this.conflicts.has(c.id));
    const averageResolutionTime = resolvedConflicts.length > 0 
      ? resolvedConflicts.reduce((sum, c) => {
          // Calculate based on detection time (simplified)
          return sum + 30000; // 30 seconds average
        }, 0) / resolvedConflicts.length
      : 0;

    // File contention analysis
    const fileContention: Record<string, number> = {};
    sessionOperations.forEach(op => {
      fileContention[op.filePath] = (fileContention[op.filePath] || 0) + 1;
    });

    // Agent collaboration matrix
    const agentCollaboration: Record<string, Record<string, number>> = {};
    sessionOperations.forEach(op => {
      if (!agentCollaboration[op.agentId]) {
        agentCollaboration[op.agentId] = {};
      }
      // Count files worked on by multiple agents
      const otherAgents = sessionOperations
        .filter(other => other.filePath === op.filePath && other.agentId !== op.agentId)
        .map(other => other.agentId);
      
      otherAgents.forEach(otherAgent => {
        agentCollaboration[op.agentId][otherAgent] = 
          (agentCollaboration[op.agentId][otherAgent] || 0) + 1;
      });
    });

    return {
      sessionId,
      totalOperations: sessionOperations.length,
      successfulMerges: sessionOperations.filter(op => op.applied).length,
      conflictsDetected: sessionConflicts.length,
      conflictsResolved: resolvedConflicts.length,
      averageResolutionTime,
      fileContention,
      agentCollaboration,
      concurrentOperations: sessionOperations.filter(op => !op.applied).length,
    };
  }

  /**
   * Get real-time workspace status
   */
  getWorkspaceStatus(): {
    activeLocks: FileLock[];
    pendingOperations: number;
    activeConflicts: ConflictDetection[];
    recentSnapshots: WorkspaceSnapshot[];
  } {
    const now = new Date();
    const activeLocks = Array.from(this.locks.values())
      .filter(lock => lock.expiresAt > now);

    const pendingOperations = Array.from(this.operations.values())
      .flat()
      .filter(op => !op.applied).length;

    const activeConflicts = Array.from(this.conflicts.values());

    const recentSnapshots = Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);

    return {
      activeLocks,
      pendingOperations,
      activeConflicts,
      recentSnapshots,
    };
  }

  private async executeOperation(operation: FileOperation): Promise<void> {
    const fullPath = path.join(this.workspaceRoot, operation.filePath);

    try {
      switch (operation.type) {
        case 'create':
        case 'update':
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, operation.content || '');
          break;
          
        case 'delete':
          await fs.unlink(fullPath);
          break;
          
        case 'move':
          const newPath = path.join(this.workspaceRoot, operation.metadata?.newPath || '');
          await fs.rename(fullPath, newPath);
          break;
          
        case 'copy':
          const copyPath = path.join(this.workspaceRoot, operation.metadata?.copyPath || '');
          await fs.copyFile(fullPath, copyPath);
          break;
      }

      operation.applied = true;
      
      // Emit workspace event
      const event: WorkspaceEvent = {
        id: uuidv4(),
        type: operation.type === 'create' ? 'file_created' : 
              operation.type === 'update' ? 'file_modified' :
              operation.type === 'delete' ? 'file_deleted' : 'file_modified',
        sessionId: operation.sessionId,
        agentId: operation.agentId,
        timestamp: new Date(),
        filePath: operation.filePath,
        metadata: operation.metadata,
      };

      this.emit('workspaceEvent', { event });
      
    } catch (error) {
      this.emit('operationFailed', { operation, error });
      throw error;
    }
  }

  private getActiveLock(filePath: string): FileLock | null {
    const now = new Date();
    const normalizedPath = path.normalize(filePath);
    
    for (const lock of this.locks.values()) {
      if (lock.filePath === normalizedPath && lock.expiresAt > now) {
        return lock;
      }
    }
    
    return null;
  }

  private canAcquireLock(
    existingLock: FileLock,
    requestedType: FileLock['lockType'],
    agentId: string
  ): boolean {
    // Same agent can always acquire additional locks
    if (existingLock.agentId === agentId) {
      return true;
    }

    // Shared locks are compatible with other shared locks
    if (existingLock.lockType === 'shared' && requestedType === 'shared') {
      return true;
    }

    // Intent locks don't block other operations
    if (existingLock.lockType === 'intent' || requestedType === 'intent') {
      return true;
    }

    return false;
  }

  private assessConflictSeverity(
    operation: FileOperation,
    conflictingOps: FileOperation[]
  ): ConflictDetection['severity'] {
    // Determine severity based on operation types and file importance
    if (operation.type === 'delete' || conflictingOps.some(op => op.type === 'delete')) {
      return 'critical';
    }

    if (operation.filePath.includes('package.json') || 
        operation.filePath.includes('tsconfig.json')) {
      return 'high';
    }

    if (conflictingOps.length > 2) {
      return 'medium';
    }

    return 'low';
  }

  private isAutoResolvable(
    operation: FileOperation,
    conflictingOps: FileOperation[]
  ): boolean {
    // Simple heuristics for auto-resolution
    if (operation.type === 'delete' || conflictingOps.some(op => op.type === 'delete')) {
      return false; // Deletions require manual resolution
    }

    // Non-overlapping changes might be auto-resolvable
    return conflictingOps.length === 1 && operation.type === 'update';
  }

  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private async scanWorkspaceFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to scan directory ${dir}:`, error);
      }
    };

    await scanDirectory(this.workspaceRoot);
    return files;
  }

  private initializeMergeStrategies(): void {
    // Three-way merge strategy
    this.mergeStrategies.push({
      name: 'three_way_merge',
      description: 'Intelligent three-way merge for text files',
      priority: 1,
      canHandle: (conflict) => 
        conflict.conflictType === 'concurrent_edit' && 
        conflict.operations.length === 2,
      resolve: async (conflict, workspace) => {
        const [op1, op2] = conflict.operations;
        
        // Simple merge: concatenate unique changes
        const merged = this.performThreeWayMerge(
          op1.previousContent || '',
          op1.content || '',
          op2.content || ''
        );
        
        return [{
          ...op1,
          id: uuidv4(),
          content: merged,
          timestamp: new Date(),
          applied: false,
          checksum: this.calculateChecksum(merged),
        }];
      },
    });

    // Last-writer-wins strategy
    this.mergeStrategies.push({
      name: 'last_writer_wins',
      description: 'Simple last-writer-wins conflict resolution',
      priority: 2,
      canHandle: (conflict) => conflict.conflictType === 'concurrent_edit',
      resolve: async (conflict, workspace) => {
        const latestOp = conflict.operations.reduce((latest, current) => 
          current.timestamp > latest.timestamp ? current : latest
        );
        
        return [{ ...latestOp, applied: false }];
      },
    });

    // Lock-based resolution
    this.mergeStrategies.push({
      name: 'lock_priority',
      description: 'Resolve based on lock priority',
      priority: 3,
      canHandle: (conflict) => conflict.conflictType === 'lock_contention',
      resolve: async (conflict, workspace) => {
        // Grant operation to agent with existing lock
        const operation = conflict.operations[0];
        const lock = workspace.getActiveLock(operation.filePath);
        
        if (lock && lock.agentId !== operation.agentId) {
          // Defer operation until lock is released
          throw new Error('Operation deferred - lock held by another agent');
        }
        
        return [{ ...operation, applied: false }];
      },
    });
  }

  private performThreeWayMerge(base: string, left: string, right: string): string {
    // Simplified three-way merge implementation
    // In practice, would use a proper diff/merge algorithm
    
    const baseLines = base.split('\n');
    const leftLines = left.split('\n');
    const rightLines = right.split('\n');
    
    const merged: string[] = [];
    let baseIndex = 0;
    let leftIndex = 0;
    let rightIndex = 0;
    
    while (leftIndex < leftLines.length || rightIndex < rightLines.length) {
      const leftLine = leftLines[leftIndex];
      const rightLine = rightLines[rightIndex];
      const baseLine = baseLines[baseIndex];
      
      if (leftLine === rightLine) {
        // Both sides made the same change or no change
        merged.push(leftLine);
        leftIndex++;
        rightIndex++;
        baseIndex++;
      } else if (leftLine === baseLine) {
        // Right side changed
        merged.push(rightLine);
        rightIndex++;
        baseIndex++;
      } else if (rightLine === baseLine) {
        // Left side changed
        merged.push(leftLine);
        leftIndex++;
        baseIndex++;
      } else {
        // Conflict - include both changes with markers
        merged.push('<<<<<<< LEFT');
        merged.push(leftLine);
        merged.push('=======');
        merged.push(rightLine);
        merged.push('>>>>>>> RIGHT');
        leftIndex++;
        rightIndex++;
        baseIndex++;
      }
    }
    
    return merged.join('\n');
  }

  private startBackgroundTasks(): void {
    // Periodic snapshot creation
    setInterval(async () => {
      try {
        for (const sessionId of this.operations.keys()) {
          await this.createSnapshot(sessionId, { automatic: true });
        }
      } catch (error) {
        console.warn('Failed to create automatic snapshot:', error);
      }
    }, this.snapshotIntervalMs);

    // Lock cleanup
    setInterval(() => {
      const now = new Date();
      for (const [lockId, lock] of this.locks) {
        if (lock.expiresAt <= now) {
          this.releaseLock(lockId);
        }
      }
    }, 60000); // Check every minute

    // Conflict detection monitoring
    if (this.enableRealTimeSync) {
      setInterval(() => {
        this.performPeriodicConflictCheck();
      }, 10000); // Check every 10 seconds
    }
  }

  private performPeriodicConflictCheck(): void {
    // Check for potential conflicts in pending operations
    for (const [sessionId, operations] of this.operations) {
      const pendingOps = operations.filter(op => !op.applied);
      
      // Group by file path
      const fileGroups = new Map<string, FileOperation[]>();
      pendingOps.forEach(op => {
        const group = fileGroups.get(op.filePath) || [];
        group.push(op);
        fileGroups.set(op.filePath, group);
      });

      // Check for conflicts within each file group
      for (const [filePath, fileOps] of fileGroups) {
        if (fileOps.length > 1) {
          const uniqueAgents = new Set(fileOps.map(op => op.agentId));
          if (uniqueAgents.size > 1) {
            this.emit('potentialConflictDetected', {
              sessionId,
              filePath,
              agents: Array.from(uniqueAgents),
              operations: fileOps,
            });
          }
        }
      }
    }
  }
}