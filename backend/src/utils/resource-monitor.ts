#!/usr/bin/env node

import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import os from 'os';

/**
 * Resource monitoring thresholds
 */
interface ResourceThresholds {
	/** Memory usage threshold in MB */
	memoryMB: number;
	/** CPU usage threshold as percentage */
	cpuPercent: number;
	/** Event loop lag threshold in milliseconds */
	eventLoopLagMs: number;
	/** Open file descriptor threshold */
	openFiles: number;
}

/**
 * Current resource usage metrics
 */
interface ResourceMetrics {
	/** Current memory usage in MB */
	memoryUsageMB: number;
	/** Current CPU usage percentage */
	cpuUsagePercent: number;
	/** Current event loop lag in milliseconds */
	eventLoopLagMs: number;
	/** Number of open file descriptors */
	openFiles: number;
	/** System uptime in seconds */
	uptimeSeconds: number;
	/** Free memory percentage */
	freeMemoryPercent: number;
	/** Load average */
	loadAverage: number[];
	/** Process uptime in seconds */
	processUptimeSeconds: number;
}

/**
 * ResourceMonitor provides comprehensive monitoring of system resources
 * to detect potential issues before they cause crashes.
 *
 * Features:
 * - Memory usage monitoring with leak detection
 * - CPU usage tracking
 * - Event loop lag measurement
 * - File descriptor monitoring
 * - System health metrics
 * - Predictive alerting
 *
 * @example
 * ```typescript
 * const monitor = new ResourceMonitor({
 *   memoryMB: 500,
 *   cpuPercent: 80,
 *   eventLoopLagMs: 100,
 *   openFiles: 1000
 * });
 *
 * monitor.on('warning', (metrics) => {
 *   console.warn('Resource warning:', metrics);
 * });
 *
 * monitor.start();
 * ```
 */
export class ResourceMonitor extends EventEmitter {
	private thresholds: ResourceThresholds;
	private monitoringInterval: NodeJS.Timeout | null = null;
	private eventLoopStartTime: number = 0;
	private lastCpuUsage = process.cpuUsage();
	private lastCpuCheck = Date.now();
	private memoryHistory: number[] = [];
	private cpuHistory: number[] = [];
	private isMonitoring: boolean = false;

	private readonly DEFAULT_THRESHOLDS: ResourceThresholds = {
		memoryMB: 500,        // 500MB memory warning
		cpuPercent: 80,       // 80% CPU warning
		eventLoopLagMs: 100,  // 100ms event loop lag warning
		openFiles: 1000       // 1000 open file descriptors warning
	};

	constructor(thresholds?: Partial<ResourceThresholds>) {
		super();
		this.thresholds = { ...this.DEFAULT_THRESHOLDS, ...thresholds };

		console.log('📊 Resource Monitor initialized with thresholds:', this.thresholds);
	}

	/**
	 * Start resource monitoring
	 *
	 * @param intervalMs - Monitoring interval in milliseconds (default: 30000)
	 */
	start(intervalMs: number = 30000): void {
		if (this.isMonitoring) {
			console.warn('⚠️ Resource monitoring is already running');
			return;
		}

		console.log(`🔍 Starting resource monitoring (interval: ${intervalMs}ms)`);
		this.isMonitoring = true;

		// Initial measurement
		this.measureResources();

		// Set up monitoring interval
		this.monitoringInterval = setInterval(() => {
			this.measureResources();
		}, intervalMs);

		// Set up event loop lag monitoring
		this.startEventLoopMonitoring();
	}

