import { Request, Response } from 'express';

export interface HealthStatus {
    status: 'green' | 'yellow' | 'red';
    metrics: {
        uptime_seconds: number;
        memory_usage_mb: number;
        active_requests: number;
        active_connections: number;
        error_rate_1m: number;
    };
    self_heal_hint?: string;
}

export class HealthMonitor {
    private startTime: number;
    private activeRequests = 0;
    private errorTimestampsMs: number[] = [];

    constructor() {
        this.startTime = Date.now();
    }

    public trackRequestStart() {
        this.activeRequests++;
    }

    public trackRequestEnd() {
        this.activeRequests = Math.max(0, this.activeRequests - 1);
    }

    public getActiveRequests() {
        return this.activeRequests;
    }

    public trackError() {
        const now = Date.now();
        this.errorTimestampsMs.push(now);
        // Keep at most a small tail to avoid unbounded memory.
        if (this.errorTimestampsMs.length > 2000) {
            this.errorTimestampsMs.splice(0, this.errorTimestampsMs.length - 2000);
        }
    }

    private getErrorRate1m(nowMs: number): number {
        const cutoff = nowMs - 60_000;
        while (this.errorTimestampsMs.length > 0 && this.errorTimestampsMs[0] < cutoff) {
            this.errorTimestampsMs.shift();
        }
        // Approx: errors per second over the last minute.
        return Math.round((this.errorTimestampsMs.length / 60) * 1000) / 1000;
    }

    public getStatus(): HealthStatus {
        const now = Date.now();
        const memory = process.memoryUsage().heapUsed / 1024 / 1024;
        const uptime = (now - this.startTime) / 1000;

        let status: HealthStatus['status'] = 'green';
        let hint;

        // "Active Robustness" Logic: Self-diagnose load
        if (memory > 200) { // arbitrary budget from specs
            status = 'yellow';
            hint = 'memory_pressure_warning';
        }
        if (memory > 250) {
            status = 'red';
            hint = 'restart_recommended';
        }

        return {
            status,
            metrics: {
                uptime_seconds: Math.floor(uptime),
                memory_usage_mb: Math.round(memory * 100) / 100,
                active_requests: this.activeRequests,
                active_connections: this.activeRequests,
                error_rate_1m: this.getErrorRate1m(now)
            },
            self_heal_hint: hint
        };
    }

    public handleRequest = (_req: Request, res: Response) => {
        const status = this.getStatus();
        res.status(status.status === 'red' ? 503 : 200).json(status);
    };

    public getPrometheusMetrics(): string {
        const status = this.getStatus();
        return [
            '# HELP mcp_uptime_seconds Server uptime in seconds',
            '# TYPE mcp_uptime_seconds gauge',
            `mcp_uptime_seconds ${status.metrics.uptime_seconds}`,
            '',
            '# HELP mcp_memory_usage_mb Heap memory usage in MB',
            '# TYPE mcp_memory_usage_mb gauge',
            `mcp_memory_usage_mb ${status.metrics.memory_usage_mb}`,
            '',
            '# HELP mcp_active_requests Number of currently active requests',
            '# TYPE mcp_active_requests gauge',
            `mcp_active_requests ${status.metrics.active_requests}`,
            '',
            '# HELP mcp_error_rate_1m Error rate per second over last minute',
            '# TYPE mcp_error_rate_1m gauge',
            `mcp_error_rate_1m ${status.metrics.error_rate_1m}`,
        ].join('\n');
    }

    public handleMetricsRequest = (_req: Request, res: Response) => {
        res.set('Content-Type', 'text/plain');
        res.send(this.getPrometheusMetrics());
    };
}
