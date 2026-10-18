/** Pure viewport math for the 2D canvas (SVG viewBox in wall millimetres). */
import type { FacadeModule, Wall } from '$lib/domain';

export interface ViewBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Space around the wall for dimension lines and labels (mm). */
export const MARGIN = { left: 1000, right: 450, top: 450, bottom: 1000 } as const;

export function fitViewBox(wall: Pick<Wall, 'width_mm' | 'height_mm'>): ViewBox {
	return {
		x: -MARGIN.left,
		y: -MARGIN.top,
		w: wall.width_mm + MARGIN.left + MARGIN.right,
		h: wall.height_mm + MARGIN.top + MARGIN.bottom
	};
}

/** Zooms around an anchor point (in viewBox coordinates). factor < 1 zooms in. */
export function zoomAt(
	view: ViewBox,
	factor: number,
	anchorX: number,
	anchorY: number,
	limits: { min: number; max: number }
): ViewBox {
	const nextW = Math.min(limits.max, Math.max(limits.min, view.w * factor));
	const applied = nextW / view.w;
	return {
		x: anchorX - (anchorX - view.x) * applied,
		y: anchorY - (anchorY - view.y) * applied,
		w: view.w * applied,
		h: view.h * applied
	};
}

export function panBy(view: ViewBox, dx: number, dy: number): ViewBox {
	return { ...view, x: view.x - dx, y: view.y - dy };
}

type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * Keyboard navigation: the nearest module in the given direction (wall coordinates, y up).
 * Prefers modules aligned with the current one, then the closest by distance.
 */
export function neighbourModule(
	modules: readonly FacadeModule[],
	current: FacadeModule,
	direction: Direction
): FacadeModule | undefined {
	const cx = current.x_mm + current.width_mm / 2;
	const cy = current.y_mm + current.height_mm / 2;
	let best: { module: FacadeModule; score: number } | undefined;
	for (const module of modules) {
		if (module.id === current.id) continue;
		const mx = module.x_mm + module.width_mm / 2;
		const my = module.y_mm + module.height_mm / 2;
		const dx = mx - cx;
		const dy = my - cy;
		const primary =
			direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? dy : -dy;
		const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
		if (primary <= 0) continue;
		const score = primary + secondary * 3;
		if (!best || score < best.score) best = { module, score };
	}
	return best?.module;
}
