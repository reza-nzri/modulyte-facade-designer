import { describe, expect, it } from 'vitest';
import { applyModuleFinish, applyWallFinish, createDefaultDesign, priceProject } from '$lib/domain';
import { createTinyProject, loadExampleProject, loadExampleRaw } from '$lib/testing/fixtures';
import {
	buildDesignDocument,
	serializeDesignDocument,
	suggestExportFileName
} from './designDocument';
import { importFromData, importFromText } from './importDocument';
import { computeProjectKey, stableStringify } from './projectKey';

describe('import of source projects', () => {
	it('imports the original example file and creates a default design', () => {
		const result = importFromData(loadExampleRaw());
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.kind).toBe('project');
		expect(result.project.walls).toHaveLength(4);
		expect(result.warnings).toEqual([]);
	});

	it('returns German errors for broken files', () => {
		const notJson = importFromText('{ walls: ');
		expect(notJson.ok).toBe(false);
		if (!notJson.ok) expect(notJson.error).toContain('keine gültige JSON-Datei');

		const wrongShape = importFromData({ walls: 'nope' });
		expect(wrongShape.ok).toBe(false);

		const unknown = importFromData({ hello: 'world' });
		expect(unknown.ok).toBe(false);
		if (!unknown.ok) expect(unknown.error).toContain('Unbekanntes Dateiformat');
	});

	it('rejects projects with duplicate ids', () => {
		const raw = structuredClone(loadExampleRaw()) as { walls: { id: string }[] };
		raw.walls[1]!.id = raw.walls[0]!.id;
		const result = importFromData(raw);
		expect(result.ok).toBe(false);
	});
});

describe('export/import round trip', () => {
	it('restores project, design and variant name exactly', () => {
		const project = loadExampleProject();
		let design = createDefaultDesign(project);
		design = applyWallFinish(design, 'north', { surfaceId: 'rhombus', color: 'grey glaze' });
		design = applyModuleFinish(design, 'south', ['S-001', 'X-002'], {
			surfaceId: 'rockpanel',
			color: 'black'
		});

		const document = buildDesignDocument(project, design, {
			variantName: 'Variante Holz',
			exportedAt: new Date('2026-10-17T10:00:00Z')
		});
		const text = serializeDesignDocument(document);
		const result = importFromText(text);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.kind).toBe('design');
		expect(result.variantName).toBe('Variante Holz');
		expect(result.design).toEqual(design);
		expect(stableStringify(result.project)).toBe(stableStringify(project));
		expect(result.warnings).toEqual([]);
		expect(priceProject(result.project, result.design).totalCents).toBe(
			Math.round(document.summary.totalEur * 100)
		);
	});

	it('contains the data Modulyte needs to understand the design', () => {
		const project = createTinyProject();
		const design = applyModuleFinish(createDefaultDesign(project), 'front', ['D'], {
			surfaceId: 'brick',
			color: 'red'
		});
		const document = buildDesignDocument(project, design);
		expect(document.format).toBe('modulyte.facade-design');
		expect(document.formatVersion).toBe(1);
		expect(document.projectKey).toBe(computeProjectKey(project));
		expect(document.summary.moduleAssignments).toHaveLength(4);
		const d = document.summary.moduleAssignments.find((m) => m.moduleId === 'D');
		expect(d).toMatchObject({
			surfaceId: 'brick',
			color: 'red',
			individuallyStyled: true,
			areaM2: 0.25
		});
		expect(document.summary.walls[0]).toMatchObject({
			netAreaM2: 1.75,
			claddingAreaM2: 1.75,
			totalEur: 143.88
		});
		expect(document.summary.assumptions.length).toBeGreaterThan(0);
	});

	it('recomputes prices and warns when the stored total was changed', () => {
		const project = createTinyProject();
		const document = buildDesignDocument(project, createDefaultDesign(project));
		const tampered = { ...document, summary: { ...document.summary, totalEur: 1 } };
		const result = importFromData(JSON.parse(JSON.stringify(tampered)));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.warnings.join(' ')).toContain('weicht');
	});

	it('rejects unsupported format versions', () => {
		const project = createTinyProject();
		const document = {
			...buildDesignDocument(project, createDefaultDesign(project)),
			formatVersion: 99
		};
		const result = importFromData(document);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.details.join(' ')).toContain('99');
	});

	it('sanitises designs that reference unknown modules', () => {
		const project = createTinyProject();
		const document = buildDesignDocument(project, createDefaultDesign(project));
		const edited = JSON.parse(JSON.stringify(document));
		edited.design.moduleOverrides = { front: { ZZZ: { surfaceId: 'brick', color: 'red' } } };
		delete edited.summary;
		const result = importFromData(edited);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.design.moduleOverrides).toEqual({});
			expect(result.warnings).toHaveLength(1);
		}
	});
});

describe('helpers', () => {
	it('builds stable keys independent of key order', () => {
		expect(computeProjectKey({ a: 1, b: [1, 2] })).toBe(computeProjectKey({ b: [1, 2], a: 1 }));
		expect(computeProjectKey({ a: 1 })).not.toBe(computeProjectKey({ a: 2 }));
	});

	it('suggests readable file names', () => {
		expect(
			suggestExportFileName(
				'Single-family house, Musterstraße 12',
				new Date('2026-10-17T00:00:00Z')
			)
		).toBe('fassade-single-family-house-musterstrasse-12-2026-10-17.json');
	});
});
