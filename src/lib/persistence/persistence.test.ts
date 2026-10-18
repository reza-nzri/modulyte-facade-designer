import { describe, expect, it } from 'vitest';
import { applyModuleFinish, createDefaultDesign } from '$lib/domain';
import { createTinyProject } from '$lib/testing/fixtures';
import { createMemoryStore } from './keyValueStore';
import {
	createVariantRepository,
	createWorkspaceRepository,
	type SavedVariant
} from './variantRepository';

function variant(
	id: string,
	projectKey = 'p-1',
	createdAt = '2026-10-17T10:00:00.000Z'
): SavedVariant {
	const project = createTinyProject();
	return {
		id,
		name: `Variante ${id}`,
		projectKey,
		createdAt,
		updatedAt: createdAt,
		design: createDefaultDesign(project)
	};
}

describe('variant repository', () => {
	it('saves, lists (oldest first), updates and removes variants per project', async () => {
		const repository = createVariantRepository(createMemoryStore());
		await repository.save(variant('b', 'p-1', '2026-10-17T11:00:00.000Z'));
		await repository.save(variant('a', 'p-1', '2026-10-17T10:00:00.000Z'));
		await repository.save(variant('c', 'p-2'));
		expect((await repository.list('p-1')).map((v) => v.id)).toEqual(['a', 'b']);

		await repository.save({ ...variant('a'), name: 'Umbenannt' });
		expect((await repository.list('p-1')).find((v) => v.id === 'a')?.name).toBe('Umbenannt');

		await repository.remove('p-1', 'a');
		expect((await repository.list('p-1')).map((v) => v.id)).toEqual(['b']);
		expect(await repository.list('p-2')).toHaveLength(1);
	});

	it('ignores corrupt storage and reports it', async () => {
		const corrupt: string[] = [];
		const store = createMemoryStore({ 'modulyte.facade-designer.v1.variants.p-1': '{oops' });
		const repository = createVariantRepository(store, (key) => corrupt.push(key));
		expect(await repository.list('p-1')).toEqual([]);
		expect(corrupt).toHaveLength(1);
	});
});

describe('workspace repository', () => {
	it('persists and restores the current project and design', () => {
		const store = createMemoryStore();
		const repository = createWorkspaceRepository(store);
		const project = createTinyProject();
		const design = applyModuleFinish(createDefaultDesign(project), 'front', ['A'], {
			surfaceId: 'brick',
			color: 'red'
		});
		expect(repository.load()).toBeNull();
		repository.save(project, design);
		const restored = repository.load();
		expect(restored?.design).toEqual(design);
		expect(restored?.project.project).toBe('Tiny test house');
		repository.clear();
		expect(repository.load()).toBeNull();
	});
});
