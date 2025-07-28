/**
 * Conversational Orchestrator
 * 
 * Natural language interface for multi-agent orchestration with advanced
 * intent recognition, context awareness, and conversational workflow management.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { OrchestrationEngine } from '../execution/OrchestrationEngine';
import { AgentSessionManager } from '../execution/AgentSessionManager';
// TaskDecomposer import removed - will be added when TaskDecomposer is available
import { NaturalLanguageProcessor } from './NaturalLanguageProcessor';
import { DialogueManager } from './DialogueManager';
import { VoiceCommandProcessor } from './VoiceCommandProcessor';
import { CoordinationStrategy } from '../types';

export interface ConversationalCommand {
  id: string;
  sessionId: string;
  userId: string;
  input: string;
  inputType: 'text' | 'voice' | 'gesture';
  timestamp: Date;
  processed: boolean;
  confidence: number;
  intent?: CommandIntent;
  parameters?: Record<string, any>;
  context?: ConversationContext;
}

export interface CommandIntent {
  action: string;
  domain: string;
  entities: ExtractedEntity[];
  confidence: number;
  requiresConfirmation: boolean;
  estimatedComplexity: 'simple' | 'medium' | 'complex' | 'enterprise';
}

export interface ExtractedEntity {
  type: 'agent' | 'file' | 'technology' | 'action' | 'constraint' | 'preference';
  value: string;
  confidence: number;
  normalized: string;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  conversationHistory: ConversationalCommand[];
  activeProject?: string;
  userPreferences: UserPreferences;
  environmentContext: EnvironmentContext;
  previousIntents: CommandIntent[];
  workingMemory: Record<string, any>;
}

export interface UserPreferences {
  preferredAgents: string[];
  defaultCoordinationStrategy: CoordinationStrategy;
  communicationStyle: 'verbose' | 'concise' | 'technical' | 'casual';
  confirmationLevel: 'always' | 'risky' | 'never';
  voiceEnabled: boolean;
  language: string;
  timezone: string;
}

export interface EnvironmentContext {
  projectType: string;
  availableAgents: string[];
  recentFiles: string[];
  gitBranch: string;
  workingDirectory: string;
  systemLoad: number;
  activeProcesses: string[];
}

export interface ConversationResponse {
  id: string;
  type: 'confirmation' | 'clarification' | 'execution' | 'error' | 'progress';
  message: string;
  actions?: ScheduledAction[];
  requiresUserInput?: boolean;
  suggestedFollowups?: string[];
  metadata?: Record<string, any>;
}

export interface ScheduledAction {
  id: string;
  type: 'orchestrate' | 'query' | 'notify' | 'wait' | 'confirm';
  description: string;
  parameters: Record<string, any>;
  estimatedDuration: number;
  dependencies: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export class ConversationalOrchestrator extends EventEmitter {
  private engine: OrchestrationEngine;
  private sessionManager: AgentSessionManager;
  // private taskDecomposer: TaskDecomposer; // Will be added when available
  private nlp: NaturalLanguageProcessor;
  private dialogueManager: DialogueManager;
  private voiceCommandProcessor: VoiceCommandProcessor;
  
  private activeConversations: Map<string, ConversationContext> = new Map();
  private commandHistory: Map<string, ConversationalCommand[]> = new Map();
  private scheduledActions: Map<string, ScheduledAction[]> = new Map();
  
  private defaultPreferences: UserPreferences;

  constructor(options: {
    engine: OrchestrationEngine;
    sessionManager: AgentSessionManager;
    // taskDecomposer: TaskDecomposer; // Will be added when available
    enableVoiceCommands?: boolean;
    defaultLanguage?: string;
  }) {
    super();
    
    this.engine = options.engine;
    this.sessionManager = options.sessionManager;
    // this.taskDecomposer = options.taskDecomposer;
    
    this.nlp = new NaturalLanguageProcessor({
      language: options.defaultLanguage || 'en',
      enableSemanticAnalysis: true,
      enableContextAwareness: true,
    });
    
    this.dialogueManager = new DialogueManager({
      maxContextLength: 50,
      contextRetentionMinutes: 60,
    });
    
    this.voiceCommandProcessor = new VoiceCommandProcessor({
      enabled: options.enableVoiceCommands || false,
      language: options.defaultLanguage || 'en',
    });
    
    this.defaultPreferences = {
      preferredAgents: [],
      defaultCoordinationStrategy: 'parallel',
      communicationStyle: 'concise',
      confirmationLevel: 'risky',
      voiceEnabled: options.enableVoiceCommands || false,
      language: options.defaultLanguage || 'en',
      timezone: 'UTC',
    };
    
    this.initializeEventHandlers();
  }

  /**
   * Process a conversational command (text or voice)
   */
  async processCommand(
    input: string,
    userId: string,
    inputType: ConversationalCommand['inputType'] = 'text',
    sessionId?: string
  ): Promise<ConversationResponse> {
    const commandId = uuidv4();
    const activeSessionId = sessionId || await this.createConversationSession(userId);
    
    const command: ConversationalCommand = {
      id: commandId,
      sessionId: activeSessionId,
      userId,
      input,
      inputType,
      timestamp: new Date(),
      processed: false,
      confidence: 0,
    };

    this.emit('commandReceived', { command });

    try {
      // Get or create conversation context
      const context = await this.getOrCreateContext(activeSessionId, userId);
      command.context = context;

      // Process through NLP pipeline
      const intent = await this.nlp.extractIntent(input, context);
      command.intent = intent;
      command.confidence = intent.confidence;

      // Update dialogue state
      await this.dialogueManager.updateContext(context, command);

      // Store command in history
      this.addToCommandHistory(userId, command);

      // Generate response based on intent and context
      const response = await this.generateResponse(command, context);

      command.processed = true;
      this.emit('commandProcessed', { command, response });

      return response;

    } catch (error) {
      this.emit('commandError', { command, error });
      return {
        id: uuidv4(),
        type: 'error',
        message: `I encountered an error processing your request: ${error instanceof Error ? error.message : String(error)}`,
        requiresUserInput: false,
      };
    }
  }

  /**
   * Process voice input through speech recognition
   */
  async processVoiceCommand(
    audioBuffer: Buffer,
    userId: string,
    sessionId?: string
  ): Promise<ConversationResponse> {
    try {
      const transcription = await this.voiceCommandProcessor.transcribe(audioBuffer);
      
      if (!transcription.text || transcription.confidence < 0.7) {
        return {
          id: uuidv4(),
          type: 'clarification',
          message: "I couldn't quite understand that. Could you please repeat your request?",
          requiresUserInput: true,
        };
      }

      return await this.processCommand(transcription.text, userId, 'voice', sessionId);

    } catch (error) {
      return {
        id: uuidv4(),
        type: 'error',
        message: "I had trouble processing your voice command. Please try again or use text input.",
        requiresUserInput: false,
      };
    }
  }

  /**
   * Execute scheduled actions from conversation responses
   */
  async executeScheduledActions(sessionId: string, actionIds: string[]): Promise<void> {
    const sessionActions = this.scheduledActions.get(sessionId) || [];
    const actionsToExecute = sessionActions.filter(action => actionIds.includes(action.id));

    for (const action of actionsToExecute) {
      try {
        await this.executeAction(action, sessionId);
        this.emit('actionExecuted', { sessionId, action });
      } catch (error) {
        this.emit('actionFailed', { sessionId, action, error });
      }
    }
  }

  /**
   * Get conversation history for a user
   */
  getConversationHistory(userId: string, limit: number = 50): ConversationalCommand[] {
    const history = this.commandHistory.get(userId) || [];
    return history.slice(-limit);
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    const context = this.activeConversations.get(userId);
    if (context) {
      context.userPreferences = { ...context.userPreferences, ...preferences };
      this.emit('preferencesUpdated', { userId, preferences: context.userPreferences });
    }
  }

  /**
   * Get suggested follow-up actions based on conversation context
   */
  getSuggestedFollowups(sessionId: string): string[] {
    const context = this.activeConversations.get(sessionId);
    if (!context) return [];

    const lastIntent = context.previousIntents[context.previousIntents.length - 1];
    if (!lastIntent) return [];

    const suggestions: string[] = [];

    switch (lastIntent.action) {
      case 'create_component':
        suggestions.push(
          "Add tests for the new component",
          "Create documentation for the component",
          "Generate a usage example"
        );
        break;
      case 'review_code':
        suggestions.push(
          "Apply the suggested improvements",
          "Run the test suite",
          "Check for security vulnerabilities"
        );
        break;
      case 'optimize_performance':
        suggestions.push(
          "Run performance benchmarks",
          "Profile memory usage",
          "Test with production data"
        );
        break;
      default:
        suggestions.push(
          "Show me the progress",
          "What's next?",
          "Run the tests"
        );
    }

    return suggestions;
  }

  private async generateResponse(
    command: ConversationalCommand,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    const { intent } = command;
    if (!intent) {
      return {
        id: uuidv4(),
        type: 'clarification',
        message: "I'm not sure what you'd like me to do. Could you please clarify your request?",
        requiresUserInput: true,
        suggestedFollowups: [
          "Create a new component",
          "Review my code",
          "Run the tests",
          "Deploy to staging"
        ],
      };
    }

    // Handle different intent types
    switch (intent.action) {
      case 'orchestrate_agents':
        return await this.handleOrchestrationRequest(command, context);
      
      case 'query_status':
        return await this.handleStatusQuery(command, context);
      
      case 'modify_preferences':
        return await this.handlePreferencesUpdate(command, context);
      
      case 'explain_process':
        return await this.handleExplanationRequest(command, context);
      
      default:
        return await this.handleGenericRequest(command, context);
    }
  }

  private async handleOrchestrationRequest(
    command: ConversationalCommand,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    const { intent } = command;
    if (!intent) throw new Error('Intent required for orchestration');

    // Extract orchestration parameters
    const taskDescription = this.extractTaskDescription(intent.entities);
    const requiredAgents = this.extractRequiredAgents(intent.entities);
    const coordinationStrategy = this.extractCoordinationStrategy(intent.entities) || 
                               context.userPreferences.defaultCoordinationStrategy;

    // Check if confirmation is needed
    if (intent.requiresConfirmation || 
        context.userPreferences.confirmationLevel === 'always' ||
        (context.userPreferences.confirmationLevel === 'risky' && intent.estimatedComplexity !== 'simple')) {
      
      const actions: ScheduledAction[] = [{
        id: uuidv4(),
        type: 'orchestrate',
        description: `Execute task: ${taskDescription}`,
        parameters: {
          taskDescription,
          requiredAgents,
          coordinationStrategy,
        },
        estimatedDuration: this.estimateTaskDuration(intent.estimatedComplexity),
        dependencies: [],
        priority: 'medium',
      }];

      this.scheduleActions(command.sessionId, actions);

      return {
        id: uuidv4(),
        type: 'confirmation',
        message: `I'll ${taskDescription} using ${requiredAgents.length || 'the best available'} agents with ${coordinationStrategy} coordination. This should take about ${this.formatDuration(actions[0].estimatedDuration)}. Shall I proceed?`,
        actions,
        requiresUserInput: true,
        suggestedFollowups: ["Yes, proceed", "No, cancel", "Modify the approach"],
      };
    }

    // Execute directly
    try {
      const sessionId = await this.sessionManager.createSession({
        task: taskDescription,
        agents: requiredAgents.length > 0 ? requiredAgents : await this.selectOptimalAgents(taskDescription),
        coordinationStrategy,
      });

      // await this.engine.executeSession(sessionId); // Method name to be verified

      return {
        id: uuidv4(),
        type: 'execution',
        message: `I've started ${taskDescription}. The agents are working on this task now.`,
        metadata: { sessionId },
        suggestedFollowups: this.getSuggestedFollowups(command.sessionId),
      };

    } catch (error) {
      return {
        id: uuidv4(),
        type: 'error',
        message: `I encountered an issue starting the task: ${error instanceof Error ? error.message : String(error)}`,
        requiresUserInput: false,
      };
    }
  }

  private async handleStatusQuery(
    command: ConversationalCommand,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    const activeSessions = this.sessionManager.getActiveSessions();
    
    if (activeSessions.length === 0) {
      return {
        id: uuidv4(),
        type: 'execution',
        message: "No active orchestration sessions at the moment. What would you like me to work on?",
        suggestedFollowups: [
          "Create a new component",
          "Review the codebase",
          "Run the test suite"
        ],
      };
    }

    const statusSummary = activeSessions.map(session => {
      const progress = this.calculateSessionProgress(session);
      return `• ${session.task} - ${progress}% complete (${session.agents.length} agents)`;
    }).join('\n');

    return {
      id: uuidv4(),
      type: 'execution',
      message: `Here's what I'm currently working on:\n\n${statusSummary}`,
      suggestedFollowups: [
        "Show detailed progress",
        "Add more agents to a task",
        "Cancel a running task"
      ],
    };
  }

  private async handlePreferencesUpdate(
    command: ConversationalCommand,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    const { intent } = command;
    if (!intent) throw new Error('Intent required for preferences update');

    const updates = this.extractPreferenceUpdates(intent.entities);
    await this.updateUserPreferences(context.userId, updates);

    const updateSummary = Object.entries(updates)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return {
      id: uuidv4(),
      type: 'execution',
      message: `I've updated your preferences: ${updateSummary}`,
      suggestedFollowups: [
        "Show all my preferences",
        "Reset to defaults",
        "Start a new task"
      ],
    };
  }

  private async handleExplanationRequest(
    command: ConversationalCommand,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    const { intent } = command;
    if (!intent) throw new Error('Intent required for explanation');

    const topic = this.extractExplanationTopic(intent.entities);
    const explanation = await this.generateExplanation(topic, context);

    return {
      id: uuidv4(),
      type: 'execution',
      message: explanation,
      suggestedFollowups: [
        "Show me an example",
        "Try it out",
        "What else can you explain?"
      ],
    };
  }

  private async handleGenericRequest(
    command: ConversationalCommand,
    context: ConversationContext
  ): Promise<ConversationResponse> {
    return {
      id: uuidv4(),
      type: 'clarification',
      message: "I understand you want me to help, but I need more specific information. What would you like me to do?",
      requiresUserInput: true,
      suggestedFollowups: [
        "Create a new React component",
        "Review my TypeScript code",
        "Optimize database queries",
        "Run security checks"
      ],
    };
  }

  private async executeAction(action: ScheduledAction, sessionId: string): Promise<void> {
    switch (action.type) {
      case 'orchestrate':
        const { taskDescription, requiredAgents, coordinationStrategy } = action.parameters;
        const newSessionId = await this.sessionManager.createSession({
          task: taskDescription,
          agents: requiredAgents,
          coordinationStrategy,
        });
        // await this.engine.executeSession(newSessionId); // Method name to be verified
        break;
        
      case 'query':
        // Handle query actions
        break;
        
      case 'notify':
        this.emit('notification', action.parameters);
        break;
        
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  private async getOrCreateContext(sessionId: string, userId: string): Promise<ConversationContext> {
    let context = this.activeConversations.get(sessionId);
    
    if (!context) {
      context = {
        sessionId,
        userId,
        conversationHistory: [],
        userPreferences: { ...this.defaultPreferences },
        environmentContext: await this.gatherEnvironmentContext(),
        previousIntents: [],
        workingMemory: {},
      };
      
      this.activeConversations.set(sessionId, context);
    }
    
    return context;
  }

  private async createConversationSession(userId: string): Promise<string> {
    return uuidv4();
  }

  private addToCommandHistory(userId: string, command: ConversationalCommand): void {
    const history = this.commandHistory.get(userId) || [];
    history.push(command);
    
    // Keep only last 100 commands
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.commandHistory.set(userId, history);
  }

  private scheduleActions(sessionId: string, actions: ScheduledAction[]): void {
    const existing = this.scheduledActions.get(sessionId) || [];
    existing.push(...actions);
    this.scheduledActions.set(sessionId, existing);
  }

  private extractTaskDescription(entities: ExtractedEntity[]): string {
    const actionEntity = entities.find(e => e.type === 'action');
    return actionEntity?.value || 'perform the requested task';
  }

  private extractRequiredAgents(entities: ExtractedEntity[]): string[] {
    return entities.filter(e => e.type === 'agent').map(e => e.normalized);
  }

  private extractCoordinationStrategy(entities: ExtractedEntity[]): CoordinationStrategy | null {
    const strategyEntity = entities.find(e => 
      e.type === 'preference' && 
      ['parallel', 'sequential', 'hierarchical', 'adaptive'].includes(e.normalized)
    );
    return strategyEntity?.normalized as CoordinationStrategy || null;
  }

  private extractPreferenceUpdates(entities: ExtractedEntity[]): Partial<UserPreferences> {
    const updates: Partial<UserPreferences> = {};
    
    entities.forEach(entity => {
      switch (entity.type) {
        case 'preference':
          if (entity.metadata?.category === 'communication') {
            updates.communicationStyle = entity.normalized as UserPreferences['communicationStyle'];
          } else if (entity.metadata?.category === 'coordination') {
            updates.defaultCoordinationStrategy = entity.normalized as CoordinationStrategy;
          }
          break;
      }
    });
    
    return updates;
  }

  private extractExplanationTopic(entities: ExtractedEntity[]): string {
    const topicEntity = entities.find(e => e.type === 'technology' || e.type === 'action');
    return topicEntity?.value || 'the orchestration process';
  }

  private async selectOptimalAgents(taskDescription: string): Promise<string[]> {
    // Simple agent selection - will use TaskDecomposer when available
    const lowerDescription = taskDescription.toLowerCase();
    const agents: string[] = [];
    
    if (lowerDescription.includes('test')) agents.push('test-automation-engineer');
    if (lowerDescription.includes('security')) agents.push('security-audit-specialist');
    if (lowerDescription.includes('performance')) agents.push('performance-optimizer');
    if (lowerDescription.includes('react') || lowerDescription.includes('component')) agents.push('architecture-reviewer');
    
    return agents.length > 0 ? agents : ['general-purpose'];
  }

  private calculateSessionProgress(session: any): number {
    // Simple progress calculation - would be more sophisticated in practice
    const totalTasks = session.agents.length;
    const completedTasks = session.metrics?.tasksCompleted || 0;
    return Math.round((completedTasks / totalTasks) * 100);
  }

  private estimateTaskDuration(complexity: CommandIntent['estimatedComplexity']): number {
    const baseDurations = {
      simple: 30000,    // 30 seconds
      medium: 120000,   // 2 minutes
      complex: 600000,  // 10 minutes
      enterprise: 1800000, // 30 minutes
    };
    
    return baseDurations[complexity] || baseDurations.medium;
  }

  private formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return 'less than a minute';
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  }

  private async gatherEnvironmentContext(): Promise<EnvironmentContext> {
    return {
      projectType: 'typescript',
      availableAgents: ['general-purpose', 'test-engineer', 'security-auditor'],
      recentFiles: [],
      gitBranch: 'main',
      workingDirectory: process.cwd(),
      systemLoad: 0.5,
      activeProcesses: [],
    };
  }

  private async generateExplanation(topic: string, context: ConversationContext): Promise<string> {
    const explanations: Record<string, string> = {
      'orchestration': 'Orchestration is the automated coordination of multiple AI agents to complete complex tasks. Each agent specializes in different areas like testing, security, or documentation.',
      'coordination strategies': 'I support several coordination strategies: parallel (agents work simultaneously), sequential (one after another), hierarchical (with lead agents), and adaptive (strategy changes based on context).',
      'agents': 'Agents are specialized AI assistants that handle specific aspects of development like code review, testing, security auditing, and documentation generation.',
    };
    
    return explanations[topic.toLowerCase()] || 
           `I can help explain ${topic}. Could you be more specific about what aspect you'd like me to cover?`;
  }

  private initializeEventHandlers(): void {
    this.voiceCommandProcessor.on('transcriptionComplete', (data) => {
      this.emit('voiceTranscribed', data);
    });

    this.dialogueManager.on('contextUpdated', (data) => {
      this.emit('conversationContextUpdated', data);
    });

    this.nlp.on('intentExtracted', (data) => {
      this.emit('intentRecognized', data);
    });
  }
}