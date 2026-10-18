import { describe, expect, it } from 'vitest';
import {
	applyFinishToAllWalls,
	applyModuleFinish,
	applyWallFinish,
	countOverrides,
	createDefaultDesign,
	getModuleFinish,
	isModuleOverridden,
	resetModuleFinish,
	sanitizeDesign
} from './design';
import { createTinyProject, loadExampleProject } from '$lib/testing/fixtures';

const wood = { surfaceId: 'wood', color: 'natural' };
const brick = { surfaceId: 'brick', color: 'red' };

describe('design operations', () => {
	it('starts with the first surface and colour on every wall', () => {
		const project = loadExampleProject();
		const design = createDefaultDesign(project);
		expect(Object.keys(design.wallFinishes)).toEqual(['south', 'east', 'north', 'west']);
		expect(design.wallFinishes.south).toEqual({ surfaceId: 'clinker', color: 'red' });
		expect(design.moduleOverrides).toEqual({});
	});

	it('applies finishes to modules and inherits the wall finish elsewhere', () => {
		const project = createTinyProject();
		let design = createDefaultDesign(project);
		design = applyModuleFinish(design, 'front', ['A', 'B'], brick);
		expect(getModuleFinish(design, 'front', 'A')).toEqual(brick);
		expect(getModuleFinish(design, 'front', 'C')).toEqual(wood);
		expect(isModuleOverridden(design, 'front', 'C')).toBe(false);
		expect(countOverrides(design)).toBe(2);
	});

	it('is immutable', () => {
		const project = createTinyProject();
		const original = createDefaultDesign(project);
		const snapshot = structuredClone(original);
		applyModuleFinish(original, 'front', ['A'], brick);
		applyWallFinish(original, 'front', brick);
		expect(original).toEqual(snapshot);
	});

	it('keeps module areas when the wall changes, unless reset is requested', () => {
		const project = createTinyProject();
		let design = applyModuleFinish(createDefaultDesign(project), 'front', ['A'], brick);
		const kept = applyWallFinish(design, 'front', { surfaceId: 'wood', color: 'grey' });
		expect(getModuleFinish(kept, 'front', 'A')).toEqual(brick);
		const reset = applyWallFinish(
			design,
			'front',
			{ surfaceId: 'wood', color: 'grey' },
			{ resetModules: true }
		);
		expect(getModuleFinish(reset, 'front', 'A')).toEqual({ surfaceId: 'wood', color: 'grey' });
		design = applyWallFinish(design, 'front', brick);
		// An override equal to the new wall default is redundant and removed.
		expect(countOverrides(design)).toBe(0);
	});

	it('resets selected modules or the whole wall', () => {
		const project = createTinyProject();
		const design = applyModuleFinish(createDefaultDesign(project), 'front', ['A', 'B', 'C'], brick);
		expect(countOverrides(resetModuleFinish(design, 'front', ['A']))).toBe(2);
		expect(countOverrides(resetModuleFinish(design, 'front'))).toBe(0);
	});

	it('applies one finish to all walls', () => {
		const project = loadExampleProject();
		const design = applyFinishToAllWalls(createDefaultDesign(project), project, {
			surfaceId: 'rockpanel',
			color: 'grey'
		});
		expect(new Set(Object.values(design.wallFinishes).map((f) => f.surfaceId))).toEqual(
			new Set(['rockpanel'])
		);
	});
});

describe('sanitizeDesign', () => {
	it('drops unknown modules, invalid colours and unknown walls', () => {
		const project = createTinyProject();
		const { design, issues } = sanitizeDesign(project, {
			wallFinishes: { front: { surfaceId: 'wood', color: 'pink' }, ghost: wood },
			moduleOverrides: { front: { A: brick, Z: brick, B: { surfaceId: 'nope', color: 'red' } } }
		});
		expect(design.wallFinishes.front).toEqual(wood);
		expect(design.moduleOverrides.front).toEqual({ A: brick });
		expect(issues).toHaveLength(3);
	});

	it('leaves a valid design untouched', () => {
		const project = createTinyProject();
		const input = applyModuleFinish(createDefaultDesign(project), 'front', ['D'], brick);
		const { design, issues } = sanitizeDesign(project, input);
		expect(design).toEqual(input);
		expect(issues).toEqual([]);
	});
});
