import { Service } from 'typedi';

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; message: string; level: string }>;
}

export interface TracerOptions {
  serviceName?: string;
  enabled?: boolean;
}

@Service()
export class Tracer {
  private options: Required<TracerOptions>;
  private activeSpans: Map<string, SpanContext>;

  constructor(options: TracerOptions = {}) {
    this.options = {
      serviceName: options.serviceName ?? 'bos-platform',
      enabled: options.enabled ?? true,
    };
    this.activeSpans = new Map();
  }

  generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  startSpan(
    operationName: string,
    tags: Record<string, any> = {},
    parentContext?: Partial<SpanContext>
  ): SpanContext {
    if (!this.options.enabled) {
      return this.createEmptySpan();
    }

    const traceId = parentContext?.traceId || this.generateId();
    const spanId = this.generateId();

    const span: SpanContext = {
      traceId,
      spanId,
      parentSpanId: parentContext?.spanId,
      operationName,
      startTime: Date.now(),
      tags: { ...tags, service: this.options.serviceName },
      logs: [],
    };

    this.activeSpans.set(spanId, span);
    this.log(spanId, 'span started', 'info');

    return span;
  }

  endSpan(span: SpanContext, result?: { status: string; [key: string]: any }): void {
    if (!this.options.enabled) {
      return;
    }

    const duration = Date.now() - span.startTime;
    this.log(span.spanId, `span ended: ${duration}ms`, 'info');

    if (result) {
      this.setTag(span.spanId, 'status', result.status);
      Object.entries(result).forEach(([key, value]) => {
        if (key !== 'status') {
          this.setTag(span.spanId, key, value);
        }
      });
    }

    this.activeSpans.delete(span.spanId);
  }

  log(spanId: string, message: string, level: string = 'info'): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        message,
        level,
      });
    }
  }

  setTag(spanId: string, key: string, value: any): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  getActiveSpan(spanId: string): SpanContext | undefined {
    return this.activeSpans.get(spanId);
  }

  private createEmptySpan(): SpanContext {
    return {
      traceId: '',
      spanId: '',
      operationName: '',
      startTime: 0,
      tags: {},
      logs: [],
    };
  }

  extractContext(headers: Record<string, string>): Partial<SpanContext> | null {
    const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
    const spanId = headers['x-span-id'] || headers['X-Span-Id'];

    if (!traceId || !spanId) {
      return null;
    }

    return {
      traceId,
      spanId: headers['x-parent-span-id'] || headers['X-Parent-Span-Id'] || spanId,
    };
  }

  injectContext(span: SpanContext, headers: Record<string, string> = {}): Record<string, string> {
    headers['x-trace-id'] = span.traceId;
    headers['x-span-id'] = span.spanId;
    return headers;
  }
}
