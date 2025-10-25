type Sample = number;

type Percentile = 0.5 | 0.95;

const percentile = (values: Sample[], p: Percentile) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
};

export interface MetricSnapshot {
  count: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
}

export class MetricsRegistry {
  private timers: Map<string, Sample[]> = new Map();
  private errors: Map<string, number> = new Map();

  recordDuration(metricName: string, durationMs: number) {
    const bucket = this.timers.get(metricName) ?? [];
    bucket.push(durationMs);
    this.timers.set(metricName, bucket.slice(-1000));
  }

  incrementError(metricName: string) {
    const current = this.errors.get(metricName) ?? 0;
    this.errors.set(metricName, current + 1);
  }

  snapshot(metricName: string): MetricSnapshot {
    const samples = this.timers.get(metricName) ?? [];
    if (samples.length === 0) {
      return { count: 0, min: 0, max: 0, p50: 0, p95: 0 };
    }
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    return {
      count: samples.length,
      min,
      max,
      p50: percentile(samples, 0.5),
      p95: percentile(samples, 0.95)
    };
  }

  errorCount(metricName: string) {
    return this.errors.get(metricName) ?? 0;
  }
}

export const globalMetrics = new MetricsRegistry();
