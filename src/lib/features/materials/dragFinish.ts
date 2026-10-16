/** Drag & drop payload for "drag a material swatch onto the facade". */
import type { Finish } from '$lib/domain';

export const FINISH_MIME = 'application/x-modulyte-finish';

export function writeDraggedFinish(dataTransfer: DataTransfer | null, finish: Finish) {
	if (!dataTransfer) return;
	dataTransfer.setData(FINISH_MIME, JSON.stringify(finish));
	dataTransfer.effectAllowed = 'copy';
}

export function readDraggedFinish(dataTransfer: DataTransfer | null): Finish | null {
	const raw = dataTransfer?.getData(FINISH_MIME);
	if (!raw) return null;
	try {
		const value = JSON.parse(raw) as Partial<Finish>;
		return typeof value.surfaceId === 'string' && typeof value.color === 'string'
			? { surfaceId: value.surfaceId, color: value.color }
			: null;
	} catch {
		return null;
	}
}
