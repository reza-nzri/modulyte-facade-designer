/**
 * Saved design variants and the auto-saved workspace.
 *
 * The repository API is async on purpose: today it wraps a synchronous key-value store, later
 * it can call a REST API / database without changing its callers.
 */
import { z } from 'zod';
import { facadeProjectSchema, type FacadeDesign, type FacadeProject } from '$lib/domain';
import { facadeDesignSchema } from '$lib/io/designDocument';
import type { KeyValueStore } from './keyValueStore';

const STORAGE_PREFIX = 'modulyte.facade-designer.v1';

export const savedVariantSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	projectKey: z.string().min(1),
	createdAt: z.string(),
	updatedAt: z.string(),
	design: facadeDesignSchema
});

export type SavedVariant = z.infer<typeof savedVariantSchema>;

export interface VariantRepository {
	list(projectKey: string): Promise<SavedVariant[]>;
	save(variant: SavedVariant): Promise<void>;
	remove(projectKey: string, id: string): Promise<void>;
}

export function createVariantRepository(
	store: KeyValueStore,
	onCorruptData: (key: string) => void = () => {}
): VariantRepository {
	const keyFor = (projectKey: string) => `${STORAGE_PREFIX}.variants.${projectKey}`;

	function read(projectKey: string): SavedVariant[] {
		const raw = store.getItem(keyFor(projectKey));
		if (!raw) return [];
		try {
			const parsed = z.array(savedVariantSchema).safeParse(JSON.parse(raw));
			if (parsed.success) return parsed.data;
		} catch {
			// handled below
		}
		onCorruptData(keyFor(projectKey));
		return [];
	}

	function write(projectKey: string, variants: SavedVariant[]) {
		store.setItem(keyFor(projectKey), JSON.stringify(variants));
	}

	return {
		async list(projectKey) {
			return read(projectKey).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		},
		async save(variant) {
			const variants = read(variant.projectKey).filter((v) => v.id !== variant.id);
			write(variant.projectKey, [...variants, variant]);
		},
		async remove(projectKey, id) {
			write(
				projectKey,
				read(projectKey).filter((v) => v.id !== id)
			);
		}
	};
}

const workspaceSchema = z.object({
	project: facadeProjectSchema,
	design: facadeDesignSchema,
	savedAt: z.string()
});

export interface Workspace {
	project: FacadeProject;
	design: FacadeDesign;
	savedAt: string;
}

/** Auto-saved "last opened project + current design", restored on the next visit. */
export interface WorkspaceRepository {
	load(): Workspace | null;
	save(project: FacadeProject, design: FacadeDesign): void;
	clear(): void;
}

export function createWorkspaceRepository(
	store: KeyValueStore,
	onCorruptData: (key: string) => void = () => {}
): WorkspaceRepository {
	const key = `${STORAGE_PREFIX}.workspace`;
	return {
		load() {
			const raw = store.getItem(key);
			if (!raw) return null;
			try {
				const parsed = workspaceSchema.safeParse(JSON.parse(raw));
				if (parsed.success) return parsed.data;
			} catch {
				// handled below
			}
			onCorruptData(key);
			return null;
		},
		save(project, design) {
			store.setItem(key, JSON.stringify({ project, design, savedAt: new Date().toISOString() }));
		},
		clear() {
			store.removeItem(key);
		}
	};
}

export function createVariantId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
