/**
 * Natural Language Processor
 * 
 * Advanced NLP system for intent recognition, entity extraction, and semantic
 * understanding of conversational commands in the orchestration context.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CommandIntent, ExtractedEntity, ConversationContext } from './ConversationalOrchestrator';

export interface NLPOptions {
  language: string;
  enableSemanticAnalysis: boolean;
  enableContextAwareness: boolean;
  confidenceThreshold?: number;
}

export interface SemanticAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  domains: string[];
  keywords: string[];
  technicalTerms: string[];
}

export interface IntentPattern {
  pattern: RegExp;
  intent: string;
  domain: string;
  requiredEntities?: string[];
  confidence: number;
  examples: string[];
}

export interface EntityPattern {
  pattern: RegExp;
  type: ExtractedEntity['type'];
  normalizer?: (value: string) => string;
  validator?: (value: string) => boolean;
  metadata?: Record<string, any>;
}

export class NaturalLanguageProcessor extends EventEmitter {
  private options: NLPOptions;
  private intentPatterns: IntentPattern[] = [];
  private entityPatterns: EntityPattern[] = [];
  private domainVocabulary: Map<string, string[]> = new Map();
  private contextWeights: Map<string, number> = new Map();

  constructor(options: NLPOptions) {
    super();
    this.options = {
      confidenceThreshold: 0.7,
      ...options,
    };
    
    this.initializePatterns();
    this.initializeDomainVocabulary();
    this.initializeContextWeights();
  }

  /**
   * Extract intent and entities from user input
   */
  async extractIntent(input: string, context?: ConversationContext): Promise<CommandIntent> {
    const normalizedInput = this.normalizeInput(input);
    const semanticAnalysis = await this.performSemanticAnalysis(normalizedInput, context);
    
    // Extract entities first
    const entities = await this.extractEntities(normalizedInput, context);
    
    // Match intent patterns
    const intentMatches = this.matchIntentPatterns(normalizedInput, entities);
    
    // Apply context-aware scoring
    const contextAdjustedMatches = this.applyContextualScoring(intentMatches, context, semanticAnalysis);
    
    // Select best intent
    const bestMatch = contextAdjustedMatches.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    const intent: CommandIntent = {
      action: bestMatch.intent,
      domain: bestMatch.domain,
      entities,
      confidence: bestMatch.confidence,
      requiresConfirmation: this.shouldRequireConfirmation(bestMatch, semanticAnalysis),
      estimatedComplexity: semanticAnalysis.complexity,
    };

    this.emit('intentExtracted', { input, intent, semanticAnalysis });
    return intent;
  }

  /**
   * Extract structured entities from input text
   */
  async extractEntities(input: string, context?: ConversationContext): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    for (const pattern of this.entityPatterns) {
      const matches = input.matchAll(pattern.pattern);
      
      for (const match of matches) {
        const value = match[1] || match[0];
        const normalized = pattern.normalizer ? pattern.normalizer(value) : value.toLowerCase();
        
        // Validate entity if validator exists
        if (pattern.validator && !pattern.validator(normalized)) {
          continue;
        }
        
        // Calculate confidence based on context
        const confidence = this.calculateEntityConfidence(value, pattern.type, context);
        
        entities.push({
          type: pattern.type,
          value,
          confidence,
          normalized,
          metadata: pattern.metadata,
        });
      }
    }

    // Deduplicate and sort by confidence
    const uniqueEntities = this.deduplicateEntities(entities);
    return uniqueEntities.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Perform semantic analysis of the input
   */
  async performSemanticAnalysis(
    input: string, 
    context?: ConversationContext
  ): Promise<SemanticAnalysis> {
    const sentiment = this.analyzeSentiment(input);
    const urgency = this.analyzeUrgency(input);
    const complexity = this.analyzeComplexity(input, context);
    const domains = this.identifyDomains(input);
    const keywords = this.extractKeywords(input);
    const technicalTerms = this.extractTechnicalTerms(input);

    return {
      sentiment,
      urgency,
      complexity,
      domains,
      keywords,
      technicalTerms,
    };
  }

  /**
   * Update language model with new patterns
   */
  addIntentPattern(pattern: IntentPattern): void {
    this.intentPatterns.push(pattern);
    this.sortPatternsByConfidence();
  }

  /**
   * Add custom entity pattern
   */
  addEntityPattern(pattern: EntityPattern): void {
    this.entityPatterns.push(pattern);
  }

  /**
   * Learn from successful interactions
   */
  async learnFromInteraction(
    input: string, 
    actualIntent: string, 
    actualEntities: ExtractedEntity[]
  ): Promise<void> {
    // Simple learning mechanism - in practice would use ML
    const confidence = 0.8;
    
    const newPattern: IntentPattern = {
      pattern: new RegExp(this.createPatternFromInput(input), 'i'),
      intent: actualIntent,
      domain: this.inferDomain(actualIntent),
      confidence,
      examples: [input],
    };
    
    this.addIntentPattern(newPattern);
    this.emit('patternLearned', { input, intent: actualIntent, pattern: newPattern });
  }

  private initializePatterns(): void {
    // Orchestration patterns
    this.intentPatterns.push(
      {
        pattern: /(?:create|build|make|generate)\s+(?:a\s+)?(.+?)(?:\s+(?:with|using)\s+(.+))?/i,
        intent: 'orchestrate_agents',
        domain: 'creation',
        confidence: 0.9,
        examples: ['create a React component', 'build a REST API with tests'],
      },
      {
        pattern: /(?:review|check|audit|analyze)\s+(.+)/i,
        intent: 'orchestrate_agents',
        domain: 'review',
        confidence: 0.85,
        examples: ['review my code', 'check for security issues'],
      },
      {
        pattern: /(?:optimize|improve|enhance)\s+(.+)/i,
        intent: 'orchestrate_agents',
        domain: 'optimization',
        confidence: 0.85,
        examples: ['optimize database queries', 'improve performance'],
      },
      {
        pattern: /(?:test|run tests|check)\s+(.+)/i,
        intent: 'orchestrate_agents',
        domain: 'testing',
        confidence: 0.8,
        examples: ['test the authentication system', 'run all tests'],
      },
      {
        pattern: /(?:deploy|release|publish)\s+(.+)/i,
        intent: 'orchestrate_agents',
        domain: 'deployment',
        confidence: 0.85,
        examples: ['deploy to staging', 'release version 2.0'],
      },
      
      // Status queries
      {
        pattern: /(?:what|how)(?:'s|\s+is)\s+(?:the\s+)?(?:status|progress|state)/i,
        intent: 'query_status',
        domain: 'status',
        confidence: 0.9,
        examples: ["what's the status", 'how is the progress'],
      },
      {
        pattern: /(?:show|display|tell)\s+me\s+(?:the\s+)?(?:progress|status|current)/i,
        intent: 'query_status',
        domain: 'status',
        confidence: 0.85,
        examples: ['show me the progress', 'tell me the current status'],
      },
      
      // Preferences
      {
        pattern: /(?:set|change|update)\s+(?:my\s+)?(?:preference|setting|config)/i,
        intent: 'modify_preferences',
        domain: 'configuration',
        confidence: 0.9,
        examples: ['set my preference for verbose output', 'change communication style'],
      },
      
      // Explanations
      {
        pattern: /(?:explain|describe|tell me about|what is)\s+(.+)/i,
        intent: 'explain_process',
        domain: 'information',
        confidence: 0.8,
        examples: ['explain orchestration', 'what is coordination strategy'],
      }
    );

    // Entity patterns
    this.entityPatterns.push(
      {
        pattern: /\b(test-?(?:engineer|automation)|testing|qa)\b/gi,
        type: 'agent',
        normalizer: () => 'test-automation-engineer',
      },
      {
        pattern: /\b(security|audit|sec)\b/gi,
        type: 'agent',
        normalizer: () => 'security-audit-specialist',
      },
      {
        pattern: /\b(architecture|architect|design)\b/gi,
        type: 'agent',
        normalizer: () => 'architecture-reviewer',
      },
      {
        pattern: /\b(performance|perf|optimization|optimize)\b/gi,
        type: 'agent',
        normalizer: () => 'performance-optimizer',
      },
      {
        pattern: /\b(devops|deployment|deploy|ci\/cd)\b/gi,
        type: 'agent',
        normalizer: () => 'devops-integration-engineer',
      },
      
      // Coordination strategies
      {
        pattern: /\b(parallel|simultaneously|at the same time)\b/gi,
        type: 'preference',
        normalizer: () => 'parallel',
        metadata: { category: 'coordination' },
      },
      {
        pattern: /\b(sequential|one by one|step by step)\b/gi,
        type: 'preference',
        normalizer: () => 'sequential',
        metadata: { category: 'coordination' },
      },
      {
        pattern: /\b(hierarchical|with lead|team lead)\b/gi,
        type: 'preference',
        normalizer: () => 'hierarchical',
        metadata: { category: 'coordination' },
      },
      
      // Technologies
      {
        pattern: /\b(react|react\.js|reactjs)\b/gi,
        type: 'technology',
        normalizer: (v) => 'React',
      },
      {
        pattern: /\b(typescript|ts)\b/gi,
        type: 'technology',
        normalizer: (v) => 'TypeScript',
      },
      {
        pattern: /\b(node\.?js|nodejs)\b/gi,
        type: 'technology',
        normalizer: (v) => 'Node.js',
      },
      {
        pattern: /\b(database|db|sql|postgres|mysql)\b/gi,
        type: 'technology',
        normalizer: (v) => 'Database',
      },
      
      // File patterns
      {
        pattern: /\b([a-zA-Z0-9_-]+\.(js|ts|tsx|jsx|py|java|cpp|h))\b/gi,
        type: 'file',
        normalizer: (v) => v.toLowerCase(),
      },
      
      // Actions
      {
        pattern: /\b(create|build|make|generate|develop)\b/gi,
        type: 'action',
        normalizer: (v) => 'create',
      },
      {
        pattern: /\b(review|check|audit|analyze|examine)\b/gi,
        type: 'action',
        normalizer: (v) => 'review',
      },
      {
        pattern: /\b(test|validate|verify)\b/gi,
        type: 'action',
        normalizer: (v) => 'test',
      },
      {
        pattern: /\b(optimize|improve|enhance|refactor)\b/gi,
        type: 'action',
        normalizer: (v) => 'optimize',
      }
    );
  }

  private initializeDomainVocabulary(): void {
    this.domainVocabulary.set('creation', [
      'create', 'build', 'make', 'generate', 'develop', 'construct', 'implement',
      'component', 'service', 'api', 'interface', 'class', 'function'
    ]);
    
    this.domainVocabulary.set('review', [
      'review', 'check', 'audit', 'analyze', 'examine', 'inspect', 'validate',
      'code', 'security', 'performance', 'quality', 'standards'
    ]);
    
    this.domainVocabulary.set('testing', [
      'test', 'testing', 'spec', 'suite', 'unit', 'integration', 'e2e',
      'coverage', 'mock', 'stub', 'assert', 'expect'
    ]);
    
    this.domainVocabulary.set('deployment', [
      'deploy', 'release', 'publish', 'ship', 'launch', 'staging', 'production',
      'ci', 'cd', 'pipeline', 'build', 'docker', 'kubernetes'
    ]);
  }

  private initializeContextWeights(): void {
    this.contextWeights.set('recent_action', 0.3);
    this.contextWeights.set('project_type', 0.2);
    this.contextWeights.set('user_preference', 0.25);
    this.contextWeights.set('environment', 0.15);
    this.contextWeights.set('conversation_history', 0.1);
  }

  private normalizeInput(input: string): string {
    return input.trim().toLowerCase()
      .replace(/[^\w\s.-]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private matchIntentPatterns(
    input: string, 
    entities: ExtractedEntity[]
  ): Array<{ intent: string; domain: string; confidence: number }> {
    const matches: Array<{ intent: string; domain: string; confidence: number }> = [];
    
    for (const pattern of this.intentPatterns) {
      const match = input.match(pattern.pattern);
      if (match) {
        let confidence = pattern.confidence;
        
        // Boost confidence if required entities are present
        if (pattern.requiredEntities) {
          const presentEntities = entities.filter(e => 
            pattern.requiredEntities!.includes(e.type)
          );
          const entityBoost = (presentEntities.length / pattern.requiredEntities.length) * 0.1;
          confidence = Math.min(1.0, confidence + entityBoost);
        }
        
        matches.push({
          intent: pattern.intent,
          domain: pattern.domain,
          confidence,
        });
      }
    }
    
    return matches.length > 0 ? matches : [{
      intent: 'unknown',
      domain: 'general',
      confidence: 0.1,
    }];
  }

  private applyContextualScoring(
    matches: Array<{ intent: string; domain: string; confidence: number }>,
    context?: ConversationContext,
    semanticAnalysis?: SemanticAnalysis
  ): Array<{ intent: string; domain: string; confidence: number }> {
    if (!context || !this.options.enableContextAwareness) {
      return matches;
    }

    return matches.map(match => {
      let adjustedConfidence = match.confidence;
      
      // Recent similar intents boost confidence
      const recentSimilar = context.previousIntents
        .slice(-3)
        .filter(intent => intent.domain === match.domain);
      
      if (recentSimilar.length > 0) {
        adjustedConfidence += 0.1 * recentSimilar.length;
      }
      
      // Project type context
      if (context.environmentContext.projectType && semanticAnalysis) {
        const domainAlignment = this.calculateDomainAlignment(
          match.domain, 
          context.environmentContext.projectType,
          semanticAnalysis.domains
        );
        adjustedConfidence += domainAlignment * 0.15;
      }
      
      // User preferences
      const prefAlignment = this.calculatePreferenceAlignment(match, context.userPreferences);
      adjustedConfidence += prefAlignment * 0.1;
      
      return {
        ...match,
        confidence: Math.min(1.0, adjustedConfidence),
      };
    });
  }

  private calculateEntityConfidence(
    value: string, 
    type: ExtractedEntity['type'], 
    context?: ConversationContext
  ): number {
    let confidence = 0.8; // Base confidence
    
    // Context-based adjustments
    if (context && this.options.enableContextAwareness) {
      // Recent mentions boost confidence
      const recentMentions = context.conversationHistory
        .slice(-5)
        .filter(cmd => cmd.input.toLowerCase().includes(value.toLowerCase()));
      
      confidence += Math.min(0.2, recentMentions.length * 0.05);
      
      // Environment context
      if (type === 'technology' && context.environmentContext.projectType) {
        const techRelevance = this.calculateTechRelevance(
          value, 
          context.environmentContext.projectType
        );
        confidence += techRelevance * 0.1;
      }
    }
    
    return Math.min(1.0, confidence);
  }

  private shouldRequireConfirmation(
    match: { intent: string; domain: string; confidence: number },
    semanticAnalysis: SemanticAnalysis
  ): boolean {
    // Require confirmation for:
    // - Low confidence matches
    // - Destructive actions
    // - Complex operations
    // - High urgency with potential risks
    
    if (match.confidence < (this.options.confidenceThreshold || 0.7)) {
      return true;
    }
    
    const destructiveIntents = ['delete', 'remove', 'drop', 'destroy'];
    if (destructiveIntents.some(intent => match.intent.includes(intent))) {
      return true;
    }
    
    if (semanticAnalysis.complexity === 'enterprise') {
      return true;
    }
    
    if (semanticAnalysis.urgency === 'urgent' && match.domain === 'deployment') {
      return true;
    }
    
    return false;
  }

  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Set<string>();
    const unique: ExtractedEntity[] = [];
    
    for (const entity of entities) {
      const key = `${entity.type}:${entity.normalized}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entity);
      }
    }
    
    return unique;
  }

  private analyzeSentiment(input: string): SemanticAnalysis['sentiment'] {
    const positiveWords = ['great', 'good', 'excellent', 'perfect', 'amazing', 'love'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'wrong', 'broken'];
    
    const words = input.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(w => positiveWords.includes(w)).length;
    const negativeCount = words.filter(w => negativeWords.includes(w)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private analyzeUrgency(input: string): SemanticAnalysis['urgency'] {
    const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'emergency', 'critical'];
    const highWords = ['soon', 'quickly', 'fast', 'priority', 'important'];
    
    const lowerInput = input.toLowerCase();
    
    if (urgentWords.some(word => lowerInput.includes(word))) return 'urgent';
    if (highWords.some(word => lowerInput.includes(word))) return 'high';
    if (lowerInput.includes('later') || lowerInput.includes('when you have time')) return 'low';
    
    return 'medium';
  }

  private analyzeComplexity(input: string, context?: ConversationContext): SemanticAnalysis['complexity'] {
    const complexityIndicators = {
      simple: ['simple', 'basic', 'quick', 'small'],
      medium: ['medium', 'standard', 'normal'],
      complex: ['complex', 'advanced', 'sophisticated', 'multiple'],
      enterprise: ['enterprise', 'large-scale', 'production', 'system-wide']
    };
    
    const lowerInput = input.toLowerCase();
    
    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => lowerInput.includes(indicator))) {
        return level as SemanticAnalysis['complexity'];
      }
    }
    
    // Heuristic based on input length and technical terms
    const words = input.split(/\s+/).length;
    const technicalTerms = this.extractTechnicalTerms(input).length;
    
    if (words > 20 || technicalTerms > 5) return 'complex';
    if (words > 10 || technicalTerms > 2) return 'medium';
    
    return 'simple';
  }

  private identifyDomains(input: string): string[] {
    const domains: string[] = [];
    
    for (const [domain, vocabulary] of this.domainVocabulary) {
      const matches = vocabulary.filter(word => 
        input.toLowerCase().includes(word.toLowerCase())
      );
      
      if (matches.length > 0) {
        domains.push(domain);
      }
    }
    
    return domains;
  }

  private extractKeywords(input: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
    
    return input.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index) // unique
      .slice(0, 10); // top 10
  }

  private extractTechnicalTerms(input: string): string[] {
    const technicalTerms = [
      'api', 'rest', 'graphql', 'microservice', 'database', 'sql', 'nosql',
      'react', 'vue', 'angular', 'typescript', 'javascript', 'python', 'java',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'ci/cd', 'devops',
      'authentication', 'authorization', 'oauth', 'jwt', 'ssl', 'https',
      'cache', 'redis', 'mongodb', 'postgresql', 'mysql'
    ];
    
    const lowerInput = input.toLowerCase();
    return technicalTerms.filter(term => lowerInput.includes(term));
  }

  private calculateDomainAlignment(
    intentDomain: string, 
    projectType: string, 
    identifiedDomains: string[]
  ): number {
    const alignmentMatrix: Record<string, Record<string, number>> = {
      'typescript': {
        'creation': 0.9,
        'review': 0.8,
        'testing': 0.9,
        'optimization': 0.7,
      },
      'react': {
        'creation': 0.95,
        'review': 0.8,
        'testing': 0.85,
        'deployment': 0.7,
      }
    };
    
    const projectAlignment = alignmentMatrix[projectType]?.[intentDomain] || 0.5;
    const domainAlignment = identifiedDomains.includes(intentDomain) ? 0.3 : 0;
    
    return Math.min(1.0, projectAlignment + domainAlignment);
  }

  private calculatePreferenceAlignment(
    match: { intent: string; domain: string; confidence: number },
    preferences: any
  ): number {
    // Simple preference alignment - would be more sophisticated in practice
    return 0.1;
  }

  private calculateTechRelevance(technology: string, projectType: string): number {
    const relevanceMatrix: Record<string, Record<string, number>> = {
      'typescript': {
        'React': 0.9,
        'Node.js': 0.8,
        'Database': 0.6,
      },
      'react': {
        'TypeScript': 0.9,
        'Node.js': 0.7,
        'Database': 0.5,
      }
    };
    
    return relevanceMatrix[projectType]?.[technology] || 0.3;
  }

  private sortPatternsByConfidence(): void {
    this.intentPatterns.sort((a, b) => b.confidence - a.confidence);
  }

  private createPatternFromInput(input: string): string {
    // Simple pattern creation - escape special regex chars and make flexible
    return input
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+')
      .replace(/\w+/g, '\\w*$&\\w*');
  }

  private inferDomain(intent: string): string {
    const domainMap: Record<string, string> = {
      'create': 'creation',
      'build': 'creation',
      'review': 'review',
      'test': 'testing',
      'deploy': 'deployment',
      'optimize': 'optimization',
    };
    
    for (const [keyword, domain] of Object.entries(domainMap)) {
      if (intent.includes(keyword)) {
        return domain;
      }
    }
    
    return 'general';
  }
}