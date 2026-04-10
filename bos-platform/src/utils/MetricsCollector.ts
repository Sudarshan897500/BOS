import { Service } from 'typedi';

export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  points: MetricPoint[];
  unit?: string;
}

export interface MetricsSummary {
  avgFlowDurationMs: number;
  jobSuccessRate: number;
  batchThroughputPerMin: number;
  activeWorkflows: number;
  queueDepth: number;
  errorRate: number;
}

@Service()
export class MetricsCollector {
  private metrics: Map<string, MetricSeries>;
  private windowSize: number;

  constructor(windowSize: number = 100) {
    this.metrics = new Map();
    this.windowSize = windowSize;
  }

  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const series = this.getOrCreateSeries(name, 'counter');
    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      labels,
    };
    
    series.points.push(point);
    if (series.points.length > this.windowSize) {
      series.points.shift();
    }
  }

  record(name: string, value: number, labels?: Record<string, string>): void {
    const series = this.getOrCreateSeries(name, 'gauge');
    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      labels,
    };
    
    series.points.push(point);
    if (series.points.length > this.windowSize) {
      series.points.shift();
    }
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const series = this.getOrCreateSeries(name, 'histogram');
    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      labels,
    };
    
    series.points.push(point);
    if (series.points.length > this.windowSize) {
      series.points.shift();
    }
  }

  getMetric(name: string): MetricSeries | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Map<string, MetricSeries> {
    return new Map(this.metrics);
  }

  getSummary(): MetricsSummary {
    const flowDuration = this.calculateAverage('flow_duration_ms');
    const jobMetrics = this.getJobMetrics();
    const batchMetrics = this.getBatchMetrics();
    const errorRate = this.calculateErrorRate();

    return {
      avgFlowDurationMs: flowDuration,
      jobSuccessRate: jobMetrics.successRate,
      batchThroughputPerMin: batchMetrics.throughput,
      activeWorkflows: this.getActiveWorkflowsCount(),
      queueDepth: this.getQueueDepth(),
      errorRate,
    };
  }

  private getOrCreateSeries(name: string, type: 'counter' | 'gauge' | 'histogram'): MetricSeries {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type,
        points: [],
      });
    }
    return this.metrics.get(name)!;
  }

  private calculateAverage(metricName: string): number {
    const series = this.metrics.get(metricName);
    if (!series || series.points.length === 0) {
      return 0;
    }
    
    const sum = series.points.reduce((acc, point) => acc + point.value, 0);
    return sum / series.points.length;
  }

  private getJobMetrics(): { successRate: number } {
    const successes = this.metrics.get('job_success')?.points.length || 0;
    const failures = this.metrics.get('job_failure')?.points.length || 0;
    const total = successes + failures;
    
    return {
      successRate: total > 0 ? successes / total : 0,
    };
  }

  private getBatchMetrics(): { throughput: number } {
    const batchPoints = this.metrics.get('batch_records_processed')?.points || [];
    if (batchPoints.length === 0) {
      return { throughput: 0 };
    }

    const timeWindowMs = 60000; // 1 minute
    const now = Date.now();
    const recentPoints = batchPoints.filter(p => now - p.timestamp <= timeWindowMs);
    const totalRecords = recentPoints.reduce((acc, p) => acc + p.value, 0);

    return {
      throughput: totalRecords,
    };
  }

  private calculateErrorRate(): number {
    const errors = this.metrics.get('errors')?.points.length || 0;
    const totalOps = this.getTotalOperations();
    
    return totalOps > 0 ? errors / totalOps : 0;
  }

  private getTotalOperations(): number {
    let total = 0;
    const operationMetrics = ['flow_executed', 'job_success', 'job_failure', 'batch_completed'];
    
    operationMetrics.forEach(metric => {
      total += this.metrics.get(metric)?.points.length || 0;
    });
    
    return total;
  }

  private getActiveWorkflowsCount(): number {
    const active = this.metrics.get('workflow_active')?.points;
    if (!active || active.length === 0) {
      return 0;
    }
    return active[active.length - 1].value;
  }

  private getQueueDepth(): number {
    const depth = this.metrics.get('queue_depth')?.points;
    if (!depth || depth.length === 0) {
      return 0;
    }
    return depth[depth.length - 1].value;
  }

  clear(): void {
    this.metrics.clear();
  }
}
