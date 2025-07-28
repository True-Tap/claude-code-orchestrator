/**
 * Voice Command Processor
 * 
 * Handles voice-to-text transcription, voice command recognition, and
 * audio processing for conversational orchestration interfaces.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface VoiceCommandOptions {
  enabled: boolean;
  language: string;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  noiseReduction?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  confidence: number;
  language: string;
  alternatives?: AlternativeTranscription[];
  audioMetadata: AudioMetadata;
  processingTime: number;
  timestamp: Date;
}

export interface AlternativeTranscription {
  text: string;
  confidence: number;
}

export interface AudioMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  fileSize: number;
  format: string;
  quality: 'low' | 'medium' | 'high' | 'excellent';
}

export interface VoiceCommand {
  id: string;
  transcription: TranscriptionResult;
  recognizedCommand?: string;
  parameters?: Record<string, any>;
  confidence: number;
  processingSteps: ProcessingStep[];
}

export interface ProcessingStep {
  step: 'audio_preprocessing' | 'transcription' | 'command_recognition' | 'parameter_extraction';
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface VoiceProfile {
  userId: string;
  voiceCharacteristics: {
    pitch: number;
    tempo: number;
    accent: string;
    clarity: number;
  };
  adaptationData: {
    commonMispronunciations: Record<string, string>;
    preferredPhrasing: string[];
    contextualVocabulary: string[];
  };
  calibrationDate: Date;
  accuracyMetrics: {
    overallAccuracy: number;
    domainAccuracy: Record<string, number>;
    improvementTrend: number[];
  };
}

export interface SpeechRecognitionEngine {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  transcribe: (audio: Buffer, options?: any) => Promise<TranscriptionResult>;
  isAvailable: () => Promise<boolean>;
}

export class VoiceCommandProcessor extends EventEmitter {
  private options: VoiceCommandOptions;
  private voiceProfiles: Map<string, VoiceProfile> = new Map();
  private recognitionEngines: SpeechRecognitionEngine[] = [];
  private commandPatterns: Map<string, RegExp> = new Map();
  private audioPreprocessor: AudioPreprocessor;
  
  private isProcessing: boolean = false;
  private processingQueue: ProcessingJob[] = [];

  constructor(options: VoiceCommandOptions) {
    super();
    this.options = {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16,
      noiseReduction: true,
      echoCancellation: true,
      autoGainControl: true,
      ...options,
    };
    
    this.audioPreprocessor = new AudioPreprocessor(this.options);
    this.initializeRecognitionEngines();
    this.initializeCommandPatterns();
    this.startProcessingQueue();
  }

  /**
   * Transcribe audio buffer to text
   */
  async transcribe(
    audioBuffer: Buffer,
    userId?: string,
    options?: Partial<TranscriptionOptions>
  ): Promise<TranscriptionResult> {
    if (!this.options.enabled) {
      throw new Error('Voice command processing is disabled');
    }

    const jobId = uuidv4();
    const startTime = Date.now();
    
    this.emit('transcriptionStarted', { jobId, audioBuffer: audioBuffer.length });

    try {
      // Preprocess audio
      const preprocessedAudio = await this.audioPreprocessor.process(audioBuffer);
      
      // Get user voice profile for adaptation
      const voiceProfile = userId ? this.voiceProfiles.get(userId) : undefined;
      
      // Select best recognition engine
      const engine = await this.selectOptimalEngine(preprocessedAudio, voiceProfile);
      
      // Perform transcription
      const transcriptionOptions = {
        language: this.options.language,
        userProfile: voiceProfile,
        ...options,
      };
      
      const result = await engine.transcribe(preprocessedAudio.audio, transcriptionOptions);
      
      // Apply user-specific adaptations
      if (voiceProfile) {
        this.applyVoiceProfileAdaptations(result, voiceProfile);
      }
      
      result.processingTime = Date.now() - startTime;
      result.timestamp = new Date();
      
      this.emit('transcriptionCompleted', { jobId, result });
      
      // Learn from successful transcription
      if (userId && result.confidence > 0.8) {
        await this.updateVoiceProfile(userId, result, preprocessedAudio);
      }
      
      return result;

    } catch (error) {
      this.emit('transcriptionFailed', { jobId, error });
      throw error;
    }
  }

  /**
   * Process voice command with recognition and parameter extraction
   */
  async processVoiceCommand(
    audioBuffer: Buffer,
    userId?: string
  ): Promise<VoiceCommand> {
    const commandId = uuidv4();
    const processingSteps: ProcessingStep[] = [];
    
    try {
      // Step 1: Transcription
      const transcriptionStart = Date.now();
      const transcription = await this.transcribe(audioBuffer, userId);
      processingSteps.push({
        step: 'transcription',
        duration: Date.now() - transcriptionStart,
        success: true,
        metadata: { confidence: transcription.confidence },
      });

      // Step 2: Command Recognition
      const recognitionStart = Date.now();
      const recognizedCommand = this.recognizeCommand(transcription.text);
      processingSteps.push({
        step: 'command_recognition',
        duration: Date.now() - recognitionStart,
        success: !!recognizedCommand,
        metadata: { command: recognizedCommand },
      });

      // Step 3: Parameter Extraction
      const extractionStart = Date.now();
      const parameters = recognizedCommand ? 
        await this.extractCommandParameters(transcription.text, recognizedCommand) : {};
      processingSteps.push({
        step: 'parameter_extraction',
        duration: Date.now() - extractionStart,
        success: true,
        metadata: { parameterCount: Object.keys(parameters).length },
      });

      const command: VoiceCommand = {
        id: commandId,
        transcription,
        recognizedCommand,
        parameters,
        confidence: this.calculateCommandConfidence(transcription, recognizedCommand, parameters),
        processingSteps,
      };

      this.emit('voiceCommandProcessed', { command });
      return command;

    } catch (error) {
      this.emit('voiceCommandFailed', { commandId, error, processingSteps });
      throw error;
    }
  }

  /**
   * Create or update voice profile for a user
   */
  async createVoiceProfile(userId: string, calibrationAudio?: Buffer[]): Promise<VoiceProfile> {
    let profile = this.voiceProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        voiceCharacteristics: {
          pitch: 0,
          tempo: 1.0,
          accent: 'neutral',
          clarity: 0.8,
        },
        adaptationData: {
          commonMispronunciations: {},
          preferredPhrasing: [],
          contextualVocabulary: [],
        },
        calibrationDate: new Date(),
        accuracyMetrics: {
          overallAccuracy: 0.7,
          domainAccuracy: {},
          improvementTrend: [],
        },
      };
    }

    // Calibrate with provided audio samples
    if (calibrationAudio && calibrationAudio.length > 0) {
      await this.calibrateVoiceProfile(profile, calibrationAudio);
    }

    this.voiceProfiles.set(userId, profile);
    this.emit('voiceProfileCreated', { userId, profile });
    
    return profile;
  }

  /**
   * Get voice profile for a user
   */
  getVoiceProfile(userId: string): VoiceProfile | undefined {
    return this.voiceProfiles.get(userId);
  }

  /**
   * Update voice recognition patterns
   */
  addCommandPattern(command: string, pattern: RegExp): void {
    this.commandPatterns.set(command, pattern);
    this.emit('commandPatternAdded', { command, pattern: pattern.source });
  }

  /**
   * Enable or disable voice processing
   */
  setEnabled(enabled: boolean): void {
    this.options.enabled = enabled;
    this.emit('voiceProcessingToggled', { enabled });
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): {
    totalTranscriptions: number;
    averageAccuracy: number;
    averageProcessingTime: number;
    engineUsage: Record<string, number>;
    errorRate: number;
  } {
    // Simplified stats - would track these in practice
    return {
      totalTranscriptions: 0,
      averageAccuracy: 0.85,
      averageProcessingTime: 1500,
      engineUsage: {},
      errorRate: 0.05,
    };
  }

  private initializeRecognitionEngines(): void {
    // Mock Web Speech API engine
    this.recognitionEngines.push({
      name: 'WebSpeechAPI',
      enabled: typeof globalThis !== 'undefined' && typeof (globalThis as any).webkitSpeechRecognition !== 'undefined',
      config: {
        continuous: false,
        interimResults: false,
      },
      transcribe: async (audio: Buffer, options?: any): Promise<TranscriptionResult> => {
        return this.mockTranscription(audio, 'WebSpeechAPI');
      },
      isAvailable: async (): Promise<boolean> => {
        return typeof globalThis !== 'undefined' && typeof (globalThis as any).webkitSpeechRecognition !== 'undefined';
      },
    });

    // Mock cloud-based engine
    this.recognitionEngines.push({
      name: 'CloudSpeechAPI',
      enabled: true,
      config: {
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        model: 'latest_long',
      },
      transcribe: async (audio: Buffer, options?: any): Promise<TranscriptionResult> => {
        return this.mockTranscription(audio, 'CloudSpeechAPI');
      },
      isAvailable: async (): Promise<boolean> => {
        return true; // Would check API availability
      },
    });

    // Mock local engine
    this.recognitionEngines.push({
      name: 'LocalSpeechEngine',
      enabled: true,
      config: {
        modelPath: './models/speech-recognition',
        precision: 'high',
      },
      transcribe: async (audio: Buffer, options?: any): Promise<TranscriptionResult> => {
        return this.mockTranscription(audio, 'LocalSpeechEngine');
      },
      isAvailable: async (): Promise<boolean> => {
        return true; // Would check local model availability
      },
    });
  }

  private initializeCommandPatterns(): void {
    // Orchestration commands
    this.commandPatterns.set('create_component', /(?:create|build|make)\s+(?:a\s+)?(.+?)\s+component/i);
    this.commandPatterns.set('run_tests', /(?:run|execute)\s+(?:the\s+)?tests?/i);
    this.commandPatterns.set('review_code', /(?:review|check|audit)\s+(?:the\s+)?code/i);
    this.commandPatterns.set('deploy_app', /(?:deploy|release|publish)\s+(?:the\s+)?(?:app|application)/i);
    this.commandPatterns.set('optimize_performance', /(?:optimize|improve)\s+(?:the\s+)?performance/i);
    
    // Navigation commands
    this.commandPatterns.set('show_status', /(?:show|display)\s+(?:me\s+)?(?:the\s+)?status/i);
    this.commandPatterns.set('list_agents', /(?:list|show)\s+(?:all\s+)?(?:available\s+)?agents/i);
    this.commandPatterns.set('cancel_task', /(?:cancel|stop|abort)\s+(?:the\s+)?(?:current\s+)?task/i);
    
    // Configuration commands
    this.commandPatterns.set('set_preference', /(?:set|change|update)\s+(?:my\s+)?preference/i);
    this.commandPatterns.set('enable_feature', /(?:enable|turn on)\s+(.+)/i);
    this.commandPatterns.set('disable_feature', /(?:disable|turn off)\s+(.+)/i);
  }

  private async selectOptimalEngine(
    preprocessedAudio: ProcessedAudio,
    voiceProfile?: VoiceProfile
  ): Promise<SpeechRecognitionEngine> {
    const availableEngines = [];
    
    // Check engine availability
    for (const engine of this.recognitionEngines) {
      if (engine.enabled && await engine.isAvailable()) {
        availableEngines.push(engine);
      }
    }
    
    if (availableEngines.length === 0) {
      throw new Error('No speech recognition engines available');
    }
    
    // Select engine based on audio characteristics and user profile
    const audioQuality = preprocessedAudio.metadata.quality;
    const duration = preprocessedAudio.metadata.duration;
    
    // Prefer cloud engines for high quality, long audio
    if (audioQuality === 'high' && duration > 10000) {
      const cloudEngine = availableEngines.find(e => e.name === 'CloudSpeechAPI');
      if (cloudEngine) return cloudEngine;
    }
    
    // Prefer local engines for privacy or offline scenarios
    if (voiceProfile?.adaptationData.contextualVocabulary && voiceProfile.adaptationData.contextualVocabulary.length > 100) {
      const localEngine = availableEngines.find(e => e.name === 'LocalSpeechEngine');
      if (localEngine) return localEngine;
    }
    
    // Default to first available
    return availableEngines[0];
  }

  private applyVoiceProfileAdaptations(
    result: TranscriptionResult,
    profile: VoiceProfile
  ): void {
    let adaptedText = result.text;
    
    // Apply common mispronunciation corrections
    for (const [mispronounced, correct] of Object.entries(profile.adaptationData.commonMispronunciations)) {
      const regex = new RegExp(`\\b${mispronounced}\\b`, 'gi');
      adaptedText = adaptedText.replace(regex, correct);
    }
    
    // Enhance with contextual vocabulary
    profile.adaptationData.contextualVocabulary.forEach(term => {
      const soundalike = this.findSoundalikeInText(adaptedText, term);
      if (soundalike && this.calculateSimilarity(soundalike, term) > 0.7) {
        adaptedText = adaptedText.replace(soundalike, term);
      }
    });
    
    result.text = adaptedText;
    
    // Boost confidence if adaptations were applied
    if (adaptedText !== result.text) {
      result.confidence = Math.min(1.0, result.confidence + 0.1);
    }
  }

  private async updateVoiceProfile(
    userId: string,
    transcription: TranscriptionResult,
    audio: ProcessedAudio
  ): Promise<void> {
    const profile = this.voiceProfiles.get(userId);
    if (!profile) return;
    
    // Update voice characteristics
    if (audio.metadata.quality === 'high') {
      profile.voiceCharacteristics.clarity = Math.min(1.0, profile.voiceCharacteristics.clarity + 0.05);
    }
    
    // Add new vocabulary from successful transcriptions
    const words = transcription.text.toLowerCase().split(/\s+/);
    const technicalWords = words.filter(word => this.isTechnicalTerm(word));
    technicalWords.forEach(word => {
      if (!profile.adaptationData.contextualVocabulary.includes(word)) {
        profile.adaptationData.contextualVocabulary.push(word);
      }
    });
    
    // Update accuracy metrics
    profile.accuracyMetrics.improvementTrend.push(transcription.confidence);
    if (profile.accuracyMetrics.improvementTrend.length > 10) {
      profile.accuracyMetrics.improvementTrend = profile.accuracyMetrics.improvementTrend.slice(-10);
    }
    
    profile.accuracyMetrics.overallAccuracy = 
      profile.accuracyMetrics.improvementTrend.reduce((a, b) => a + b, 0) / 
      profile.accuracyMetrics.improvementTrend.length;
    
    this.voiceProfiles.set(userId, profile);
    this.emit('voiceProfileUpdated', { userId, profile });
  }

  private recognizeCommand(text: string): string | undefined {
    const lowerText = text.toLowerCase();
    
    for (const [command, pattern] of this.commandPatterns) {
      if (pattern.test(lowerText)) {
        return command;
      }
    }
    
    return undefined;
  }

  private async extractCommandParameters(
    text: string,
    command: string
  ): Promise<Record<string, any>> {
    const parameters: Record<string, any> = {};
    
    // Extract parameters based on command type
    switch (command) {
      case 'create_component':
        const componentMatch = text.match(/(?:create|build|make)\s+(?:a\s+)?(.+?)\s+component/i);
        if (componentMatch) {
          parameters.componentType = componentMatch[1].trim();
        }
        break;
        
      case 'deploy_app':
        const envMatch = text.match(/(?:to|on)\s+(staging|production|development)/i);
        if (envMatch) {
          parameters.environment = envMatch[1].toLowerCase();
        }
        break;
        
      case 'set_preference':
        const prefMatch = text.match(/preference\s+(.+?)(?:\s+to\s+(.+))?$/i);
        if (prefMatch) {
          parameters.preference = prefMatch[1].trim();
          parameters.value = prefMatch[2]?.trim() || true;
        }
        break;
        
      case 'enable_feature':
      case 'disable_feature':
        const featureMatch = text.match(/(?:enable|disable|turn\s+(?:on|off))\s+(.+)/i);
        if (featureMatch) {
          parameters.feature = featureMatch[1].trim();
        }
        break;
    }
    
    return parameters;
  }

  private calculateCommandConfidence(
    transcription: TranscriptionResult,
    recognizedCommand?: string,
    parameters?: Record<string, any>
  ): number {
    let confidence = transcription.confidence;
    
    // Boost confidence if command was recognized
    if (recognizedCommand) {
      confidence += 0.1;
    }
    
    // Boost confidence if parameters were extracted
    if (parameters && Object.keys(parameters).length > 0) {
      confidence += 0.05 * Object.keys(parameters).length;
    }
    
    return Math.min(1.0, confidence);
  }

  private async calibrateVoiceProfile(
    profile: VoiceProfile,
    calibrationAudio: Buffer[]
  ): Promise<void> {
    // Analyze voice characteristics from calibration samples
    let totalPitch = 0;
    let totalTempo = 0;
    let totalClarity = 0;
    
    for (const audio of calibrationAudio) {
      const processed = await this.audioPreprocessor.process(audio);
      const characteristics = this.analyzeVoiceCharacteristics(processed);
      
      totalPitch += characteristics.pitch;
      totalTempo += characteristics.tempo;
      totalClarity += characteristics.clarity;
    }
    
    const sampleCount = calibrationAudio.length;
    profile.voiceCharacteristics = {
      pitch: totalPitch / sampleCount,
      tempo: totalTempo / sampleCount,
      accent: 'neutral', // Would analyze accent
      clarity: totalClarity / sampleCount,
    };
    
    profile.calibrationDate = new Date();
  }

  private analyzeVoiceCharacteristics(audio: ProcessedAudio): VoiceProfile['voiceCharacteristics'] {
    // Mock implementation - would use actual audio analysis
    return {
      pitch: Math.random() * 200 + 100, // 100-300 Hz
      tempo: Math.random() * 0.5 + 0.75, // 0.75-1.25x
      accent: 'neutral',
      clarity: Math.random() * 0.3 + 0.7, // 0.7-1.0
    };
  }

  private mockTranscription(audio: Buffer, engineName: string): TranscriptionResult {
    // Mock transcription result - would be actual transcription in practice
    const mockTexts = [
      'create a React component for user authentication',
      'run the test suite and check for failures',
      'review the code for security vulnerabilities',
      'deploy the application to staging environment',
      'optimize the database query performance',
      'show me the current status of all agents',
      'set my preference for verbose output'
    ];
    
    const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
    const confidence = Math.random() * 0.3 + 0.7; // 0.7-1.0
    
    return {
      id: uuidv4(),
      text: randomText,
      confidence,
      language: this.options.language,
      alternatives: [
        { text: randomText, confidence: confidence - 0.1 }
      ],
      audioMetadata: {
        duration: audio.length / 16, // Rough estimate
        sampleRate: this.options.sampleRate!,
        channels: this.options.channels!,
        bitDepth: this.options.bitDepth!,
        fileSize: audio.length,
        format: 'wav',
        quality: 'high',
      },
      processingTime: Math.random() * 1000 + 500, // 500-1500ms
      timestamp: new Date(),
    };
  }

  private findSoundalikeInText(text: string, target: string): string | null {
    const words = text.split(/\s+/);
    
    for (const word of words) {
      if (this.soundsLike(word, target)) {
        return word;
      }
    }
    
    return null;
  }

  private soundsLike(word1: string, word2: string): boolean {
    // Simplified phonetic similarity - would use more sophisticated algorithm
    return this.calculateSimilarity(word1, word2) > 0.6;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private isTechnicalTerm(word: string): boolean {
    const technicalTerms = [
      'api', 'rest', 'graphql', 'component', 'typescript', 'javascript',
      'react', 'angular', 'vue', 'database', 'authentication', 'deployment',
      'testing', 'optimization', 'security', 'performance', 'docker',
      'kubernetes', 'microservice', 'integration', 'refactor'
    ];
    
    return technicalTerms.includes(word.toLowerCase());
  }

  private startProcessingQueue(): void {
    setInterval(() => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        const job = this.processingQueue.shift()!;
        this.processJob(job);
      }
    }, 100);
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    this.isProcessing = true;
    
    try {
      await job.process();
      this.emit('jobCompleted', { jobId: job.id });
    } catch (error) {
      this.emit('jobFailed', { jobId: job.id, error });
    } finally {
      this.isProcessing = false;
    }
  }
}

