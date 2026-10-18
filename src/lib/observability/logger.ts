/**
 * Small structured logger. Proportionate to the MVP: it writes JSON-like entries to the
 * console and keeps the last entries in memory so they can be attached to a bug report
 * ("Diagnose kopieren"). It never logs project contents or personal data, only event names,
 * counts and timings.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
	time: string;
	level: LogLevel;
	event: string;
	data?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;
const entries: LogEntry[] = [];
const levelOrder: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
let minimumLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel) {
	minimumLevel = level;
}

export function log(level: LogLevel, event: string, data?: Record<string, unknown>) {
	if (levelOrder[level] < levelOrder[minimumLevel]) return;
	const entry: LogEntry = {
		time: new Date().toISOString(),
		level,
		event,
		...(data ? { data } : {})
	};
	entries.push(entry);
	if (entries.length > MAX_ENTRIES) entries.shift();
	const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
	sink(`[facade-designer] ${event}`, data ?? '');
}

export const logger = {
	debug: (event: string, data?: Record<string, unknown>) => log('debug', event, data),
	info: (event: string, data?: Record<string, unknown>) => log('info', event, data),
	warn: (event: string, data?: Record<string, unknown>) => log('warn', event, data),
	error: (event: string, data?: Record<string, unknown>) => log('error', event, data)
};

/** Measures a synchronous operation and logs its duration in milliseconds. */
export function timed<T>(event: string, operation: () => T, data?: Record<string, unknown>): T {
	const start = performance.now();
	try {
		return operation();
	} finally {
		logger.debug(event, { ...data, ms: Math.round((performance.now() - start) * 100) / 100 });
	}
}

export function getLogEntries(): readonly LogEntry[] {
	return entries;
}

export function errorToData(error: unknown): Record<string, unknown> {
	if (error instanceof Error) return { name: error.name, message: error.message };
	return { message: String(error) };
}
