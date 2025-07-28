/**
 * Dialogue Manager
 * 
 * Manages conversation state, context awareness, and dialogue flow for
 * natural conversational interactions with the orchestration system.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ConversationContext, ConversationalCommand } from './ConversationalOrchestrator';

export interface DialogueManagerOptions {
  maxContextLength: number;
  contextRetentionMinutes: number;
  enablePersonalization?: boolean;
  enableEmotionalTracking?: boolean;
}

export interface DialogueState {
  phase: 'greeting' | 'task_definition' | 'parameter_gathering' | 'confirmation' | 'execution' | 'feedback';
  completeness: number;
  missingInformation: string[];
  confidenceLevel: number;
  nextExpectedInput: string[];
  conversationFlow: ConversationFlowNode[];
}

export interface ConversationFlowNode {
  id: string;
  type: 'question' | 'confirmation' | 'information' | 'action' | 'branch';
  content: string;
  options?: string[];
  conditions?: Record<string, any>;
  nextNodes: string[];
  visited: boolean;
  timestamp: Date;
}

export interface PersonalityProfile {
  userId: string;
  communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly';
  preferredDetailLevel: 'minimal' | 'standard' | 'detailed' | 'comprehensive';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  domainKnowledge: Record<string, number>; // domain -> proficiency (0-1)
  responsePatterns: string[];
  frequentRequests: string[];
  timePreferences: {
    timezone: string;
    preferredHours: number[];
    workingDays: number[];
  };
}

export interface EmotionalState {
  sentiment: 'frustrated' | 'confused' | 'satisfied' | 'excited' | 'neutral';
  confidence: number;
  engagement: number;
  patience: number;
  satisfaction: number;
  indicators: string[];
}

export class DialogueManager extends EventEmitter {
  private options: DialogueManagerOptions;
  private dialogueStates: Map<string, DialogueState> = new Map();
  private personalityProfiles: Map<string, PersonalityProfile> = new Map();
  private emotionalStates: Map<string, EmotionalState> = new Map();
  private conversationFlows: Map<string, Map<string, ConversationFlowNode>> = new Map();
  
  private contextCleanupInterval?: NodeJS.Timeout;

  constructor(options: DialogueManagerOptions) {
    super();
    this.options = {
      enablePersonalization: true,
      enableEmotionalTracking: true,
      ...options,
    };
    
    this.startContextCleanup();
  }

  /**
   * Update conversation context with new command
   */
  async updateContext(
    context: ConversationContext,
    command: ConversationalCommand
  ): Promise<void> {
    // Add command to conversation history
    context.conversationHistory.push(command);
    
    // Trim history if too long
    if (context.conversationHistory.length > this.options.maxContextLength) {
      context.conversationHistory = context.conversationHistory.slice(-this.options.maxContextLength);
    }
    
    // Update dialogue state
    const dialogueState = await this.updateDialogueState(context, command);
    this.dialogueStates.set(context.sessionId, dialogueState);
    
    // Update working memory
    await this.updateWorkingMemory(context, command);
    
    // Track emotional state if enabled
    if (this.options.enableEmotionalTracking) {
      await this.updateEmotionalState(context, command);
    }
    
    // Update personality profile if enabled
    if (this.options.enablePersonalization) {
      await this.updatePersonalityProfile(context, command);
    }
    
    this.emit('contextUpdated', { context, command, dialogueState });
  }

  /**
   * Get current dialogue state for a session
   */
  getDialogueState(sessionId: string): DialogueState | undefined {
    return this.dialogueStates.get(sessionId);
  }

  /**
   * Get personality profile for a user
   */
  getPersonalityProfile(userId: string): PersonalityProfile | undefined {
    return this.personalityProfiles.get(userId);
  }

  /**
   * Get emotional state for a user
   */
  getEmotionalState(userId: string): EmotionalState | undefined {
    return this.emotionalStates.get(userId);
  }

  /**
   * Generate contextually appropriate response based on dialogue state
   */
  async generateContextualResponse(
    context: ConversationContext,
    baseResponse: string
  ): Promise<string> {
    const dialogueState = this.getDialogueState(context.sessionId);
    const personalityProfile = this.getPersonalityProfile(context.userId);
    const emotionalState = this.getEmotionalState(context.userId);
    
    let adaptedResponse = baseResponse;
    
    // Adapt based on personality profile
    if (personalityProfile) {
      adaptedResponse = this.adaptResponseToPersonality(adaptedResponse, personalityProfile);
    }
    
    // Adapt based on emotional state
    if (emotionalState) {
      adaptedResponse = this.adaptResponseToEmotion(adaptedResponse, emotionalState);
    }
    
    // Adapt based on dialogue state
    if (dialogueState) {
      adaptedResponse = this.adaptResponseToDialogueState(adaptedResponse, dialogueState);
    }
    
    return adaptedResponse;
  }

  /**
   * Suggest next best questions or actions based on context
   */
  suggestNextInteraction(context: ConversationContext): string[] {
    const dialogueState = this.getDialogueState(context.sessionId);
    const personalityProfile = this.getPersonalityProfile(context.userId);
    
    if (!dialogueState) {
      return ['What would you like me to help you with?'];
    }
    
    const suggestions: string[] = [];
    
    // Based on dialogue phase
    switch (dialogueState.phase) {
      case 'greeting':
        suggestions.push(
          'What would you like me to work on today?',
          'Do you need help with any specific project?',
          'Should I continue where we left off?'
        );
        break;
        
      case 'task_definition':
        if (dialogueState.missingInformation.includes('task_type')) {
          suggestions.push(
            'What type of task would you like me to perform?',
            'Are you looking to create, review, or optimize something?'
          );
        }
        if (dialogueState.missingInformation.includes('scope')) {
          suggestions.push(
            'What\'s the scope of this task?',
            'Should this be a quick fix or a comprehensive solution?'
          );
        }
        break;
        
      case 'parameter_gathering':
        suggestions.push(...this.generateParameterQuestions(dialogueState));
        break;
        
      case 'confirmation':
        suggestions.push(
          'Does this plan look good to you?',
          'Should I proceed with this approach?',
          'Would you like me to modify anything?'
        );
        break;
        
      case 'execution':
        suggestions.push(
          'The task is in progress. Would you like status updates?',
          'Is there anything else I should work on while this runs?'
        );
        break;
        
      case 'feedback':
        suggestions.push(
          'How did that work out?',
          'Is there anything you\'d like me to improve?',
          'What should we work on next?'
        );
        break;
    }
    
    // Personalize suggestions based on user profile
    if (personalityProfile) {
      return this.personalizeInteractionSuggestions(suggestions, personalityProfile);
    }
    
    return suggestions.slice(0, 3); // Limit to top 3
  }

  /**
   * Detect if user is confused or needs help
   */
  detectConfusionOrHelpNeeded(context: ConversationContext): {
    needsHelp: boolean;
    reason: string;
    suggestions: string[];
  } {
    const recentCommands = context.conversationHistory.slice(-5);
    const emotionalState = this.getEmotionalState(context.userId);
    
    // Check for confusion indicators
    const confusionIndicators = [
      'i don\'t understand',
      'what do you mean',
      'how do i',
      'confused',
      'help',
      'explain',
      'what\'s that',
      'unclear'
    ];
    
    const hasConfusionWords = recentCommands.some(cmd =>
      confusionIndicators.some(indicator =>
        cmd.input.toLowerCase().includes(indicator)
      )
    );
    
    // Check for repeated similar requests
    const recentInputs = recentCommands.map(cmd => cmd.input.toLowerCase());
    const hasRepeatedRequests = recentInputs.length > 2 && 
      recentInputs.slice(-3).every(input => 
        this.calculateSimilarity(input, recentInputs[recentInputs.length - 1]) > 0.7
      );
    
    // Check emotional indicators
    const emotionallyFrustrated = emotionalState?.sentiment === 'frustrated' || 
                                  emotionalState?.sentiment === 'confused';
    
    if (hasConfusionWords || hasRepeatedRequests || emotionallyFrustrated) {
      return {
        needsHelp: true,
        reason: hasConfusionWords ? 'confusion_detected' :
                hasRepeatedRequests ? 'repeated_requests' :
                'emotional_frustration',
        suggestions: [
          'Let me explain how the orchestration system works',
          'Would you like to see some examples of what I can do?',
          'Should we start with a simple task to get familiar?',
          'Would you prefer step-by-step guidance?'
        ]
      };
    }
    
    return {
      needsHelp: false,
      reason: 'no_issues_detected',
      suggestions: []
    };
  }

  /**
   * Learn from successful conversation patterns
   */
  async learnFromSuccessfulInteraction(
    context: ConversationContext,
    successMetrics: {
      taskCompleted: boolean;
      userSatisfaction: number;
      interactionEfficiency: number;
    }
  ): Promise<void> {
    if (!this.options.enablePersonalization) return;
    
    const profile = this.getPersonalityProfile(context.userId) || 
                   await this.createPersonalityProfile(context.userId);
    
    // Update successful patterns
    const conversationPattern = this.extractConversationPattern(context);
    profile.responsePatterns.push(conversationPattern);
    
    // Update domain knowledge based on successful tasks
    if (successMetrics.taskCompleted) {
      const domains = this.extractDomainsFromConversation(context);
      domains.forEach(domain => {
        profile.domainKnowledge[domain] = Math.min(1.0, 
          (profile.domainKnowledge[domain] || 0) + 0.1
        );
      });
    }
    
    // Update communication preferences
    if (successMetrics.userSatisfaction > 0.8) {
      this.reinforceSuccessfulCommunicationStyle(profile, context);
    }
    
    this.personalityProfiles.set(context.userId, profile);
    this.emit('personalityUpdated', { userId: context.userId, profile });
  }

  private async updateDialogueState(
    context: ConversationContext,
    command: ConversationalCommand
  ): Promise<DialogueState> {
    const existingState = this.dialogueStates.get(context.sessionId);
    
    if (!existingState) {
      return this.createInitialDialogueState(context, command);
    }
    
    // Update state based on command intent and current phase
    const updatedState = { ...existingState };
    
    // Advance dialogue phase if appropriate
    updatedState.phase = this.determineNextPhase(existingState, command);
    
    // Update completeness
    updatedState.completeness = this.calculateCompleteness(updatedState, command);
    
    // Update missing information
    updatedState.missingInformation = this.identifyMissingInformation(updatedState, command);
    
    // Update confidence level
    updatedState.confidenceLevel = this.calculateConfidenceLevel(updatedState, command);
    
    // Update expected inputs
    updatedState.nextExpectedInput = this.predictNextInputs(updatedState);
    
    return updatedState;
  }

  private async updateWorkingMemory(
    context: ConversationContext,
    command: ConversationalCommand
  ): Promise<void> {
    // Extract and store key information in working memory
    if (command.intent) {
      context.workingMemory.lastIntent = command.intent;
      context.workingMemory.lastAction = command.intent.action;
      context.workingMemory.lastDomain = command.intent.domain;
      
      // Store entities
      if (command.intent.entities.length > 0) {
        command.intent.entities.forEach(entity => {
          const key = `last_${entity.type}`;
          context.workingMemory[key] = entity.normalized;
        });
      }
    }
    
    // Maintain conversation topics
    const topics = context.workingMemory.topics || [];
    const currentTopic = this.extractTopicFromCommand(command);
    if (currentTopic && !topics.includes(currentTopic)) {
      topics.push(currentTopic);
      context.workingMemory.topics = topics.slice(-5); // Keep last 5 topics
    }
  }

  private async updateEmotionalState(
    context: ConversationContext,
    command: ConversationalCommand
  ): Promise<void> {
    const existingState = this.emotionalStates.get(context.userId) || {
      sentiment: 'neutral',
      confidence: 0.5,
      engagement: 0.5,
      patience: 0.8,
      satisfaction: 0.5,
      indicators: [],
    };
    
    // Analyze emotional indicators in the command
    const emotionalIndicators = this.extractEmotionalIndicators(command.input);
    
    // Update sentiment
    existingState.sentiment = this.determineSentiment(command.input, existingState);
    
    // Update engagement level
    existingState.engagement = this.calculateEngagement(command, context);
    
    // Update patience (decreases with repeated requests or confusion)
    existingState.patience = this.calculatePatience(command, context, existingState);
    
    // Update confidence in the system
    if (command.confidence && command.confidence < 0.5) {
      existingState.confidence = Math.max(0, existingState.confidence - 0.1);
    } else if (command.processed) {
      existingState.confidence = Math.min(1, existingState.confidence + 0.05);
    }
    
    existingState.indicators = emotionalIndicators;
    
    this.emotionalStates.set(context.userId, existingState);
  }

  private async updatePersonalityProfile(
    context: ConversationContext,
    command: ConversationalCommand
  ): Promise<void> {
    let profile = this.personalityProfiles.get(context.userId);
    
    if (!profile) {
      profile = await this.createPersonalityProfile(context.userId);
    }
    
    // Update communication style based on user's language patterns
    profile.communicationStyle = this.inferCommunicationStyle(command.input, profile);
    
    // Update preferred detail level
    profile.preferredDetailLevel = this.inferDetailPreference(command.input, context);
    
    // Update expertise level based on technical terminology usage
    profile.expertiseLevel = this.inferExpertiseLevel(command.input, profile);
    
    // Track frequent requests
    const requestType = this.categorizeRequest(command);
    if (requestType) {
      profile.frequentRequests.push(requestType);
      // Keep only last 20 requests
      profile.frequentRequests = profile.frequentRequests.slice(-20);
    }
    
    this.personalityProfiles.set(context.userId, profile);
  }

  private createInitialDialogueState(
    context: ConversationContext,
    command: ConversationalCommand
  ): DialogueState {
    return {
      phase: command.intent?.action ? 'task_definition' : 'greeting',
      completeness: command.intent ? 0.3 : 0.1,
      missingInformation: this.identifyInitialMissingInfo(command),
      confidenceLevel: command.confidence || 0.5,
      nextExpectedInput: ['task description', 'clarification', 'confirmation'],
      conversationFlow: [],
    };
  }

  private determineNextPhase(
    currentState: DialogueState,
    command: ConversationalCommand
  ): DialogueState['phase'] {
    const phaseTransitions: Record<DialogueState['phase'], DialogueState['phase'][]> = {
      'greeting': ['task_definition'],
      'task_definition': ['parameter_gathering', 'confirmation'],
      'parameter_gathering': ['confirmation', 'parameter_gathering'],
      'confirmation': ['execution', 'parameter_gathering'],
      'execution': ['feedback', 'task_definition'],
      'feedback': ['task_definition', 'greeting'],
    };
    
    // Logic to determine phase transitions based on command content
    if (command.intent?.action === 'orchestrate_agents' && currentState.completeness > 0.7) {
      return 'confirmation';
    }
    
    if (command.input.toLowerCase().includes('yes') || command.input.toLowerCase().includes('proceed')) {
      return 'execution';
    }
    
    if (command.input.toLowerCase().includes('no') || command.input.toLowerCase().includes('cancel')) {
      return 'task_definition';
    }
    
    // Default progression
    const possibleNext = phaseTransitions[currentState.phase];
    return possibleNext[0] || currentState.phase;
  }

  private calculateCompleteness(
    state: DialogueState,
    command: ConversationalCommand
  ): number {
    let completeness = state.completeness;
    
    // Increase completeness based on information gathered
    if (command.intent?.entities.length) {
      completeness += command.intent.entities.length * 0.1;
    }
    
    // Decrease if missing critical information
    completeness -= state.missingInformation.length * 0.05;
    
    return Math.max(0, Math.min(1, completeness));
  }

  private identifyMissingInformation(
    state: DialogueState,
    command: ConversationalCommand
  ): string[] {
    const missing: string[] = [];
    
    if (state.phase === 'task_definition') {
      if (!command.intent?.action) missing.push('task_type');
      if (!command.intent?.entities.some(e => e.type === 'technology')) missing.push('technology');
    }
    
    if (state.phase === 'parameter_gathering') {
      if (!command.intent?.entities.some(e => e.type === 'agent')) missing.push('agents');
      if (!command.intent?.entities.some(e => e.type === 'preference')) missing.push('preferences');
    }
    
    return missing;
  }

  private calculateConfidenceLevel(
    state: DialogueState,
    command: ConversationalCommand
  ): number {
    let confidence = command.confidence || 0.5;
    
    // Boost confidence if dialogue is progressing well
    if (state.completeness > 0.7) confidence += 0.1;
    
    // Reduce confidence if there are many missing pieces
    confidence -= state.missingInformation.length * 0.05;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private predictNextInputs(state: DialogueState): string[] {
    const predictions: Record<DialogueState['phase'], string[]> = {
      'greeting': ['task request', 'question', 'greeting'],
      'task_definition': ['task details', 'clarification', 'technology specification'],
      'parameter_gathering': ['parameters', 'preferences', 'constraints'],
      'confirmation': ['yes/no', 'modifications', 'questions'],
      'execution': ['status inquiry', 'modifications', 'new task'],
      'feedback': ['satisfaction', 'follow-up', 'new task'],
    };
    
    return predictions[state.phase] || ['clarification'];
  }

  private adaptResponseToPersonality(
    response: string,
    profile: PersonalityProfile
  ): string {
    switch (profile.communicationStyle) {
      case 'formal':
        return response.replace(/\bI'll\b/g, 'I will')
                      .replace(/\bcan't\b/g, 'cannot')
                      .replace(/\bwon't\b/g, 'will not');
                      
      case 'casual':
        return response.replace(/\bI will\b/g, "I'll")
                      .replace(/\bcannot\b/g, "can't")
                      .replace(/\bdo not\b/g, "don't");
                      
      case 'technical':
        // Add more technical details
        return response + this.addTechnicalContext(response);
        
      case 'friendly':
        // Add encouraging language
        return this.addFriendlyTone(response);
        
      default:
        return response;
    }
  }

  private adaptResponseToEmotion(
    response: string,
    emotion: EmotionalState
  ): string {
    switch (emotion.sentiment) {
      case 'frustrated':
        return `I understand this might be frustrating. ${response} Let me know if you need me to explain anything differently.`;
        
      case 'confused':
        return `Let me clarify this for you. ${response} Feel free to ask if anything is unclear.`;
        
      case 'excited':
        return `Great! ${response} This should be fun to work on!`;
        
      default:
        return response;
    }
  }

  private adaptResponseToDialogueState(
    response: string,
    state: DialogueState
  ): string {
    if (state.confidenceLevel < 0.5) {
      return `${response} Please let me know if I've misunderstood anything.`;
    }
    
    if (state.missingInformation.length > 0) {
      const missing = state.missingInformation.join(', ');
      return `${response} I still need to know about: ${missing}.`;
    }
    
    return response;
  }

  private generateParameterQuestions(state: DialogueState): string[] {
    const questions: string[] = [];
    
    state.missingInformation.forEach(info => {
      switch (info) {
        case 'agents':
          questions.push('Which agents would you like me to use for this task?');
          break;
        case 'technology':
          questions.push('What technology stack are you working with?');
          break;
        case 'preferences':
          questions.push('Do you have any specific preferences for how this should be done?');
          break;
        case 'scope':
          questions.push('What\'s the scope of this task - is it a quick fix or a comprehensive solution?');
          break;
      }
    });
    
    return questions;
  }

  private personalizeInteractionSuggestions(
    suggestions: string[],
    profile: PersonalityProfile
  ): string[] {
    // Filter and reorder suggestions based on user's frequent requests and expertise
    const personalized = suggestions.map(suggestion => {
      if (profile.expertiseLevel === 'beginner') {
        return this.simplifyLanguage(suggestion);
      } else if (profile.expertiseLevel === 'expert') {
        return this.addTechnicalDepth(suggestion);
      }
      return suggestion;
    });
    
    return personalized.slice(0, 3);
  }

  private extractEmotionalIndicators(input: string): string[] {
    const indicators: string[] = [];
    const lowerInput = input.toLowerCase();
    
    const emotionalMarkers = {
      frustration: ['frustrated', 'annoying', 'terrible', 'awful', 'hate'],
      confusion: ['confused', 'unclear', "don't understand", 'what'],
      satisfaction: ['great', 'perfect', 'excellent', 'love', 'awesome'],
      excitement: ['excited', 'amazing', 'fantastic', 'brilliant'],
    };
    
    for (const [emotion, markers] of Object.entries(emotionalMarkers)) {
      if (markers.some(marker => lowerInput.includes(marker))) {
        indicators.push(emotion);
      }
    }
    
    return indicators;
  }

  private determineSentiment(
    input: string,
    currentState: EmotionalState
  ): EmotionalState['sentiment'] {
    const indicators = this.extractEmotionalIndicators(input);
    
    if (indicators.includes('frustration')) return 'frustrated';
    if (indicators.includes('confusion')) return 'confused';
    if (indicators.includes('satisfaction')) return 'satisfied';
    if (indicators.includes('excitement')) return 'excited';
    
    return currentState.sentiment; // Keep current if no clear indicators
  }

  private calculateEngagement(
    command: ConversationalCommand,
    context: ConversationContext
  ): number {
    let engagement = 0.5;
    
    // Higher engagement for longer, more detailed messages
    const wordCount = command.input.split(/\s+/).length;
    engagement += Math.min(0.3, wordCount / 50);
    
    // Higher engagement for technical terms
    const technicalTerms = this.countTechnicalTerms(command.input);
    engagement += Math.min(0.2, technicalTerms / 10);
    
    // Lower engagement if recent messages are short
    const recentMessages = context.conversationHistory.slice(-3);
    const avgRecentLength = recentMessages.reduce((sum, cmd) => 
      sum + cmd.input.split(/\s+/).length, 0) / recentMessages.length;
    
    if (avgRecentLength < 5) engagement -= 0.1;
    
    return Math.max(0, Math.min(1, engagement));
  }

  private calculatePatience(
    command: ConversationalCommand,
    context: ConversationContext,
    currentState: EmotionalState
  ): number {
    let patience = currentState.patience;
    
    // Decrease patience with repeated similar requests
    const recentSimilar = context.conversationHistory
      .slice(-5)
      .filter(cmd => this.calculateSimilarity(cmd.input, command.input) > 0.7);
    
    patience -= recentSimilar.length * 0.1;
    
    // Decrease patience with confusion indicators
    if (command.input.toLowerCase().includes("don't understand") ||
        command.input.toLowerCase().includes("confused")) {
      patience -= 0.15;
    }
    
    // Reset patience after successful interactions
    if (command.confidence && command.confidence > 0.8) {
      patience = Math.min(1, patience + 0.1);
    }
    
    return Math.max(0, Math.min(1, patience));
  }

  private async createPersonalityProfile(userId: string): Promise<PersonalityProfile> {
    return {
      userId,
      communicationStyle: 'casual',
      preferredDetailLevel: 'standard',
      expertiseLevel: 'intermediate',
      domainKnowledge: {},
      responsePatterns: [],
      frequentRequests: [],
      timePreferences: {
        timezone: 'UTC',
        preferredHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        workingDays: [1, 2, 3, 4, 5],
      },
    };
  }

  private inferCommunicationStyle(
    input: string,
    profile: PersonalityProfile
  ): PersonalityProfile['communicationStyle'] {
    const formalIndicators = ['please', 'could you', 'would you mind', 'i would appreciate'];
    const casualIndicators = ["can't", "won't", "i'll", "hey", "yeah"];
    const technicalIndicators = ['api', 'database', 'algorithm', 'refactor', 'optimize'];
    
    const lowerInput = input.toLowerCase();
    
    const formalCount = formalIndicators.filter(ind => lowerInput.includes(ind)).length;
    const casualCount = casualIndicators.filter(ind => lowerInput.includes(ind)).length;
    const technicalCount = technicalIndicators.filter(ind => lowerInput.includes(ind)).length;
    
    if (technicalCount > 2) return 'technical';
    if (formalCount > casualCount) return 'formal';
    if (casualCount > 0) return 'casual';
    
    return profile.communicationStyle; // Keep existing
  }

  private inferDetailPreference(
    input: string,
    context: ConversationContext
  ): PersonalityProfile['preferredDetailLevel'] {
    const detailIndicators = ['detailed', 'comprehensive', 'thorough', 'explain everything'];
    const minimalIndicators = ['quick', 'simple', 'brief', 'just do it'];
    
    const lowerInput = input.toLowerCase();
    
    if (detailIndicators.some(ind => lowerInput.includes(ind))) return 'detailed';
    if (minimalIndicators.some(ind => lowerInput.includes(ind))) return 'minimal';
    
    return 'standard';
  }

  private inferExpertiseLevel(
    input: string,
    profile: PersonalityProfile
  ): PersonalityProfile['expertiseLevel'] {
    const expertTerms = this.countTechnicalTerms(input);
    const beginnerIndicators = ['how do i', 'what is', 'explain', 'help me understand'];
    
    const lowerInput = input.toLowerCase();
    const hasBeginnerLanguage = beginnerIndicators.some(ind => lowerInput.includes(ind));
    
    if (expertTerms > 5 && !hasBeginnerLanguage) return 'expert';
    if (expertTerms > 2) return 'advanced';
    if (hasBeginnerLanguage) return 'beginner';
    
    return profile.expertiseLevel; // Keep existing
  }

  private categorizeRequest(command: ConversationalCommand): string | null {
    if (!command.intent) return null;
    
    return `${command.intent.domain}:${command.intent.action}`;
  }

  private identifyInitialMissingInfo(command: ConversationalCommand): string[] {
    const missing: string[] = [];
    
    if (!command.intent?.action) missing.push('task_type');
    if (!command.intent?.entities.some(e => e.type === 'technology')) missing.push('technology');
    if (!command.intent?.entities.some(e => e.type === 'file')) missing.push('target_files');
    
    return missing;
  }

  private extractTopicFromCommand(command: ConversationalCommand): string | null {
    if (command.intent?.domain) {
      return command.intent.domain;
    }
    
    // Extract topic from entities
    const techEntity = command.intent?.entities.find(e => e.type === 'technology');
    if (techEntity) return techEntity.normalized;
    
    return null;
  }

  private extractConversationPattern(context: ConversationContext): string {
    // Extract successful conversation pattern for learning
    const actions = context.conversationHistory
      .filter(cmd => cmd.intent?.action)
      .map(cmd => cmd.intent!.action)
      .join(' -> ');
    
    return actions;
  }

  private extractDomainsFromConversation(context: ConversationContext): string[] {
    const domains = new Set<string>();
    
    context.conversationHistory.forEach(cmd => {
      if (cmd.intent?.domain) {
        domains.add(cmd.intent.domain);
      }
    });
    
    return Array.from(domains);
  }

  private reinforceSuccessfulCommunicationStyle(
    profile: PersonalityProfile,
    context: ConversationContext
  ): void {
    // Simple reinforcement - in practice would be more sophisticated
    const recentStyle = this.analyzeRecentCommunicationStyle(context);
    if (recentStyle) {
      profile.communicationStyle = recentStyle;
    }
  }

  private analyzeRecentCommunicationStyle(context: ConversationContext): PersonalityProfile['communicationStyle'] | null {
    // Analyze recent successful interactions to identify preferred style
    return null; // Simplified implementation
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation - in practice would use more sophisticated methods
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private countTechnicalTerms(input: string): number {
    const technicalTerms = [
      'api', 'rest', 'graphql', 'microservice', 'database', 'sql', 'nosql',
      'react', 'vue', 'angular', 'typescript', 'javascript', 'python', 'java',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'ci/cd', 'devops',
      'authentication', 'authorization', 'oauth', 'jwt', 'ssl', 'https',
      'cache', 'redis', 'mongodb', 'postgresql', 'mysql', 'algorithm',
      'optimization', 'refactor', 'debugging', 'testing', 'deployment'
    ];
    
    const lowerInput = input.toLowerCase();
    return technicalTerms.filter(term => lowerInput.includes(term)).length;
  }

  private simplifyLanguage(text: string): string {
    return text.replace(/orchestrate/g, 'coordinate')
               .replace(/optimization/g, 'improvement')
               .replace(/implementation/g, 'setup');
  }

  private addTechnicalDepth(text: string): string {
    // Add more technical context for expert users
    return text;
  }

  private addTechnicalContext(response: string): string {
    // Add relevant technical details
    return '';
  }

  private addFriendlyTone(response: string): string {
    const friendlyPhrases = [
      'Great question!',
      'I\'d be happy to help with that!',
      'That sounds like an interesting challenge!',
      'Let\'s make this happen!'
    ];
    
    if (response.length < 50) {
      const randomPhrase = friendlyPhrases[Math.floor(Math.random() * friendlyPhrases.length)];
      return `${randomPhrase} ${response}`;
    }
    
    return response;
  }

  private startContextCleanup(): void {
    this.contextCleanupInterval = setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - this.options.contextRetentionMinutes * 60 * 1000);
      
      // Clean up old dialogue states
      for (const [sessionId, state] of this.dialogueStates) {
        // Remove if no recent activity (simplified - would check last interaction)
        if (Math.random() < 0.1) { // Placeholder cleanup logic
          this.dialogueStates.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  destroy(): void {
    if (this.contextCleanupInterval) {
      clearInterval(this.contextCleanupInterval);
    }
  }
}