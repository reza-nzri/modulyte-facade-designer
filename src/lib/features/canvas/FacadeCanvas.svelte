<!--
	Interactive 2D facade workspace.
	- Select tool: click a module, Shift/Ctrl+click to add/remove, drag to draw a selection frame.
	- Hand tool, middle mouse or held Space: pan. Mouse wheel / buttons: zoom.
	- Drop a material swatch onto a module (or the selection) to apply it.
	- Keyboard: arrows move the cursor, Space/Enter selects, Esc clears, Ctrl+A selects all.
-->
<script lang="ts">
	import { modulesInRect, rectFromPoints, type Finish } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import Icon from '$lib/features/ui/Icon.svelte';
	import { wallShortName } from '$lib/features/appearance/appearance';
	import { FINISH_MIME, readDraggedFinish } from '$lib/features/materials/dragFinish';
	import WallElevation from './WallElevation.svelte';
	import { fitViewBox, neighbourModule, panBy, zoomAt, type ViewBox } from './viewport';

	const editor = useEditor();

	let svg = $state<SVGSVGElement>();
	let containerWidth = $state(0);
	let view = $state<ViewBox>({ x: 0, y: 0, w: 1000, h: 1000 });
	let fittedForWall = $state<string | null>(null);
	let spaceHeld = $state(false);
	let panning = $state(false);
	let marquee = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
	let dropTarget = $state<string | null>(null);
	let cursor = $state<{ x: number; y: number } | null>(null);

	let pointerStart: {
		clientX: number;
		clientY: number;
		x: number;
		y: number;
		additive: boolean;
		button: number;
	} | null = null;

	const wall = $derived(editor.activeWall);
	const selected = $derived(new Set(editor.selection));
	const zoomPercent = $derived(
		wall && containerWidth ? Math.round((fitViewBox(wall).w / view.w) * 100) : 100
	);

	// Fit the view whenever a different wall becomes active.
	$effect(() => {
		if (wall && fittedForWall !== wall.id) {
			view = fitViewBox(wall);
			fittedForWall = wall.id;
		}
	});

	function toSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
		const matrix = svg?.getScreenCTM();
		if (!svg || !matrix) return { x: 0, y: 0 };
		const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
		return { x: point.x, y: point.y };
	}

	/** SVG point → wall coordinates (mm, origin bottom-left). */
	function toWall(point: { x: number; y: number }) {
		return { x: point.x, y: (wall?.height_mm ?? 0) - point.y };
	}

	function zoomLimits() {
		const fit = wall ? fitViewBox(wall).w : 10000;
		return { min: 600, max: fit * 3 };
	}

	function zoomBy(factor: number, clientX?: number, clientY?: number) {
		const anchor =
			clientX !== undefined && clientY !== undefined
				? toSvgPoint(clientX, clientY)
				: { x: view.x + view.w / 2, y: view.y + view.h / 2 };
		view = zoomAt(view, factor, anchor.x, anchor.y, zoomLimits());
	}

	function fit() {
		if (wall) view = fitViewBox(wall);
	}

	function moduleIdFromTarget(target: EventTarget | null): string | null {
		return target instanceof Element ? target.getAttribute('data-module-id') : null;
	}

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
			zoomBy(Math.exp(event.deltaY * 0.0015), event.clientX, event.clientY);
		} else {
			const scale = view.w / (svg?.clientWidth || 1);
			view = panBy(view, -event.deltaX * scale, 0);
		}
	}

	function onPointerDown(event: PointerEvent) {
		if (!svg || !wall) return;
		svg.focus({ preventScroll: true });
		const isPan = editor.tool === 'pan' || spaceHeld || event.button === 1;
		if (event.button !== 0 && event.button !== 1) return;
		svg.setPointerCapture(event.pointerId);
		const point = toSvgPoint(event.clientX, event.clientY);
		pointerStart = {
			clientX: event.clientX,
			clientY: event.clientY,
			x: point.x,
			y: point.y,
			additive: event.shiftKey || event.ctrlKey || event.metaKey,
			button: event.button
		};
		panning = isPan;
	}

	function onPointerMove(event: PointerEvent) {
		const point = toSvgPoint(event.clientX, event.clientY);
		const wallPoint = toWall(point);
		cursor =
			wall && point.x >= 0 && point.x <= wall.width_mm && point.y >= 0 && point.y <= wall.height_mm
				? wallPoint
				: null;

		if (!pointerStart) {
			editor.hoveredModuleId = moduleIdFromTarget(event.target);
			return;
		}
		if (panning) {
			const scale = view.w / (svg?.getBoundingClientRect().width || 1);
			view = panBy(
				view,
				(event.clientX - pointerStart.clientX) * scale,
				(event.clientY - pointerStart.clientY) * scale
			);
			pointerStart = { ...pointerStart, clientX: event.clientX, clientY: event.clientY };
			return;
		}
		const moved = Math.hypot(
			event.clientX - pointerStart.clientX,
			event.clientY - pointerStart.clientY
		);
		if (moved > 4 || marquee) {
			marquee = { x0: pointerStart.x, y0: pointerStart.y, x1: point.x, y1: point.y };
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (!pointerStart || !wall) return;
		const start = pointerStart;
		pointerStart = null;
		if (svg?.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);

		if (panning) {
			panning = false;
			return;
		}
		if (marquee) {
			const a = toWall({ x: marquee.x0, y: marquee.y0 });
			const b = toWall({ x: marquee.x1, y: marquee.y1 });
			const ids = modulesInRect(wall, rectFromPoints(a.x, a.y, b.x, b.y));
			editor.selectModules(ids, start.additive ? 'add' : 'replace');
			marquee = null;
			return;
		}
		const moduleId = moduleIdFromTarget(document.elementFromPoint(event.clientX, event.clientY));
		if (moduleId) {
			editor.selectModules([moduleId], start.additive ? 'toggle' : 'replace');
			editor.focusedModuleId = moduleId;
		} else if (!start.additive) {
			editor.clearSelection();
		}
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!wall) return;
		if (event.key === ' ' && !event.repeat && !editor.focusedModuleId) {
			spaceHeld = true;
			event.preventDefault();
			return;
		}
		const arrows: Record<string, 'left' | 'right' | 'up' | 'down'> = {
			ArrowLeft: 'left',
			ArrowRight: 'right',
			ArrowUp: 'up',
			ArrowDown: 'down'
		};
		const direction = arrows[event.key];
		if (direction) {
			event.preventDefault();
			const current = wall.modules.find((m) => m.id === editor.focusedModuleId) ?? wall.modules[0];
			if (!current) return;
			const next = editor.focusedModuleId
				? neighbourModule(wall.modules, current, direction)
				: current;
			if (next) {
				editor.focusedModuleId = next.id;
				if (event.shiftKey) editor.selectModules([next.id], 'add');
			}
			return;
		}
		if ((event.key === 'Enter' || event.key === ' ') && editor.focusedModuleId) {
			event.preventDefault();
			editor.selectModules([editor.focusedModuleId], 'toggle');
			return;
		}
		if (event.key === 'Escape') {
			editor.clearSelection();
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
			event.preventDefault();
			editor.selectPreset('all');
			return;
		}
		if (event.key === '+' || event.key === '=') zoomBy(0.8);
		if (event.key === '-') zoomBy(1.25);
		if (event.key === '0') fit();
	}

	function onKeyUp(event: KeyboardEvent) {
		if (event.key === ' ') spaceHeld = false;
	}

	function onDragOver(event: DragEvent) {
		if (!event.dataTransfer?.types.includes(FINISH_MIME)) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		dropTarget = moduleIdFromTarget(event.target);
	}

	function onDrop(event: DragEvent) {
		const finish: Finish | null = readDraggedFinish(event.dataTransfer);
		const moduleId = moduleIdFromTarget(event.target);
		dropTarget = null;
		if (!finish || !wall) return;
		event.preventDefault();
		if (moduleId && selected.has(moduleId) && editor.selection.length > 1) {
			editor.applyFinishToModules(wall.id, editor.selection, finish);
		} else if (moduleId) {
			editor.applyFinishToModules(wall.id, [moduleId], finish);
		} else {
			editor.applyFinishToWall(wall.id, finish);
		}
	}

	const marqueeRect = $derived(
		marquee
			? {
					x: Math.min(marquee.x0, marquee.x1),
					y: Math.min(marquee.y0, marquee.y1),
					w: Math.abs(marquee.x1 - marquee.x0),
					h: Math.abs(marquee.y1 - marquee.y0)
				}
			: null
	);

	// Text and tick sizes in mm that stay readable at the current zoom (~12 px on screen).
	const unit = $derived(containerWidth ? view.w / containerWidth : 10);
	const fontSize = $derived(12.5 * unit);
	const tick = $derived(6 * unit);

	const openingXs = $derived(
		wall
			? [
					...new Set([
						0,
						wall.width_mm,
						...wall.openings.flatMap((o) => [o.x_mm, o.x_mm + o.width_mm])
					])
				].sort((a, b) => a - b)
			: []
	);
	const cursorClass = $derived(
		panning
			? 'grabbing'
			: editor.tool === 'pan' || spaceHeld
				? 'grab'
				: marquee
					? 'crosshair'
					: 'default'
	);