// Supporting interfaces and classes
interface TranscriptionOptions {
  language: string;
  userProfile?: VoiceProfile;
  enablePunctuation?: boolean;
  enableNumberTranscription?: boolean;
}

interface ProcessedAudio {
  audio: Buffer;
  metadata: AudioMetadata;
}

interface ProcessingJob {
  id: string;
  type: 'transcription' | 'voice_command';
  process: () => Promise<void>;
}

class AudioPreprocessor {
  private options: VoiceCommandOptions;
  
  constructor(options: VoiceCommandOptions) {
    this.options = options;
  }
  
  async process(audioBuffer: Buffer): Promise<ProcessedAudio> {
    // Mock audio preprocessing - would apply noise reduction, normalization, etc.
    const metadata: AudioMetadata = {
      duration: audioBuffer.length / 16, // Rough estimate
      sampleRate: this.options.sampleRate!,
      channels: this.options.channels!,
      bitDepth: this.options.bitDepth!,
      fileSize: audioBuffer.length,
      format: 'wav',
      quality: this.assessAudioQuality(audioBuffer),
    };
    
    return {
      audio: audioBuffer, // Would be processed audio
      metadata,
    };
  }
  
  private assessAudioQuality(audio: Buffer): AudioMetadata['quality'] {
    // Mock quality assessment
    if (audio.length > 32000) return 'excellent';
    if (audio.length > 16000) return 'high';
    if (audio.length > 8000) return 'medium';
    return 'low';
  }
}