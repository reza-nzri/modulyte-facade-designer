/**
 * Imports either
 *  (a) an original source project (`{ project, walls, surfaces }`, as supplied by Modulyte), or
 *  (b) a design document exported by this app (`format: "modulyte.facade-design"`).
 *
 * Returns German, customer-facing error messages. Nothing derived in the file is trusted:
 * prices are recomputed and compared with the stored total to flag tampering or outdated rates.
 */
import type { ZodError } from 'zod';
import {
	createDefaultDesign,
	facadeProjectSchema,
	priceProject,
	sanitizeDesign,
	validateProjectSemantics,
	type FacadeDesign,
	type FacadeProject,
	type ValidationIssue
} from '$lib/domain';
import { DESIGN_DOCUMENT_FORMAT, designDocumentSchema } from './designDocument';

export type ImportResult =
	| {
			ok: true;
			kind: 'project' | 'design';
			project: FacadeProject;
			design: FacadeDesign;
			variantName: string | null;
			/** Non-blocking notices (semantic warnings, dropped assignments, price differences). */
			warnings: string[];
	  }
	| { ok: false; error: string; details: string[] };

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function describeZodError(error: ZodError, prefix = ''): string[] {
	return error.issues.slice(0, 8).map((issue) => {
		const path = [prefix, ...issue.path.map(String)].filter(Boolean).join('.');
		return path ? `${path}: ${issue.message}` : issue.message;
	});
}

function blockingIssues(issues: ValidationIssue[]) {
	return issues.filter((issue) => issue.severity === 'error');
}

function warningMessages(issues: ValidationIssue[]) {
	return issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);
}

export function importFromText(text: string): ImportResult {
	if (text.length > MAX_FILE_BYTES) {
		return { ok: false, error: 'Die Datei ist zu groß (maximal 10 MB).', details: [] };
	}
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (error) {
		return {
			ok: false,
			error: 'Die Datei ist keine gültige JSON-Datei.',
			details: [error instanceof Error ? error.message : String(error)]
		};
	}
	return importFromData(data);
}

export function importFromData(data: unknown): ImportResult {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return { ok: false, error: 'Die Datei enthält kein Fassadenprojekt.', details: [] };
	}
	const record = data as Record<string, unknown>;

	if (record.format === DESIGN_DOCUMENT_FORMAT) {
		const parsed = designDocumentSchema.safeParse(data);
		if (!parsed.success) {
			const versionHint =
				record.formatVersion !== 1
					? [`Dateiversion ${String(record.formatVersion)} wird nicht unterstützt (erwartet: 1).`]
					: [];
			return {
				ok: false,
				error: 'Der gespeicherte Entwurf hat ein ungültiges Format.',
				details: [...versionHint, ...describeZodError(parsed.error)]
			};
		}
		const project = parsed.data.source;
		const semantic = validateProjectSemantics(project);
		if (blockingIssues(semantic).length > 0) {
			return {
				ok: false,
				error: 'Das Projekt im Entwurf ist widersprüchlich.',
				details: blockingIssues(semantic).map((issue) => issue.message)
			};
		}
		const { design, issues } = sanitizeDesign(project, parsed.data.design);
		const warnings = [...warningMessages(semantic), ...issues.map((issue) => issue.message)];
		const storedTotal = parsed.data.summary?.totalEur;
		if (typeof storedTotal === 'number') {
			const recomputed = priceProject(project, design).totalCents / 100;
			if (Math.abs(recomputed - storedTotal) >= 0.005) {
				warnings.push(
					`Der gespeicherte Gesamtpreis (${storedTotal.toFixed(2)} €) weicht vom neu berechneten Preis (${recomputed.toFixed(2)} €) ab. Es gilt der neu berechnete Preis.`
				);
			}
		}
		return {
			ok: true,
			kind: 'design',
			project,
			design,
			variantName: parsed.data.variantName ?? null,
			warnings
		};
	}

	if ('walls' in record || 'surfaces' in record || 'project' in record) {
		const parsed = facadeProjectSchema.safeParse(data);
		if (!parsed.success) {
			return {
				ok: false,
				error: 'Die Projektdatei passt nicht zum erwarteten Aufbau (Projekt, Wände, Oberflächen).',
				details: describeZodError(parsed.error)
			};
		}
		const semantic = validateProjectSemantics(parsed.data);
		if (blockingIssues(semantic).length > 0) {
			return {
				ok: false,
				error: 'Die Projektdatei ist widersprüchlich.',
				details: blockingIssues(semantic).map((issue) => issue.message)
			};
		}
		return {
			ok: true,
			kind: 'project',
			project: parsed.data,
			design: createDefaultDesign(parsed.data),
			variantName: null,
			warnings: warningMessages(semantic)
		};
	}

	return {
		ok: false,
		error:
			'Unbekanntes Dateiformat. Erwartet wird eine Modulyte-Projektdatei oder ein gespeicherter Entwurf.',
		details: []
	};
}