</script>

<div class="canvas" bind:clientWidth={containerWidth}>
	{#if wall}
		<!-- The canvas is a custom widget (role="application") with full keyboard support below. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<svg
			bind:this={svg}
			class="workspace cursor-{cursorClass}"
			viewBox="{view.x} {view.y} {view.w} {view.h}"
			preserveAspectRatio="xMidYMid meet"
			tabindex="0"
			role="application"
			aria-label="Fassadenansicht {wallShortName(
				wall
			)}. Pfeiltasten wählen Module, Leertaste markiert, Escape hebt die Auswahl auf."
			data-testid="facade-canvas"
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointerleave={() => {
				editor.hoveredModuleId = null;
				cursor = null;
			}}
			onkeydown={onKeyDown}
			onkeyup={onKeyUp}
			ondragover={onDragOver}
			ondragleave={() => (dropTarget = null)}
			ondrop={onDrop}
		>
			<rect
				class="ground"
				x={view.x - view.w}
				y={wall.height_mm}
				width={view.w * 3}
				height={view.h * 2}
			/>
			<line
				class="ground-line"
				x1={view.x - view.w}
				x2={view.x + view.w * 2}
				y1={wall.height_mm}
				y2={wall.height_mm}
				vector-effect="non-scaling-stroke"
			/>

			<WallElevation
				{wall}
				design={editor.design}
				technical={editor.showTechnical}
				showIds={editor.showModuleIds}
				showOpeningSizes={editor.showDimensions && editor.showTechnical}
				{selected}
				hovered={editor.hoveredModuleId}
				focused={editor.focusedModuleId}
				{dropTarget}
				highlightOverrides={editor.showTechnical}
				interactive
			/>

			{#if editor.showDimensions}
				<g class="dims" style:font-size="{fontSize}px">
					<!-- Overall width -->
					<line
						x1="0"
						x2={wall.width_mm}
						y1={wall.height_mm + 650}
						y2={wall.height_mm + 650}
						vector-effect="non-scaling-stroke"
					/>
					{#each [0, wall.width_mm] as x (x)}
						<line
							x1={x}
							x2={x}
							y1={wall.height_mm + 120}
							y2={wall.height_mm + 650 + tick}
							vector-effect="non-scaling-stroke"
						/>
					{/each}
					<text x={wall.width_mm / 2} y={wall.height_mm + 650 - tick} text-anchor="middle"
						>{(wall.width_mm / 1000).toLocaleString('de-DE')} m</text
					>
					<!-- Chain dimension of opening edges -->
					<line
						x1="0"
						x2={wall.width_mm}
						y1={wall.height_mm + 330}
						y2={wall.height_mm + 330}
						vector-effect="non-scaling-stroke"
						class="chain"
					/>
					{#each openingXs as x, i (x)}
						<line
							x1={x}
							x2={x}
							y1={wall.height_mm + 330 - tick}
							y2={wall.height_mm + 330 + tick}
							vector-effect="non-scaling-stroke"
							class="chain"
						/>
						{#if i > 0 && x - openingXs[i - 1]! > 18 * unit * 3}
							<text
								class="chain-text"
								x={(x + openingXs[i - 1]!) / 2}
								y={wall.height_mm + 330 - tick * 0.8}
								text-anchor="middle">{x - openingXs[i - 1]!}</text
							>
						{/if}
					{/each}
					<!-- Overall height -->
					<line x1={-650} x2={-650} y1="0" y2={wall.height_mm} vector-effect="non-scaling-stroke" />
					{#each [0, wall.height_mm] as y (y)}
						<line x1={-650 - tick} x2={-120} y1={y} y2={y} vector-effect="non-scaling-stroke" />
					{/each}
					<text
						x={-650 - tick}
						y={wall.height_mm / 2}
						text-anchor="middle"
						transform="rotate(-90 {-650 - tick} {wall.height_mm / 2})"
						>{(wall.height_mm / 1000).toLocaleString('de-DE')} m</text
					>
				</g>
			{/if}

			{#if marqueeRect}
				<rect
					class="marquee"
					x={marqueeRect.x}
					y={marqueeRect.y}
					width={marqueeRect.w}
					height={marqueeRect.h}
					vector-effect="non-scaling-stroke"
				/>
			{/if}
		</svg>

		<div class="overlay top-left">
			<div class="segmented" role="group" aria-label="Werkzeug">
				<button
					class:active={editor.tool === 'select'}
					onclick={() => (editor.tool = 'select')}
					title="Auswählen (V)"
					aria-pressed={editor.tool === 'select'}
				>
					<Icon name="pointer" size={16} /> <span>Auswählen</span>
				</button>
				<button
					class:active={editor.tool === 'pan'}
					onclick={() => (editor.tool = 'pan')}
					title="Verschieben (H oder Leertaste gedrückt halten)"
					aria-pressed={editor.tool === 'pan'}
				>
					<Icon name="hand" size={16} /> <span>Verschieben</span>
				</button>
			</div>
		</div>

		<div class="overlay top-right">
			<div class="toggles">
				<label
					><input type="checkbox" bind:checked={editor.showTechnical} /> Modulgrenzen & Passstücke</label
				>
				<label><input type="checkbox" bind:checked={editor.showDimensions} /> Maße</label>
				<label><input type="checkbox" bind:checked={editor.showModuleIds} /> Modulnummern</label>
			</div>
		</div>

		<div class="overlay bottom-right">
			<div class="zoom" role="group" aria-label="Zoom">
				<button onclick={() => zoomBy(1.25)} title="Verkleinern (−)" aria-label="Verkleinern"
					><Icon name="zoomOut" size={16} /></button
				>
				<span class="num" aria-live="polite">{zoomPercent} %</span>
				<button onclick={() => zoomBy(0.8)} title="Vergrößern (+)" aria-label="Vergrößern"
					><Icon name="zoomIn" size={16} /></button
				>
				<button onclick={fit} title="Ganze Wand zeigen (0)" aria-label="Einpassen"
					><Icon name="fit" size={16} /></button
				>
			</div>
		</div>

		<div class="overlay bottom-left">
			<div class="legend" aria-label="Legende">
				<span><i class="sw std"></i>Standardmodul</span>
				<span><i class="sw special"></i>Passstück (Sondermodul)</span>
				<span><i class="sw window"></i>Fenster</span>
				<span><i class="sw door"></i>Tür</span>
				{#if cursor}
					<span class="mono coords">x {Math.round(cursor.x)} · y {Math.round(cursor.y)} mm</span>
				{/if}
			</div>
		</div>
	{:else}
		<div class="empty">Keine Wand ausgewählt.</div>
	{/if}
</div>

<style>
	.canvas {
		position: relative;
		height: 100%;
		min-height: 320px;
		background:
			radial-gradient(circle at 1px 1px, rgba(28, 31, 29, 0.09) 1px, transparent 0) 0 0 / 22px 22px,
			linear-gradient(#fbfaf7, #f1efe9);
		overflow: hidden;
	}
	.workspace {
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
		user-select: none;
	}
	.cursor-grab {
		cursor: grab;
	}
	.cursor-grabbing {
		cursor: grabbing;
	}
	.cursor-crosshair {
		cursor: crosshair;
	}
	.ground {
		fill: #e7e3d9;
	}
	.ground-line {
		stroke: #8d8a80;
		stroke-width: 1.5;
	}
	.dims line {
		stroke: #4a4f4b;
		stroke-width: 1;
	}
	.dims .chain {
		stroke: #8a8f8a;
	}
	.dims text {
		font-family: var(--font-mono);
		fill: #2f3431;
	}
	.dims .chain-text {
		fill: #6a6f6b;
		font-size: 0.85em;
	}
	.marquee {
		fill: rgba(36, 87, 214, 0.1);
		stroke: #2457d6;
		stroke-width: 1;
		stroke-dasharray: 5 4;
	}
	.overlay {
		position: absolute;
		display: flex;
		gap: 8px;
		pointer-events: none;
	}
	.overlay > * {
		pointer-events: auto;
	}
	.top-left {
		top: 12px;
		left: 12px;
	}
	.top-right {
		top: 12px;
		right: 12px;
	}
	.bottom-right {
		bottom: 12px;
		right: 12px;
	}
	.bottom-left {
		bottom: 12px;
		left: 12px;
		right: 200px;
	}
	.segmented,
	.zoom,
	.toggles,
	.legend {
		display: flex;
		align-items: center;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		box-shadow: var(--shadow-s);
		backdrop-filter: blur(6px);
	}
	.segmented {
		padding: 3px;
		gap: 2px;
	}
	.segmented button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 0;
		background: transparent;
		padding: 6px 10px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 500;
		color: var(--ink-soft);
	}
	.segmented button.active {
		background: var(--ink);
		color: #fff;
	}
	.zoom {
		padding: 3px;
		gap: 2px;
	}
	.zoom button {
		border: 0;
		background: transparent;
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border-radius: 7px;
		color: var(--ink-soft);
	}
	.zoom button:hover,
	.segmented button:not(.active):hover {
		background: var(--paper-deep);
	}
	.zoom span {
		min-width: 52px;
		text-align: center;
		font-size: 12px;
		color: var(--muted);
	}
	.toggles {
		padding: 6px 12px;
		gap: 14px;
		font-size: 13px;
		color: var(--ink-soft);
	}
	.toggles label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.toggles input {
		accent-color: var(--brand);
	}
	.legend {
		padding: 6px 12px;
		gap: 14px;
		font-size: 12px;
		color: var(--muted);
		flex-wrap: wrap;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.sw {
		width: 14px;
		height: 10px;
		border-radius: 2px;
		display: inline-block;
		border: 1px solid rgba(0, 0, 0, 0.45);
	}
	.sw.std {
		background: #ddd;
	}
	.sw.special {
		background: linear-gradient(135deg, #c98a2f 0 45%, #ddd 45%);
		border: 1px dashed #9a5b14;
	}
	.sw.window {
		background: #9fbacb;
	}
	.sw.door {
		background: #5d4d40;
	}
	.coords {
		color: var(--ink-soft);
	}
	.empty {
		display: grid;
		place-items: center;
		height: 100%;
		color: var(--muted);
	}
	@media (max-width: 1100px) {
		.segmented span,
		.toggles {
			display: none;
		}
		.bottom-left {
			display: none;
		}
	}
</style>
