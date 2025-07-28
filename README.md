# Claude Code Orchestrator

🤖 Multi-agent orchestration tool for Claude Code CLI instances

Transform complex development tasks into coordinated multi-agent workflows with intelligent task analysis and specialized agent selection.

## Features

- **🎯 Natural Language Orchestration**: Describe tasks in plain English and get intelligent agent coordination
- **🤖 Specialized Agents**: 8 expert agents covering architecture, testing, security, hardware, UX, blockchain, performance, and DevOps
- **⚡ Smart Coordination**: Parallel, sequential, and phased execution strategies
- **🔍 Task Analysis**: Automatic complexity analysis and agent suggestions
- **💻 Interactive Mode**: Step-by-step orchestration with visual feedback
- **⚙️ Configurable**: Project-specific configuration and templates

## Quick Start

### Installation

```bash
npm install -g claude-code-orchestrator
```

### Prerequisites

- Node.js 16+ 
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

### Basic Usage

```bash
# Orchestrate a complex task
claude-orchestrator orchestrate "implement BLE payments with architecture review and testing"

# Interactive mode
claude-orchestrator interactive

# List available agents
claude-orchestrator agents

# Get agent suggestions for a task
claude-orchestrator agents:suggest "optimize React Native performance"

# Initialize configuration for your project
claude-orchestrator init --template react-native
```

## How It Works

The orchestrator analyzes your task description and:

1. **🔍 Task Analysis**: Determines complexity and required domains
2. **🤖 Agent Selection**: Suggests optimal agents based on task requirements
3. **📋 Plan Creation**: Builds execution plan with phases and dependencies
4. **⚡ Coordination**: Executes agents using the best strategy (parallel/sequential/phased)
5. **📊 Monitoring**: Tracks progress and handles errors gracefully

## Available Agents

| Agent | Specialization | Best For |
|-------|---------------|----------|
| **Architecture Reviewer** | Code architecture, design patterns | System design, refactoring, TypeScript patterns |
| **Test Automation Engineer** | Test coverage, automation | Unit tests, integration tests, debugging |
| **Hardware Integration Specialist** | NFC, BLE, device communication | Hardware permissions, device testing |
| **UX Animation Director** | User experience, animations | Payment UI, accessibility, smooth interactions |
| **Solana Mobile Expert** | Blockchain integration | Genesis Tokens, wallet connectivity, transactions |
| **Security Audit Specialist** | Crypto security, vulnerability assessment | Payment security, private key handling |
| **React Native Performance Engineer** | Mobile performance optimization | Bundle size, memory management, startup time |
| **DevOps Deployment Engineer** | CI/CD, deployment automation | Build optimization, pipeline configuration |

## Configuration

Create a `.claude-orchestrator.config.js` file in your project:

```javascript
module.exports = {
  // Agent priorities for your project
  agents: {
    'solana-mobile-expert': { priority: 'high', enabled: true },
    'hardware-integration-specialist': { priority: 'high', enabled: true },
    'security-audit-specialist': { priority: 'high', enabled: true },
    // ... other agents
  },
  
  // Coordination preferences
  coordination: {
    defaultStrategy: 'parallel',
    maxConcurrentAgents: 4,
    timeoutMs: 600000,
    targetBranch: 'develop' // Use develop branch for faster CI feedback
  },
  
  // Project-specific settings
  projectSpecific: {
    framework: 'react-native',
    platform: 'android',
    domains: {
      primary: ['solana-mobile', 'nfc-payments', 'genesis-tokens'],
      secondary: ['ble-expansion', 'security-hardening'],
      emerging: ['bonk-rain', 'multi-recipient-payments']
    }
  }
};
```

## Examples

### Complex Feature Implementation

```bash
claude-orchestrator orchestrate "implement Bluetooth Revolution feature with Genesis Token verification, comprehensive testing, and security audit"
```

**Result**: Coordinates architecture review → blockchain implementation → hardware integration → security audit → testing

### Performance Optimization

```bash
claude-orchestrator orchestrate "optimize app startup time and reduce bundle size with performance testing"
```

**Result**: Coordinates performance analysis → bundle optimization → testing validation

### Security-First Development

```bash
claude-orchestrator orchestrate "add payment encryption with security review and vulnerability assessment"
```

**Result**: Coordinates security design → implementation → audit → testing

## Commands

### Orchestration

