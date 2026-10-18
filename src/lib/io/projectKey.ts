/**
 * Stable identity of a source project, used to associate saved designs and variants with the
 * exact project geometry they were made for.
 */

/** JSON.stringify with sorted object keys, so equal data always yields the same string. */
export function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** 32-bit FNV-1a hash as 8 hex characters. Not cryptographic; only used as a cache key. */
export function fnv1a(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeProjectKey(project: unknown): string {
	return `p-${fnv1a(stableStringify(project))}`;
}
