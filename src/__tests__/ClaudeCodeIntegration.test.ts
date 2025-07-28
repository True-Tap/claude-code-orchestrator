/**
 * Tests for Claude Code Integration
 */

import { ClaudeCodeIntegration } from '../integration/ClaudeCodeIntegration';

describe('ClaudeCodeIntegration', () => {
  let integration: ClaudeCodeIntegration;

  beforeEach(() => {
    integration = new ClaudeCodeIntegration();
  });

  describe('slash command handling', () => {
    it('should handle orchestrate command', async () => {
      const result = await integration.handleSlashCommand(
        'orchestrate',
        'implement BLE payments with testing'
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('orchestration_plan_created');
      expect(result.plan).toBeDefined();
      expect(result.plan?.suggestedAgents).toContain('hardware-integration-specialist');
      expect(result.plan?.suggestedAgents).toContain('test-automation-engineer');
    });

    it('should handle agents list command', async () => {
      const result = await integration.handleSlashCommand('agents', 'list');

      expect(result.success).toBe(true);
      expect(result.action).toBe('list_agents');
      expect(result.agents).toBeDefined();
      expect(Object.keys(result.agents!)).toContain('architecture-reviewer');
      expect(Object.keys(result.agents!)).toContain('test-automation-engineer');
    });

    it('should handle agents describe command', async () => {
      const result = await integration.handleSlashCommand(
        'agents',
        'describe architecture-reviewer'
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('describe_agent');
      expect(result.agents!['architecture-reviewer']).toBeDefined();
      expect(result.agents!['architecture-reviewer'].name).toBe('Architecture Review Agent');
    });

    it('should handle agents suggest command', async () => {
      const result = await integration.handleSlashCommand(
        'agents',
        'suggest for payment implementation'
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('suggest_agents');
      expect(result.agents).toBeDefined();
      expect(Object.keys(result.agents!)).toContain('solana-mobile-expert');
    });

    it('should handle unknown commands gracefully', async () => {
      const result = await integration.handleSlashCommand('unknown', 'test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown slash command');
      expect(result.availableCommands).toBeDefined();
    });
  });

  describe('orchestration analysis', () => {
    it('should suggest orchestration for complex multi-domain tasks', () => {
      const [shouldOrchestrate, confidence, reason] = integration.shouldSuggestOrchestration(
        'implement BLE payment system with security audit and comprehensive testing'
      );

      expect(shouldOrchestrate).toBe(true);
      expect(confidence).toBeGreaterThan(0.4);
      expect(reason).toContain('Multi-domain task');
    });

    it('should not suggest orchestration for simple tasks', () => {
      const [shouldOrchestrate, confidence, reason] =
        integration.shouldSuggestOrchestration('fix typo in README');

      expect(shouldOrchestrate).toBe(false);
      expect(confidence).toBeLessThan(0.4);
    });

    it('should detect blockchain-related tasks', () => {
      const [shouldOrchestrate, confidence, reason] = integration.shouldSuggestOrchestration(
        'implement Genesis Token verification with security review'
      );

      expect(shouldOrchestrate).toBe(true);
      expect(reason).toContain('blockchain');
      expect(reason).toContain('security');
    });
  });

  describe('agent suggestions', () => {
    it('should suggest appropriate agents for blockchain tasks', () => {
      const result = integration['suggestAgentsForTask']('implement Solana wallet integration');

      expect(result).toContain('solana-mobile-expert');
      expect(result).toContain('architecture-reviewer');
      expect(result).toContain('test-automation-engineer');
    });

    it('should suggest hardware specialists for BLE tasks', () => {
      const result = integration['suggestAgentsForTask']('implement Bluetooth device discovery');

      expect(result).toContain('hardware-integration-specialist');
      expect(result).toContain('architecture-reviewer');
    });

    it('should suggest security specialists for security tasks', () => {
      const result = integration['suggestAgentsForTask']('audit payment security and encryption');

      expect(result).toContain('security-audit-specialist');
      expect(result).toContain('architecture-reviewer');
    });

    it('should limit agent suggestions to reasonable number', () => {
      const result = integration['suggestAgentsForTask'](
        'comprehensive system overhaul with testing security performance UI deployment'
      );

      expect(result.length).toBeLessThanOrEqual(4);
    });
  });

  describe('task complexity analysis', () => {
    it('should calculate higher complexity for implementation tasks', () => {
      const complexity1 = integration['calculateTaskComplexity'](
        'implement comprehensive BLE payment system'
      );
      const complexity2 = integration['calculateTaskComplexity']('update documentation');

      expect(complexity1).toBeGreaterThan(complexity2);
      expect(complexity1).toBeGreaterThanOrEqual(7);
      expect(complexity2).toBeLessThanOrEqual(5);
    });

    it('should recognize True Tap specific complexity', () => {
      const complexity = integration['calculateTaskComplexity'](
        'implement Bluetooth Revolution with BONK Rain'
      );

      expect(complexity).toBeGreaterThanOrEqual(8);
    });

    it('should cap complexity at maximum value', () => {
      const complexity = integration['calculateTaskComplexity'](
        'implement comprehensive entire complete security testing optimization architecture'
      );

      expect(complexity).toBeLessThanOrEqual(10);
    });
  });

  describe('coordination strategy', () => {
    it('should choose parallel strategy for multiple independent agents', () => {
      const strategy = integration['determineCoordinationStrategy']('implement features', [
        'agent1',
        'agent2',
        'agent3',
      ]);

      expect(strategy).toBe('parallel');
    });

    it('should choose sequential strategy for few agents', () => {
      const strategy = integration['determineCoordinationStrategy']('simple task', [
        'agent1',
        'agent2',
      ]);

      expect(strategy).toBe('sequential');
    });

    it('should choose phased parallel for complex tasks with many agents', () => {
      const strategy = integration['determineCoordinationStrategy'](
        'implement comprehensive entire system',
        ['agent1', 'agent2', 'agent3', 'agent4']
      );

      expect(strategy).toBe('phased_parallel');
    });
  });
});
