/**
 * Type definitions for Claude Code Orchestrator
 */

export interface AgentInfo {
  name: string;
  description: string;
  capabilities: string[];
  bestFor: string[];
}

export interface OrchestrationPlan {
  task: string;
  suggestedAgents: string[];
  estimatedDuration: TaskDuration;
  coordinationStrategy: CoordinationStrategy;
  agents: AgentPlanInfo[];
  phases: ExecutionPhase[];
  dependencies: TaskDependency[];
  successCriteria: string[];
  riskMitigation: RiskMitigation[];
}

export interface TaskDuration {
  estimatedMinutes: number;
  complexity: 'low' | 'medium' | 'high';
  parallelAgents: number;
  explanation: string;
}

export interface AgentPlanInfo {
  id: string;
  name: string;
  role: string;
  deliverables: string[];
}

export interface ExecutionPhase {
  name: string;
  agents: string[];
  durationEstimate: string;
  deliverables: string[];
}

export interface TaskDependency {
  dependency: string;
  prerequisite: string;
  dependent: string;
}

export interface RiskMitigation {
  risk: string;
  mitigation: string;
}

export type CoordinationStrategy = 'parallel' | 'sequential' | 'phased_parallel' | 'adaptive' | 'consensus' | 'pipeline' | 'recovery';

export interface OrchestrationConfig {
  agents: Record<string, AgentConfig>;
  coordination: CoordinationConfig;
  claudeCode: ClaudeCodeConfig;
  projectSpecific?: ProjectSpecificConfig;
  detectionPatterns?: DetectionPatterns;
}

export interface AgentConfig {
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
  domains?: string[];
}

export interface CoordinationConfig {
  defaultStrategy: CoordinationStrategy;
  maxConcurrentAgents: number;
  timeoutMs: number;
  targetBranch: string;
}

export interface ClaudeCodeConfig {
  path: string;
  defaultArgs: string[];
  workingDirectory: string;
}

export interface ProjectSpecificConfig {
  framework: string;
  platform: string;
  blockchain?: string;
  mobile?: boolean;
  domains: {
    primary: string[];
    secondary: string[];
    emerging: string[];
  };
  workflow: {
    validateCommand: string;
    testCommand: string;
    buildCommand: string;
    dualDeviceCommand?: string;
  };
}

export interface DetectionPatterns {
  highConfidence: RegExp[];
  solana?: RegExp[];
  hardware?: RegExp[];
  security?: RegExp[];
  testing?: RegExp[];
}

export interface OrchestrationResult {
  success: boolean;
  action: string;
  plan?: OrchestrationPlan;
  agents?: Record<string, AgentInfo>;
  status?: OrchestrationStatus;
  error?: string;
  nextSteps?: string[];
  examples?: string[];
  availableCommands?: string[];
}

export interface OrchestrationStatus {
  activeSessions: number;
  activeWorktrees: string[];
  lastExecution: string;
  orchestratorHealth: string;
}

export interface ClaudeCodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  agentId: string;
  sessionId: string;
  created: Date;
  status: 'active' | 'completed' | 'error' | 'merged' | 'cleaned';
}

export interface SessionInfo {
  id: string;
  task: string;
  agents: string[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  worktrees: WorktreeInfo[];
}

export interface InteractiveSession {
  currentTask?: string;
  selectedAgents: string[];
  coordinationStrategy: CoordinationStrategy;
  config: OrchestrationConfig;
}

export interface AgentSuggestion {
  agentId: string;
  confidence: number;
  reason: string;
}

export interface TaskAnalysis {
  complexity: number;
  domains: string[];
  suggestedAgents: string[];
  shouldOrchestrate: boolean;
  confidence: number;
  reason: string;
}

// Enhanced session and execution types
export interface AgentSession {
  id: string;
  task: string;
  agents: string[];
  coordinationStrategy: CoordinationStrategy;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  worktrees: WorktreeInfo[];
  state: SessionState;
  metrics: SessionMetrics;
}

export interface SessionState {
  currentPhase: string;
  completedAgents: string[];
  activeAgents: string[];
  sharedContext: Record<string, any>;
  dependencies: Map<string, string[]>;
}

export interface SessionMetrics {
  tasksCompleted: number;
  tasksFailes: number;
  totalExecutionTime: number;
  agentUtilization: Record<string, number>;
}

// Task execution types
export interface AgentTask {
  id: string;
  sessionId: string;
  agentId: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  assignedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: TaskResult;
  retryCount: number;
  maxRetries: number;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  artifacts?: string[];
  metadata?: Record<string, any>;
}

// Natural language processing types
export interface TaskDecomposition {
  originalTask: string;
  subtasks: SubTask[];
  dependencies: TaskDependencyGraph;
  estimatedComplexity: number;
  recommendedStrategy: CoordinationStrategy;
}

export interface SubTask {
  id: string;
  description: string;
  assignedAgent: string;
  estimatedDuration: number;
  dependencies: string[];
  priority: 'high' | 'medium' | 'low';
  deliverables: string[];
}

export interface TaskDependencyGraph {
  nodes: string[];
  edges: { from: string; to: string; type: 'blocks' | 'depends_on' | 'parallel' }[];
}

// Team coordination types
export interface TeamWorkflow {
  id: string;
  name: string;
  description: string;
  phases: WorkflowPhase[];
  agents: string[];
  triggers: WorkflowTrigger[];
}

export interface WorkflowPhase {
  id: string;
  name: string;
  agents: string[];
  tasks: string[];
  successCriteria: string[];
  failureActions: string[];
}

export interface WorkflowTrigger {
  type: 'completion' | 'error' | 'timeout' | 'manual';
  condition: string;
  action: string;
}

// Monitoring and analytics types
export interface ExecutionMetrics {
  sessionId: string;
  agentId: string;
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  taskQueue: number;
  responseTime: number;
  errorRate: number;
}

export interface AgentPerformance {
  agentId: string;
  totalTasks: number;
  successRate: number;
  averageExecutionTime: number;
  averageResponseTime: number;
  specializations: string[];
  collaborationScore: number;
}

// Shared workspace types
export interface WorkspaceEvent {
  id: string;
  type: 'file_created' | 'file_modified' | 'file_deleted' | 'conflict_detected' | 'merge_completed';
  sessionId: string;
  agentId: string;
  timestamp: Date;
  filePath: string;
  metadata?: Record<string, any>;
}

export interface ConflictResolution {
  id: string;
  sessionId: string;
  filePath: string;
  conflictingAgents: string[];
  resolutionStrategy: 'auto_merge' | 'manual_review' | 'agent_priority' | 'latest_wins';
  status: 'pending' | 'resolved' | 'escalated';
  resolution?: string;
}

// Execution engine types
export interface ExecutionProgress {
  sessionId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeAgents: string[];
  currentPhase: string;
  estimatedCompletion?: Date;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
  instanceId: string;
}
