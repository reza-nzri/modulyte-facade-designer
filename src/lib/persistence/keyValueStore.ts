/**
 * Minimal storage abstraction. In the browser it is backed by `localStorage`; tests use the
 * in-memory implementation. A future backend can replace the repositories built on top of it
 * without touching UI code.
 */
export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
	const data = new Map(Object.entries(initial));
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value),
		removeItem: (key) => void data.delete(key)
	};
}

/**
 * Returns localStorage when it is usable. Private windows or blocked storage throw on access,
 * in which case the app falls back to memory (data then lives only for the session).
 */
export function createBrowserStore(): { store: KeyValueStore; persistent: boolean } {
	try {
		const probe = '__modulyte_probe__';
		window.localStorage.setItem(probe, '1');
		window.localStorage.removeItem(probe);
		return { store: window.localStorage, persistent: true };
	} catch {
		return { store: createMemoryStore(), persistent: false };
	}
}
