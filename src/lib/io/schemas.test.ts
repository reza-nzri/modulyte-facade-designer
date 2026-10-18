/**
 * Contract test: the published JSON Schemas in docs/schemas are generated from the Zod
 * schemas (the single source of truth). Run `UPDATE_SCHEMAS=1 npx vitest run schemas` to
 * regenerate them after an intentional contract change.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { facadeProjectSchema } from '$lib/domain';
import { designDocumentSchema } from './designDocument';

const SCHEMAS = {
	'source-project.v1.schema.json': {
		schema: facadeProjectSchema,
		title: 'Modulyte source project (input)',
		description:
			'Facade project supplied by Modulyte: walls with openings and a fixed module layout, plus selectable surfaces. Units: millimetres, origin bottom-left of each wall.'
	},
	'facade-design.v1.schema.json': {
		schema: designDocumentSchema,
		title: 'Modulyte facade design document v1 (export)',
		description:
			'Customer design exported by the Fassadendesigner: unchanged source project, design (wall finishes and module overrides) and a derived pricing summary.'
	}
} as const;

function generate(entry: (typeof SCHEMAS)[keyof typeof SCHEMAS]): string {
	const json = z.toJSONSchema(entry.schema, { io: 'input', unrepresentable: 'any' });
	return `${JSON.stringify({ ...json, title: entry.title, description: entry.description }, null, 2)}\n`;
}

describe('published JSON schemas', () => {
	const dir = resolve(process.cwd(), 'docs/schemas');
	for (const [file, entry] of Object.entries(SCHEMAS)) {
		it(`${file} is up to date`, () => {
			const generated = generate(entry);
			const path = resolve(dir, file);
			if (process.env.UPDATE_SCHEMAS) {
				mkdirSync(dir, { recursive: true });
				writeFileSync(path, generated);
			}
			expect(readFileSync(path, 'utf8')).toBe(generated);
		});
	}
});