```bash
# Create and execute orchestration plan
claude-orchestrator orchestrate "task description"

# Plan only (no execution)
claude-orchestrator orchestrate "task description" --plan-only

# Specify agents manually
claude-orchestrator orchestrate "task description" --agents architecture-reviewer,test-automation-engineer

# Use specific coordination strategy
claude-orchestrator orchestrate "task description" --strategy sequential
```

### Agent Management

```bash
# List all available agents
claude-orchestrator agents

# Get detailed agent information
claude-orchestrator agents:describe architecture-reviewer

# Get agent suggestions for a task
claude-orchestrator agents:suggest "implement wallet integration"
```

### Interactive Mode

```bash
# Start interactive orchestration session
claude-orchestrator interactive

# Or use the short alias
claude-orchestrator i
```

### Project Setup

```bash
# Initialize with template
claude-orchestrator init --template react-native
claude-orchestrator init --template web
claude-orchestrator init --template general

# Check orchestrator status
claude-orchestrator status
```

### Analysis

```bash
# Analyze if a request benefits from orchestration
claude-orchestrator analyze "build a payment system"
```

## Slash Commands (Claude Code Integration)

When using Claude Code CLI, the orchestrator provides slash commands:

```bash
# In Claude Code CLI
/orchestrate implement BLE payments with security review
/agents list
/agents describe solana-mobile-expert
/orchestrate-plan create comprehensive testing suite
/orchestrate-status
```

## Configuration Templates

### React Native Mobile App

```bash
claude-orchestrator init --template react-native
```

Optimizes for:
- Mobile performance and UX
- Hardware integrations (NFC/BLE)
- Bundle size optimization
- Accessibility compliance

### Web Application

```bash
claude-orchestrator init --template web
```

Optimizes for:
- Web performance
- Browser compatibility
- Progressive Web App features
- SEO optimization

### Blockchain/Crypto Project

```bash
claude-orchestrator init --template blockchain
```

Optimizes for:
- Security audits
- Smart contract integration
- Crypto payment flows
- Compliance requirements

## Best Practices

### 1. Task Description

✅ **Good**: "implement BLE payment system with Genesis Token verification, comprehensive testing, and security audit"

❌ **Avoid**: "add BLE stuff"

### 2. Agent Selection

- Let the orchestrator suggest agents based on task analysis
- Override only when you have specific requirements
- Consider dependencies between agents

### 3. Coordination Strategy

- **Parallel**: Independent tasks, maximum speed
- **Sequential**: Dependent tasks, careful handoffs
- **Phased Parallel**: Complex tasks with multiple phases

### 4. Configuration

- Use project-specific configuration
- Set agent priorities based on your domain
- Configure validation commands for quality gates

## Troubleshooting

### Claude Code CLI Not Found

```bash
# Install Claude Code CLI
npm install -g @anthropic/claude-cli

# Or follow official docs
open https://docs.anthropic.com/en/docs/claude-code
```

### Permission Errors

```bash
# Fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

### Agent Coordination Issues

```bash
# Check orchestrator status
claude-orchestrator status

# Use sequential strategy for debugging
claude-orchestrator orchestrate "task" --strategy sequential
```

## Advanced Usage

### Custom Agent Workflows

```javascript
// .claude-orchestrator.config.js
module.exports = {
  customWorkflows: {
    'security-first': {
      phases: [
        { name: 'Security Analysis', agents: ['security-audit-specialist'] },
        { name: 'Implementation', agents: ['architecture-reviewer', 'solana-mobile-expert'] },
        { name: 'Validation', agents: ['test-automation-engineer'] }
      ]
    }
  }
};
```

### Integration with CI/CD

```yaml
# .github/workflows/orchestrated-review.yml
name: Orchestrated Code Review
on: [pull_request]

jobs:
  orchestrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install orchestrator
        run: npm install -g claude-code-orchestrator
      - name: Run orchestrated review
        run: claude-orchestrator orchestrate "review PR changes for security and performance" --plan-only
```

## Contributing

1. Clone the repository
2. Install dependencies: `npm install`
3. Run in development: `npm run dev`
4. Build: `npm run build`
5. Test: `npm test`

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://github.com/True-Tap/claude-code-orchestrator/docs)
- 🐛 [Issue Tracker](https://github.com/True-Tap/claude-code-orchestrator/issues)
- 💬 [Discussions](https://github.com/True-Tap/claude-code-orchestrator/discussions)

---

Built with ❤️ for the Claude Code ecosystem