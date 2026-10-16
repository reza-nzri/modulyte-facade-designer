import { describe, expect, it } from 'vitest';
import { fitViewBox, MARGIN, neighbourModule, panBy, zoomAt } from './viewport';

const m = (id: string, x_mm: number, y_mm: number) => ({
	id,
	type: 'standard' as const,
	x_mm,
	y_mm,
	width_mm: 625,
	height_mm: 500
});

describe('viewport', () => {
	it('fits the wall plus dimension margins', () => {
		expect(fitViewBox({ width_mm: 9800, height_mm: 5500 })).toEqual({
			x: -MARGIN.left,
			y: -MARGIN.top,
			w: 9800 + MARGIN.left + MARGIN.right,
			h: 5500 + MARGIN.top + MARGIN.bottom
		});
	});

	it('zooms around the anchor and respects limits', () => {
		const view = { x: 0, y: 0, w: 1000, h: 500 };
		const zoomed = zoomAt(view, 0.5, 500, 250, { min: 100, max: 5000 });
		expect(zoomed).toEqual({ x: 250, y: 125, w: 500, h: 250 });
		expect(zoomAt(view, 0.01, 0, 0, { min: 100, max: 5000 }).w).toBe(100);
	});

	it('pans in the opposite direction of the drag', () => {
		expect(panBy({ x: 0, y: 0, w: 10, h: 10 }, 5, -3)).toEqual({ x: -5, y: 3, w: 10, h: 10 });
	});

	it('navigates to neighbouring modules (y up)', () => {
		const modules = [m('a', 0, 0), m('b', 625, 0), m('c', 0, 500), m('d', 625, 500)];
		expect(neighbourModule(modules, modules[0]!, 'right')?.id).toBe('b');
		expect(neighbourModule(modules, modules[0]!, 'up')?.id).toBe('c');
		expect(neighbourModule(modules, modules[0]!, 'left')).toBeUndefined();
		expect(neighbourModule(modules, modules[3]!, 'down')?.id).toBe('b');
	});
});
