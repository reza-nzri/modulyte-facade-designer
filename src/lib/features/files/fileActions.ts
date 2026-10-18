import { base } from '$app/paths';
/** Browser file helpers (download and read), kept out of components for reuse and testing. */
import type { FacadeDesign, FacadeProject } from '$lib/domain';
import {
	buildDesignDocument,
	serializeDesignDocument,
	suggestExportFileName
} from '$lib/io/designDocument';
import { importFromData, importFromText, type ImportResult } from '$lib/io/importDocument';
import { logger, timed } from '$lib/observability/logger';

export const EXAMPLE_PROJECT_URL = `${base}/projects/fassadendesigner_house.json`;

export function downloadText(fileName: string, text: string, mime = 'application/json') {
	const blob = new Blob([text], { type: `${mime};charset=utf-8` });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportDesign(
	project: FacadeProject,
	design: FacadeDesign,
	variantName: string
): string {
	const document = timed('export.build', () =>
		buildDesignDocument(project, design, { variantName })
	);
	const fileName = suggestExportFileName(project.project);
	downloadText(fileName, serializeDesignDocument(document));
	logger.info('export.downloaded', { modules: document.summary.moduleAssignments.length });
	return fileName;
}

export async function importFile(file: File): Promise<ImportResult> {
	if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
		return {
			ok: false,
			error: 'Bitte wählen Sie eine JSON-Datei (.json).',
			details: [`Ausgewählt: ${file.name}`]
		};
	}
	const text = await file.text();
	const result = timed('import.parse', () => importFromText(text), { bytes: text.length });
	logger.info('import.finished', { ok: result.ok, kind: result.ok ? result.kind : 'error' });
	return result;
}

export async function loadExampleProject(fetcher: typeof fetch = fetch): Promise<ImportResult> {
	try {
		const response = await fetcher(EXAMPLE_PROJECT_URL);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return importFromData(await response.json());
	} catch (error) {
		logger.error('example.load_failed', { message: String(error) });
		return {
			ok: false,
			error: 'Das Beispielprojekt konnte nicht geladen werden.',
			details: [String(error)]
		};
	}
}
