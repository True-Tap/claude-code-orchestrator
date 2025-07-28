/**
 * Execution Monitor
 * 
 * Real-time performance monitoring system with predictive failure detection,
 * resource optimization, and comprehensive metrics collection for multi-agent orchestration.
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { 
  ExecutionMetrics, 
  AgentPerformance, 
  AgentSession, 
  AgentTask,
  ExecutionProgress 
} from '../types';

export interface SystemMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  activeProcesses: number;
  systemLoad: number[];
}

export interface PerformanceAlert {
  id: string;
  type: 'performance' | 'resource' | 'failure' | 'anomaly';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  metrics: Record<string, number>;
  affectedSessions: string[];
  suggestedActions: string[];
  timestamp: Date;
  acknowledged: boolean;
}

export interface PredictiveInsight {
  id: string;
  type: 'bottleneck' | 'failure_risk' | 'optimization' | 'scaling';
  confidence: number;
  description: string;
  predictedTime: Date;
  impactAssessment: 'low' | 'medium' | 'high' | 'critical';
  preventiveActions: string[];
  basedOnMetrics: string[];
}

export interface ResourceOptimization {
  sessionId: string;
  agentId: string;
  currentUsage: SystemMetrics;
  recommendedAllocation: {
    cpu: number;
    memory: number;
    priority: number;
  };
  expectedImprovement: number;
  reasoning: string;
}

export interface MonitoringConfig {
  metricsRetentionDays: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
  };
  predictionWindow: number; // minutes
  samplingInterval: number; // milliseconds
}

export class ExecutionMonitor extends EventEmitter {
  private systemMetrics: SystemMetrics[] = [];
  private executionMetrics: Map<string, ExecutionMetrics[]> = new Map();
  private agentPerformance: Map<string, AgentPerformance> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private predictions: Map<string, PredictiveInsight> = new Map();
  
  private config: MonitoringConfig;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;
  private analysisInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    
    this.config = {
      metricsRetentionDays: config.metricsRetentionDays || 7,
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        responseTime: 30000, // 30 seconds
        errorRate: 0.1, // 10%
        ...config.alertThresholds,
      },
      predictionWindow: config.predictionWindow || 30,
      samplingInterval: config.samplingInterval || 5000,
    };
  }

  /**
   * Start monitoring system and agent performance
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.emit('monitoringStarted');

    // Start metrics collection
    this.metricsCollectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.samplingInterval);

    // Start analysis and prediction
    this.analysisInterval = setInterval(() => {
      this.performAnalysis();
      this.generatePredictions();
      this.optimizeResources();
    }, 30000); // Every 30 seconds

    // Start background cleanup
    this.startCleanupTasks();
  }

  /**
   * Stop monitoring and cleanup
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    this.emit('monitoringStopped');
  }

  /**
   * Record execution metrics for an agent
   */
  recordExecutionMetrics(
    sessionId: string,
    agentId: string,
    metrics: Omit<ExecutionMetrics, 'sessionId' | 'agentId' | 'timestamp'>
  ): void {
    const fullMetrics: ExecutionMetrics = {
      sessionId,
      agentId,
      timestamp: new Date(),
      ...metrics,
    };

    const agentMetrics = this.executionMetrics.get(agentId) || [];
    agentMetrics.push(fullMetrics);
    this.executionMetrics.set(agentId, agentMetrics);

    // Update agent performance summary
    this.updateAgentPerformance(agentId, fullMetrics);

    this.emit('metricsRecorded', { metrics: fullMetrics });
  }

  /**
   * Get real-time performance dashboard data
   */
  getDashboardData(): {
    systemHealth: SystemMetrics;
    activeAlerts: PerformanceAlert[];
    topPerformingAgents: AgentPerformance[];
    resourceUtilization: Record<string, number>;
    recentPredictions: PredictiveInsight[];
  } {
    const systemHealth = this.getCurrentSystemMetrics();
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const topPerformingAgents = Array.from(this.agentPerformance.values())
      .sort((a, b) => b.collaborationScore - a.collaborationScore)
      .slice(0, 5);

    const resourceUtilization = {
      cpu: systemHealth.cpuUsage,
      memory: systemHealth.memoryUsage,
      disk: systemHealth.diskUsage,
      network: systemHealth.networkLatency,
    };

    const recentPredictions = Array.from(this.predictions.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return {
      systemHealth,
      activeAlerts,
      topPerformingAgents,
      resourceUtilization,
      recentPredictions,
    };
  }

  /**
   * Get detailed performance analysis for a session
   */
  getSessionAnalysis(sessionId: string): {
    performance: ExecutionMetrics[];
    trends: Record<string, number[]>;
    bottlenecks: string[];
    recommendations: string[];
  } {
    const sessionMetrics = Array.from(this.executionMetrics.values())
      .flat()
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate trends
    const trends = this.calculatePerformanceTrends(sessionMetrics);
    
    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(sessionMetrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(sessionMetrics, bottlenecks);

    return {
      performance: sessionMetrics,
      trends,
      bottlenecks,
      recommendations,
    };
  }

  /**
   * Get agent performance comparison
   */
  getAgentComparison(): {
    rankings: AgentPerformance[];
    categories: Record<string, AgentPerformance[]>;
    insights: string[];
  } {
    const agents = Array.from(this.agentPerformance.values());
    
    const rankings = agents.sort((a, b) => {
      // Overall score based on multiple factors
      const scoreA = a.successRate * 0.4 + 
                   (1 / a.averageExecutionTime) * 0.3 + 
                   a.collaborationScore * 0.3;
      const scoreB = b.successRate * 0.4 + 
                   (1 / b.averageExecutionTime) * 0.3 + 
                   b.collaborationScore * 0.3;
      return scoreB - scoreA;
    });

    const categories = {
      fastest: agents.sort((a, b) => a.averageExecutionTime - b.averageExecutionTime).slice(0, 3),
      mostReliable: agents.sort((a, b) => b.successRate - a.successRate).slice(0, 3),
      bestCollaborators: agents.sort((a, b) => b.collaborationScore - a.collaborationScore).slice(0, 3),
      mostActive: agents.sort((a, b) => b.totalTasks - a.totalTasks).slice(0, 3),
    };

    const insights = this.generateAgentInsights(agents);

    return { rankings, categories, insights };
  }

  /**
   * Predict potential failures or issues
   */
  predictFailures(sessionId?: string): PredictiveInsight[] {
    const relevantMetrics = sessionId 
      ? Array.from(this.executionMetrics.values())
          .flat()
          .filter(m => m.sessionId === sessionId)
      : Array.from(this.executionMetrics.values()).flat();

    const predictions: PredictiveInsight[] = [];

    // CPU bottleneck prediction
    const cpuTrend = this.calculateTrend(relevantMetrics.map(m => m.cpuUsage));
    if (cpuTrend > 0.1 && this.getCurrentSystemMetrics().cpuUsage > 70) {
      predictions.push({
        id: uuidv4(),
        type: 'bottleneck',
        confidence: Math.min(0.95, cpuTrend * 10),
        description: 'CPU usage trending upward, potential bottleneck in 15-20 minutes',
        predictedTime: new Date(Date.now() + 15 * 60000),
        impactAssessment: 'high',
        preventiveActions: [
          'Scale down non-critical agents',
          'Optimize agent workload distribution',
          'Consider adding more compute resources'
        ],
        basedOnMetrics: ['cpuUsage', 'systemLoad'],
      });
    }

    // Memory leak prediction
    const memoryTrend = this.calculateTrend(relevantMetrics.map(m => m.memoryUsage));
    if (memoryTrend > 0.05) {
      predictions.push({
        id: uuidv4(),
        type: 'failure_risk',
        confidence: Math.min(0.8, memoryTrend * 20),
        description: 'Potential memory leak detected in agent processes',
        predictedTime: new Date(Date.now() + 30 * 60000),
        impactAssessment: 'medium',
        preventiveActions: [
          'Restart agents with highest memory usage',
          'Enable memory profiling',
          'Review agent code for memory leaks'
        ],
        basedOnMetrics: ['memoryUsage'],
      });
    }

    // Task queue overflow prediction
    const taskQueueTrend = this.calculateTrend(relevantMetrics.map(m => m.taskQueue));
    if (taskQueueTrend > 0.2) {
      predictions.push({
        id: uuidv4(),
        type: 'bottleneck',
        confidence: 0.75,
        description: 'Task queue growth may lead to processing delays',
        predictedTime: new Date(Date.now() + 10 * 60000),
        impactAssessment: 'medium',
        preventiveActions: [
          'Add more agent instances',
          'Optimize task distribution',
          'Prioritize critical tasks'
        ],
        basedOnMetrics: ['taskQueue', 'responseTime'],
      });
    }

    // Store predictions
    predictions.forEach(prediction => {
      this.predictions.set(prediction.id, prediction);
    });

    return predictions;
  }

  /**
   * Optimize resource allocation based on current performance
   */
  optimizeResourceAllocation(sessionId?: string): ResourceOptimization[] {
    const optimizations: ResourceOptimization[] = [];
    const currentSystem = this.getCurrentSystemMetrics();

    for (const [agentId, performance] of this.agentPerformance) {
      if (sessionId) {
        const agentMetrics = this.executionMetrics.get(agentId) || [];
        const sessionSpecific = agentMetrics.filter(m => m.sessionId === sessionId);
        if (sessionSpecific.length === 0) continue;
      }

      const recentMetrics = this.getRecentMetrics(agentId, 10); // Last 10 metrics
      if (recentMetrics.length === 0) continue;

      const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length;
      const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;

      let recommendation: ResourceOptimization | null = null;

      // High CPU usage agent
      if (avgCpu > 80 && performance.successRate < 0.8) {
        recommendation = {
          sessionId: sessionId || 'global',
          agentId,
          currentUsage: currentSystem,
          recommendedAllocation: {
            cpu: Math.min(avgCpu * 1.5, 100),
            memory: avgMemory * 1.2,
            priority: 1, // High priority
          },
          expectedImprovement: 25,
          reasoning: 'High CPU usage with low success rate - needs more resources',
        };
      }
      // Underutilized agent
      else if (avgCpu < 20 && avgMemory < 30 && performance.totalTasks > 50) {
        recommendation = {
          sessionId: sessionId || 'global',
          agentId,
          currentUsage: currentSystem,
          recommendedAllocation: {
            cpu: avgCpu * 0.7,
            memory: avgMemory * 0.8,
            priority: -1, // Lower priority
          },
          expectedImprovement: 15,
          reasoning: 'Underutilized resources - can be optimized for efficiency',
        };
      }
      // Well-performing agent
      else if (performance.successRate > 0.9 && performance.averageExecutionTime < 30000) {
        recommendation = {
          sessionId: sessionId || 'global',
          agentId,
          currentUsage: currentSystem,
          recommendedAllocation: {
            cpu: avgCpu,
            memory: avgMemory,
            priority: 0, // Maintain current allocation
          },
          expectedImprovement: 5,
          reasoning: 'Agent performing well - maintain current resource allocation',
        };
      }

      if (recommendation) {
        optimizations.push(recommendation);
      }
    }

    return optimizations.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
  }

  /**
   * Generate performance report
   */
  async generateReport(
    sessionId?: string,
    format: 'json' | 'csv' | 'html' = 'json'
  ): Promise<string> {
    const reportData = {
      generatedAt: new Date(),
      sessionId: sessionId || 'all',
      systemOverview: this.getCurrentSystemMetrics(),
      agentPerformance: Array.from(this.agentPerformance.values()),
      alerts: Array.from(this.alerts.values()),
      predictions: Array.from(this.predictions.values()),
      optimizations: this.optimizeResourceAllocation(sessionId),
    };

    switch (format) {
      case 'json':
        return JSON.stringify(reportData, null, 2);
        
      case 'csv':
        return this.generateCSVReport(reportData);
        
      case 'html':
        return this.generateHTMLReport(reportData);
        
      default:
        return JSON.stringify(reportData, null, 2);
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const loadAvg = os.loadavg();

      // Calculate CPU usage (simplified)
      const cpuUsage = Math.max(0, 100 - (freeMem / totalMem) * 100);
      
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        cpuUsage: cpuUsage,
        memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
        diskUsage: await this.getDiskUsage(),
        networkLatency: await this.measureNetworkLatency(),
        activeProcesses: await this.getActiveProcessCount(),
        systemLoad: loadAvg,
      };

      this.systemMetrics.push(metrics);

      // Keep only recent metrics
      const retentionTime = Date.now() - (this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
      this.systemMetrics = this.systemMetrics.filter(m => m.timestamp.getTime() > retentionTime);

      this.emit('systemMetricsCollected', { metrics });
    } catch (error) {
      this.emit('metricsCollectionError', { error });
    }
  }

  private async getDiskUsage(): Promise<number> {
    try {
      const stats = await fs.statfs('.');
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      return ((total - free) / total) * 100;
    } catch {
      return 0;
    }
  }

  private async measureNetworkLatency(): Promise<number> {
    // Simplified latency measurement
    const start = Date.now();
    try {
      // In a real implementation, would ping a known endpoint
      await new Promise(resolve => setTimeout(resolve, 1));
      return Date.now() - start;
    } catch {
      return 999;
    }
  }

  private async getActiveProcessCount(): Promise<number> {
    // Simplified process count
    return process.pid ? 1 : 0;
  }

  private getCurrentSystemMetrics(): SystemMetrics {
    return this.systemMetrics[this.systemMetrics.length - 1] || {
      timestamp: new Date(),
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkLatency: 0,
      activeProcesses: 0,
      systemLoad: [0, 0, 0],
    };
  }

  private updateAgentPerformance(agentId: string, metrics: ExecutionMetrics): void {
    const existing = this.agentPerformance.get(agentId) || {
      agentId,
      totalTasks: 0,
      successRate: 1.0,
      averageExecutionTime: 0,
      averageResponseTime: 0,
      specializations: [],
      collaborationScore: 0.5,
    };

    const allAgentMetrics = this.executionMetrics.get(agentId) || [];
    const totalTasks = allAgentMetrics.length;
    const successfulTasks = allAgentMetrics.filter(m => m.errorRate === 0).length;
    
    const avgExecutionTime = allAgentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalTasks;
    const avgResponseTime = allAgentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalTasks;

    const updated: AgentPerformance = {
      ...existing,
      totalTasks,
      successRate: successfulTasks / totalTasks,
      averageExecutionTime: avgExecutionTime,
      averageResponseTime: avgResponseTime,
      collaborationScore: this.calculateCollaborationScore(agentId),
    };

    this.agentPerformance.set(agentId, updated);
  }

  private calculateCollaborationScore(agentId: string): number {
    // Simple collaboration score based on task sharing and communication
    const agentMetrics = this.executionMetrics.get(agentId) || [];
    
    // Factors: task completion rate, response time, and relative performance
    const completionRate = agentMetrics.filter(m => m.errorRate === 0).length / Math.max(agentMetrics.length, 1);
    const avgResponseTime = agentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / Math.max(agentMetrics.length, 1);
    const responseScore = Math.max(0, 1 - (avgResponseTime / 60000)); // Normalize to 1 minute
    
    return (completionRate * 0.6 + responseScore * 0.4);
  }

  private performAnalysis(): void {
    const currentMetrics = this.getCurrentSystemMetrics();
    
    // Check alert thresholds
    if (currentMetrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
      this.createAlert('performance', 'High CPU Usage', 
        `CPU usage at ${currentMetrics.cpuUsage.toFixed(1)}%`, 'warning');
    }

    if (currentMetrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.createAlert('resource', 'High Memory Usage',
        `Memory usage at ${currentMetrics.memoryUsage.toFixed(1)}%`, 'warning');
    }

    // Check agent performance
    for (const [agentId, performance] of this.agentPerformance) {
      if (performance.successRate < 0.7) {
        this.createAlert('performance', 'Low Agent Success Rate',
          `Agent ${agentId} success rate: ${(performance.successRate * 100).toFixed(1)}%`, 'error');
      }

      if (performance.averageResponseTime > this.config.alertThresholds.responseTime) {
        this.createAlert('performance', 'Slow Agent Response',
          `Agent ${agentId} average response time: ${(performance.averageResponseTime / 1000).toFixed(1)}s`, 'warning');
      }
    }
  }

  private generatePredictions(): void {
    // Clear old predictions
    const cutoff = Date.now() - (60 * 60000); // 1 hour old
    for (const [id, prediction] of this.predictions) {
      if (prediction.predictedTime.getTime() < cutoff) {
        this.predictions.delete(id);
      }
    }

    // Generate new predictions
    this.predictFailures();
  }

  private optimizeResources(): void {
    const optimizations = this.optimizeResourceAllocation();
    if (optimizations.length > 0) {
      this.emit('optimizationSuggestions', { optimizations });
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    title: string,
    description: string,
    severity: PerformanceAlert['severity']
  ): void {
    const alertId = uuidv4();
    const alert: PerformanceAlert = {
      id: alertId,
      type,
      severity,
      title,
      description,
      metrics: {},
      affectedSessions: [],
      suggestedActions: this.generateAlertActions(type, severity),
      timestamp: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alertId, alert);
    this.emit('alertGenerated', { alert });
  }

  private generateAlertActions(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity']
  ): string[] {
    const actions: string[] = [];

    switch (type) {
      case 'performance':
        actions.push('Review agent workload distribution');
        actions.push('Consider scaling resources');
        if (severity === 'critical') {
          actions.push('Restart underperforming agents');
        }
        break;
        
      case 'resource':
        actions.push('Monitor resource usage trends');
        actions.push('Optimize agent resource allocation');
        if (severity === 'error' || severity === 'critical') {
          actions.push('Add more system resources');
        }
        break;
        
      case 'failure':
        actions.push('Investigate failure patterns');
        actions.push('Review error logs');
        actions.push('Implement retry mechanisms');
        break;
    }

    return actions;
  }

  private calculatePerformanceTrends(metrics: ExecutionMetrics[]): Record<string, number[]> {
    const windowSize = 10;
    const trends: Record<string, number[]> = {
      cpuUsage: [],
      memoryUsage: [],
      responseTime: [],
      errorRate: [],
    };

    for (let i = windowSize; i < metrics.length; i++) {
      const window = metrics.slice(i - windowSize, i);
      
      trends.cpuUsage.push(window.reduce((sum, m) => sum + m.cpuUsage, 0) / windowSize);
      trends.memoryUsage.push(window.reduce((sum, m) => sum + m.memoryUsage, 0) / windowSize);
      trends.responseTime.push(window.reduce((sum, m) => sum + m.responseTime, 0) / windowSize);
      trends.errorRate.push(window.reduce((sum, m) => sum + m.errorRate, 0) / windowSize);
    }

    return trends;
  }

  private identifyBottlenecks(metrics: ExecutionMetrics[]): string[] {
    const bottlenecks: string[] = [];
    
    if (metrics.length === 0) return bottlenecks;

    const avgCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;
    const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
    const avgResponse = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const avgQueue = metrics.reduce((sum, m) => sum + m.taskQueue, 0) / metrics.length;

    if (avgCpu > 80) bottlenecks.push('High CPU usage affecting performance');
    if (avgMemory > 85) bottlenecks.push('Memory constraints limiting throughput');
    if (avgResponse > 30000) bottlenecks.push('Slow response times impacting user experience');
    if (avgQueue > 10) bottlenecks.push('Task queue backlog causing delays');

    return bottlenecks;
  }

  private generateRecommendations(metrics: ExecutionMetrics[], bottlenecks: string[]): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.some(b => b.includes('CPU'))) {
      recommendations.push('Consider horizontal scaling of agents');
      recommendations.push('Optimize CPU-intensive operations');
    }

    if (bottlenecks.some(b => b.includes('Memory'))) {
      recommendations.push('Implement memory pooling for agents');
      recommendations.push('Review memory leak patterns');
    }

    if (bottlenecks.some(b => b.includes('response'))) {
      recommendations.push('Implement response caching');
      recommendations.push('Optimize task execution paths');
    }

    if (bottlenecks.some(b => b.includes('queue'))) {
      recommendations.push('Add more agent instances');
      recommendations.push('Implement priority-based task scheduling');
    }

    return recommendations;
  }

  private generateAgentInsights(agents: AgentPerformance[]): string[] {
    const insights: string[] = [];

    const bestPerformer = agents.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    );
    insights.push(`Best performing agent: ${bestPerformer.agentId} (${(bestPerformer.successRate * 100).toFixed(1)}% success rate)`);

    const fastestAgent = agents.reduce((fastest, current) =>
      current.averageExecutionTime < fastest.averageExecutionTime ? current : fastest
    );
    insights.push(`Fastest agent: ${fastestAgent.agentId} (${(fastestAgent.averageExecutionTime / 1000).toFixed(1)}s avg)`);

    const mostActive = agents.reduce((active, current) =>
      current.totalTasks > active.totalTasks ? current : active
    );
    insights.push(`Most active agent: ${mostActive.agentId} (${mostActive.totalTasks} tasks)`);

    return insights;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private getRecentMetrics(agentId: string, count: number): ExecutionMetrics[] {
    const allMetrics = this.executionMetrics.get(agentId) || [];
    return allMetrics.slice(-count);
  }

  private generateCSVReport(data: any): string {
    // Simplified CSV generation
    const lines = ['Metric,Value'];
    lines.push(`Generated At,${data.generatedAt}`);
    lines.push(`CPU Usage,${data.systemOverview.cpuUsage}`);
    lines.push(`Memory Usage,${data.systemOverview.memoryUsage}`);
    lines.push(`Active Alerts,${data.alerts.length}`);
    return lines.join('\n');
  }

  private generateHTMLReport(data: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; }
        .alert { background-color: #fff3cd; padding: 10px; margin: 5px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Performance Report</h1>
    <p>Generated at: ${data.generatedAt}</p>
    
    <h2>System Overview</h2>
    <div class="metric">CPU Usage: ${data.systemOverview.cpuUsage.toFixed(1)}%</div>
    <div class="metric">Memory Usage: ${data.systemOverview.memoryUsage.toFixed(1)}%</div>
    
    <h2>Active Alerts</h2>
    ${data.alerts.map((alert: PerformanceAlert) => 
      `<div class="alert">${alert.title}: ${alert.description}</div>`
    ).join('')}
</body>
</html>`;
  }

  private startCleanupTasks(): void {
    // Clean up old metrics and alerts daily
    setInterval(() => {
      const cutoff = Date.now() - (this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
      
      // Clean system metrics
      this.systemMetrics = this.systemMetrics.filter(m => m.timestamp.getTime() > cutoff);
      
      // Clean execution metrics
      for (const [agentId, metrics] of this.executionMetrics) {
        const cleaned = metrics.filter(m => m.timestamp.getTime() > cutoff);
        this.executionMetrics.set(agentId, cleaned);
      }
      
      // Clean old alerts
      for (const [id, alert] of this.alerts) {
        if (alert.timestamp.getTime() < cutoff && alert.acknowledged) {
          this.alerts.delete(id);
        }
      }
      
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }
}