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

export type CoordinationStrategy = 'parallel' | 'sequential' | 'phased_parallel';

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
  path: string;
  branch: string;
  agentId: string;
  created: Date;
  status: 'active' | 'completed' | 'error';
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