	/**
	 * Stop resource monitoring
	 */
	stop(): void {
		if (!this.isMonitoring) {
			return;
		}

		console.log('🛑 Stopping resource monitoring');
		this.isMonitoring = false;

		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}
	}

	/**
	 * Get current resource metrics
	 *
	 * @returns Current resource usage metrics
	 */
	async getCurrentMetrics(): Promise<ResourceMetrics> {
		const memoryUsage = process.memoryUsage();
		const cpuUsage = this.calculateCpuUsage();
		const systemInfo = this.getSystemInfo();

		return {
			memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
			cpuUsagePercent: cpuUsage,
			eventLoopLagMs: await this.measureEventLoopLag(),
			openFiles: await this.getOpenFileCount(),
			uptimeSeconds: os.uptime(),
			freeMemoryPercent: (os.freemem() / os.totalmem()) * 100,
			loadAverage: os.loadavg(),
			processUptimeSeconds: process.uptime()
		};
	}

	/**
	 * Measure and analyze current resource usage
	 */
	private async measureResources(): Promise<void> {
		try {
			const metrics = await this.getCurrentMetrics();

			// Update history
			this.memoryHistory.push(metrics.memoryUsageMB);
			this.cpuHistory.push(metrics.cpuUsagePercent);

			// Keep only last 10 measurements
			if (this.memoryHistory.length > 10) {
				this.memoryHistory.shift();
			}
			if (this.cpuHistory.length > 10) {
				this.cpuHistory.shift();
			}

			// Log current metrics
			this.logMetrics(metrics);

			// Check thresholds and emit warnings
			this.checkThresholds(metrics);

			// Analyze trends
			this.analyzeTrends(metrics);

			// Emit metrics event
			this.emit('metrics', metrics);

		} catch (error) {
			console.error('❌ Error measuring resources:', error);
			this.emit('error', error);
		}
	}

	/**
	 * Log current metrics to console
	 *
	 * @param metrics - Current resource metrics
	 */
	private logMetrics(metrics: ResourceMetrics): void {
		console.log('📊 Resource Metrics:');
		console.log(`   💾 Memory: ${metrics.memoryUsageMB}MB`);
		console.log(`   🖥️  CPU: ${metrics.cpuUsagePercent.toFixed(1)}%`);
		console.log(`   ⏱️  Event Loop Lag: ${metrics.eventLoopLagMs.toFixed(1)}ms`);
		console.log(`   📁 Open Files: ${metrics.openFiles}`);
		console.log(`   🆓 Free Memory: ${metrics.freeMemoryPercent.toFixed(1)}%`);
		console.log(`   ⚖️  Load Average: [${metrics.loadAverage.map(l => l.toFixed(2)).join(', ')}]`);
	}

	/**
	 * Check if metrics exceed thresholds and emit warnings
	 *
	 * @param metrics - Current resource metrics
	 */
	private checkThresholds(metrics: ResourceMetrics): void {
		const warnings: string[] = [];

		if (metrics.memoryUsageMB > this.thresholds.memoryMB) {
			warnings.push(`High memory usage: ${metrics.memoryUsageMB}MB > ${this.thresholds.memoryMB}MB`);
		}

		if (metrics.cpuUsagePercent > this.thresholds.cpuPercent) {
			warnings.push(`High CPU usage: ${metrics.cpuUsagePercent.toFixed(1)}% > ${this.thresholds.cpuPercent}%`);
		}

		if (metrics.eventLoopLagMs > this.thresholds.eventLoopLagMs) {
			warnings.push(`High event loop lag: ${metrics.eventLoopLagMs.toFixed(1)}ms > ${this.thresholds.eventLoopLagMs}ms`);
		}

		if (metrics.openFiles > this.thresholds.openFiles) {
			warnings.push(`High open file count: ${metrics.openFiles} > ${this.thresholds.openFiles}`);
		}

		if (metrics.freeMemoryPercent < 10) {
			warnings.push(`Low system memory: ${metrics.freeMemoryPercent.toFixed(1)}% free`);
		}

		if (warnings.length > 0) {
			console.warn('⚠️ Resource Warnings:');
			warnings.forEach(warning => console.warn(`   ${warning}`));

			this.emit('warning', {
				warnings,
				metrics,
				timestamp: new Date().toISOString()
			});
		}
	}

	/**
	 * Analyze resource usage trends
	 *
	 * @param metrics - Current resource metrics
	 */
	private analyzeTrends(metrics: ResourceMetrics): void {
		// Memory leak detection
		if (this.memoryHistory.length >= 5) {
			const avgGrowth = this.calculateAverageGrowth(this.memoryHistory);
			if (avgGrowth > 10) { // Growing by more than 10MB per measurement
				console.warn(`⚠️ Potential memory leak detected: +${avgGrowth.toFixed(1)}MB/measurement`);
				this.emit('memory_leak_warning', {
					averageGrowth: avgGrowth,
					currentMemory: metrics.memoryUsageMB,
					history: this.memoryHistory
				});
			}
		}

		// CPU spike detection
		if (this.cpuHistory.length >= 3) {
			const recentCpu = this.cpuHistory.slice(-3);
			const avgCpu = recentCpu.reduce((a, b) => a + b, 0) / recentCpu.length;
			if (avgCpu > this.thresholds.cpuPercent) {
				console.warn(`⚠️ Sustained high CPU usage: ${avgCpu.toFixed(1)}% (3 measurements)`);
				this.emit('cpu_spike_warning', {
					averageCpu: avgCpu,
					recentReadings: recentCpu
				});
			}
		}
	}

	/**
	 * Calculate average growth rate from a series of measurements
	 *
	 * @param measurements - Array of measurements
	 * @returns Average growth rate per measurement
	 */
	private calculateAverageGrowth(measurements: number[]): number {
		if (measurements.length < 2) return 0;

		let totalGrowth = 0;
		for (let i = 1; i < measurements.length; i++) {
			totalGrowth += measurements[i] - measurements[i - 1];
		}

		return totalGrowth / (measurements.length - 1);
	}

	/**
	 * Calculate CPU usage percentage
	 *
	 * @returns CPU usage percentage
	 */
	private calculateCpuUsage(): number {
		const currentUsage = process.cpuUsage();
		const currentTime = Date.now();

		const userDiff = currentUsage.user - this.lastCpuUsage.user;
		const systemDiff = currentUsage.system - this.lastCpuUsage.system;
		const timeDiff = (currentTime - this.lastCpuCheck) * 1000; // Convert to microseconds

		this.lastCpuUsage = currentUsage;
		this.lastCpuCheck = currentTime;

		if (timeDiff === 0) return 0;

		return ((userDiff + systemDiff) / timeDiff) * 100;
	}

	/**
	 * Measure event loop lag
	 *
	 * @returns Promise that resolves to event loop lag in milliseconds
	 */
	private measureEventLoopLag(): Promise<number> {
		return new Promise((resolve) => {
			const start = process.hrtime.bigint();
			setImmediate(() => {
				const end = process.hrtime.bigint();
				const lag = Number(end - start) / 1_000_000; // Convert to milliseconds
				resolve(lag);
			});
		});
	}

	/**
	 * Get the number of open file descriptors
	 *
	 * @returns Number of open file descriptors
	 */
	private async getOpenFileCount(): Promise<number> {
		try {
			if (process.platform === 'linux' || process.platform === 'darwin') {
				const result = execSync(`lsof -p ${process.pid} | wc -l`, { encoding: 'utf8' });
				return parseInt(result.trim(), 10) || 0;
			} else {
				// Fallback for other platforms
				return 0;
			}
		} catch (error) {
			// Return 0 if we can't measure (e.g., lsof not available)
			return 0;
		}
	}

	/**
	 * Get system information
	 *
	 * @returns System information object
	 */
	private getSystemInfo(): any {
		return {
			platform: process.platform,
			arch: process.arch,
			nodeVersion: process.version,
			totalMemory: os.totalmem(),
			freeMemory: os.freemem(),
			cpuCount: os.cpus().length,
			uptime: os.uptime()
		};
	}

	/**
	 * Start monitoring event loop lag
	 */
	private startEventLoopMonitoring(): void {
		// Measure event loop lag every 5 seconds
		setInterval(async () => {
			if (!this.isMonitoring) return;

			const lag = await this.measureEventLoopLag();
			if (lag > this.thresholds.eventLoopLagMs) {
				console.warn(`⚠️ High event loop lag: ${lag.toFixed(1)}ms`);
				this.emit('event_loop_lag', { lag });
			}
		}, 5000);
	}

	/**
	 * Generate a comprehensive health report
	 *
	 * @returns Promise that resolves to a health report
	 */
	async generateHealthReport(): Promise<{
		status: 'healthy' | 'warning' | 'critical';
		metrics: ResourceMetrics;
		recommendations: string[];
		trends: {
			memoryTrend: string;
			cpuTrend: string;
		};
	}> {
		const metrics = await this.getCurrentMetrics();
		const recommendations: string[] = [];
		let status: 'healthy' | 'warning' | 'critical' = 'healthy';

		// Assess overall health
		if (metrics.memoryUsageMB > this.thresholds.memoryMB * 1.5) {
			status = 'critical';
			recommendations.push('Memory usage is critically high - consider restarting');
		} else if (metrics.memoryUsageMB > this.thresholds.memoryMB) {
			status = 'warning';
			recommendations.push('Memory usage is high - monitor for leaks');
		}

		if (metrics.cpuUsagePercent > this.thresholds.cpuPercent) {
			status = status === 'critical' ? 'critical' : 'warning';
			recommendations.push('CPU usage is high - check for blocking operations');
		}

		if (metrics.eventLoopLagMs > this.thresholds.eventLoopLagMs) {
			recommendations.push('Event loop lag detected - review async operations');
		}

		if (metrics.freeMemoryPercent < 5) {
			status = 'critical';
			recommendations.push('System memory critically low');
		}

		// Analyze trends
		const memoryTrend = this.memoryHistory.length >= 3 ?
			this.calculateAverageGrowth(this.memoryHistory.slice(-3)) > 0 ? 'increasing' : 'stable' :
			'insufficient_data';

		const cpuTrend = this.cpuHistory.length >= 3 ?
			this.calculateAverageGrowth(this.cpuHistory.slice(-3)) > 0 ? 'increasing' : 'stable' :
			'insufficient_data';

		return {
			status,
			metrics,
			recommendations,
			trends: {
				memoryTrend,
				cpuTrend
			}
		};
	}

	/**
	 * Update monitoring thresholds
	 *
	 * @param newThresholds - New threshold values
	 */
	updateThresholds(newThresholds: Partial<ResourceThresholds>): void {
		this.thresholds = { ...this.thresholds, ...newThresholds };
		console.log('📊 Updated resource monitoring thresholds:', this.thresholds);
	}

	/**
	 * Get current thresholds
	 *
	 * @returns Current monitoring thresholds
	 */
	getThresholds(): ResourceThresholds {
		return { ...this.thresholds };
	}
}

// Export types for use in other modules
export type { ResourceThresholds, ResourceMetrics };

// If this script is run directly, start monitoring
if (import.meta.url === `file://${process.argv[1]}`) {
	const monitor = new ResourceMonitor();

	monitor.on('warning', (data) => {
		console.warn('🚨 Resource Warning:', data);
	});

	monitor.on('memory_leak_warning', (data) => {
		console.warn('🚨 Memory Leak Warning:', data);
	});

	monitor.on('cpu_spike_warning', (data) => {
		console.warn('🚨 CPU Spike Warning:', data);
	});

	monitor.start();

	// Generate health report every 5 minutes
	setInterval(async () => {
		const report = await monitor.generateHealthReport();
		console.log('📋 Health Report:', report);
	}, 300000);

	// Graceful shutdown
	process.on('SIGINT', () => {
		console.log('🛑 Shutting down resource monitor...');
		monitor.stop();
		process.exit(0);
	});
}