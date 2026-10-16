<!--
	Pure rendering of one wall elevation inside an <svg>. Wall data uses a bottom-left origin
	(y up); SVG uses top-left (y down). The flip happens only here: y_svg = H − (y + h).
	Used by the interactive canvas, thumbnails, the variant comparison and the print summary.
-->
<script lang="ts">
	import { getModuleFinish, type FacadeDesign, type Rect, type Wall } from '$lib/domain';
	import { colorHex, patternId } from '$lib/features/appearance/appearance';

	let {
		wall,
		design,
		textured = true,
		technical = false,
		showIds = false,
		showOpeningSizes = false,
		selected = new Set<string>(),
		hovered = null,
		focused = null,
		dropTarget = null,
		highlightOverrides = false,
		interactive = false
	}: {
		wall: Wall;
		design: FacadeDesign;
		textured?: boolean;
		technical?: boolean;
		showIds?: boolean;
		showOpeningSizes?: boolean;
		selected?: ReadonlySet<string>;
		hovered?: string | null;
		focused?: string | null;
		dropTarget?: string | null;
		highlightOverrides?: boolean;
		interactive?: boolean;
	} = $props();

	const H = $derived(wall.height_mm);

	function svgY(rect: Rect): number {
		return H - rect.y_mm - rect.height_mm;
	}

	function fillFor(moduleId: string): string {
		const finish = getModuleFinish(design, wall.id, moduleId);
		if (!finish) return '#d9d6ce';
		return textured ? `url(#${patternId(finish.surfaceId, finish.color)})` : colorHex(finish.color);
	}

	const overrides = $derived(design.moduleOverrides[wall.id] ?? {});
</script>

<g class="wall" class:interactive>
	<!-- Existing wall behind the new facade (visible only where no module sits). -->
	<rect class="wall-base" x="0" y="0" width={wall.width_mm} height={wall.height_mm} />

	{#each wall.modules as module (module.id)}
		<rect
			class="module"
			class:special={module.type === 'special'}
			data-module-id={interactive ? module.id : undefined}
			x={module.x_mm}
			y={svgY(module)}
			width={module.width_mm}
			height={module.height_mm}
			fill={fillFor(module.id)}
		/>
	{/each}

	{#if technical}
		{#each wall.modules as module (module.id)}
			<rect
				class="module-outline"
				class:special={module.type === 'special'}
				x={module.x_mm}
				y={svgY(module)}
				width={module.width_mm}
				height={module.height_mm}
				vector-effect="non-scaling-stroke"
			/>
			{#if module.type === 'special'}
				<!-- Corner mark for made-to-measure modules. -->
				<path
					class="special-mark"
					d="M {module.x_mm} {svgY(module)} h {Math.min(
						120,
						module.width_mm / 2
					)} L {module.x_mm} {svgY(module) + Math.min(120, module.height_mm / 2)} Z"
				/>
			{/if}
		{/each}
	{:else}
		{#each wall.modules as module (module.id)}
			<rect
				class="module-joint"
				x={module.x_mm}
				y={svgY(module)}
				width={module.width_mm}
				height={module.height_mm}
				vector-effect="non-scaling-stroke"
			/>
		{/each}
	{/if}

	{#if highlightOverrides}
		{#each wall.modules.filter((m) => overrides[m.id]) as module (module.id)}
			<rect
				class="override-mark"
				x={module.x_mm + 30}
				y={svgY(module) + 30}
				width={Math.max(0, module.width_mm - 60)}
				height={Math.max(0, module.height_mm - 60)}
				vector-effect="non-scaling-stroke"
			/>
		{/each}
	{/if}

	{#each wall.openings as opening, index (opening.id ?? index)}
		{@const y = svgY(opening)}
		{#if opening.type === 'window'}
			<g class="opening window">
				<rect
					class="frame"
					x={opening.x_mm}
					{y}
					width={opening.width_mm}
					height={opening.height_mm}
				/>
				<rect
					class="glass"
					x={opening.x_mm + 70}
					y={y + 70}
					width={Math.max(0, opening.width_mm - 140)}
					height={Math.max(0, opening.height_mm - 140)}
				/>
				{#if opening.width_mm > 1100}
					<rect
						class="frame"
						x={opening.x_mm + opening.width_mm / 2 - 35}
						y={y + 70}
						width="70"
						height={Math.max(0, opening.height_mm - 140)}
					/>
				{/if}
				<path
					class="glare"
					d="M {opening.x_mm + 130} {y + opening.height_mm - 160} L {opening.x_mm +
						Math.min(opening.width_mm * 0.45, 600)} {y + 130}"
					vector-effect="non-scaling-stroke"
				/>
				<rect
					class="sill"
					x={opening.x_mm - 40}
					y={y + opening.height_mm}
					width={opening.width_mm + 80}
					height="45"
				/>
			</g>
		{:else}
			<g class="opening door">
				<rect
					class="door-frame"
					x={opening.x_mm}
					{y}
					width={opening.width_mm}
					height={opening.height_mm}
				/>
				<rect
					class="door-leaf"
					x={opening.x_mm + 60}
					y={y + 60}
					width={Math.max(0, opening.width_mm - 120)}
					height={Math.max(0, opening.height_mm - 60)}
				/>
				{#if opening.width_mm > 1600}
					<rect
						class="door-glass"
						x={opening.x_mm + 140}
						y={y + 140}
						width={Math.max(0, opening.width_mm - 280)}
						height={Math.max(0, opening.height_mm - 300)}
					/>
				{:else}
					<rect
						class="door-glass"
						x={opening.x_mm + opening.width_mm / 2 - 110}
						y={y + 260}
						width="220"
						height={Math.max(0, opening.height_mm * 0.45)}
					/>
				{/if}
				<rect
					class="handle"
					x={opening.x_mm + opening.width_mm - 190}
					y={y + opening.height_mm * 0.52}
					width="110"
					height="28"
					rx="10"
				/>
			</g>
		{/if}
		{#if showOpeningSizes}
			<text
				class="opening-size"
				x={opening.x_mm + opening.width_mm / 2}
				y={y + opening.height_mm / 2}
				text-anchor="middle"
				dominant-baseline="middle">{opening.width_mm} × {opening.height_mm}</text
			>
		{/if}
	{/each}

	{#if dropTarget}
		{@const module = wall.modules.find((m) => m.id === dropTarget)}
		{#if module}
			<rect
				class="drop-target"
				x={module.x_mm}
				y={svgY(module)}
				width={module.width_mm}
				height={module.height_mm}
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	{/if}

	{#if selected.size > 0}
		{#each wall.modules.filter((m) => selected.has(m.id)) as module (module.id)}
			<rect
				class="selected"
				x={module.x_mm}
				y={svgY(module)}
				width={module.width_mm}
				height={module.height_mm}
				vector-effect="non-scaling-stroke"
			/>
		{/each}
	{/if}

	{#if hovered}
		{@const module = wall.modules.find((m) => m.id === hovered)}
		{#if module}
			<rect
				class="hovered"
				x={module.x_mm}
				y={svgY(module)}
				width={module.width_mm}
				height={module.height_mm}
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	{/if}

	{#if focused}
		{@const module = wall.modules.find((m) => m.id === focused)}
		{#if module}
			<rect
				class="focused"
				x={module.x_mm + 25}
				y={svgY(module) + 25}
				width={Math.max(0, module.width_mm - 50)}
				height={Math.max(0, module.height_mm - 50)}
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	{/if}

	{#if showIds}
		{#each wall.modules as module (module.id)}
			<text
				class="module-id"
				x={module.x_mm + module.width_mm / 2}
				y={svgY(module) + module.height_mm / 2}
				text-anchor="middle"
				dominant-baseline="middle">{module.id}</text
			>
		{/each}
	{/if}

	<rect
		class="wall-outline"
		x="0"
		y="0"
		width={wall.width_mm}
		height={wall.height_mm}
		vector-effect="non-scaling-stroke"
	/>
</g>

<style>
	.wall-base {
		fill: #dcd8cf;
	}
	.module {
		shape-rendering: crispEdges;
	}
	.interactive .module {
		cursor: pointer;
	}
	.module-joint {
		fill: none;
		stroke: rgba(20, 22, 21, 0.28);
		stroke-width: 0.75;
		pointer-events: none;
	}
	.module-outline {
		fill: none;
		stroke: rgba(20, 22, 21, 0.55);
		stroke-width: 1;
		pointer-events: none;
	}
	.module-outline.special {
		stroke: #9a5b14;
		stroke-dasharray: 5 3;
		stroke-width: 1.25;
	}
	.special-mark {
		fill: #c98a2f;
		opacity: 0.85;
		pointer-events: none;
	}
	.override-mark {
		fill: none;
		stroke: rgba(255, 255, 255, 0.85);
		stroke-width: 1.5;
		stroke-dasharray: 2 3;
		pointer-events: none;
	}
	.opening {
		pointer-events: none;
	}
	.window .frame {
		fill: #f3f2ee;
		stroke: #8f938f;
		stroke-width: 6;
	}
	.window .glass {
		fill: #9fbacb;
	}
	.window .glare {
		stroke: rgba(255, 255, 255, 0.55);
		stroke-width: 2;
	}
	.window .sill {
		fill: #b9b6ae;
	}
	.door .door-frame {
		fill: #f3f2ee;
		stroke: #8f938f;
		stroke-width: 6;
	}
	.door .door-leaf {
		fill: #5d4d40;
	}
	.door .door-glass {
		fill: #9fbacb;
		opacity: 0.9;
	}
	.door .handle {
		fill: #d6d3cb;
	}
	.opening-size {
		font-family: var(--font-mono);
		font-size: 120px;
		fill: #1c1f1d;
		paint-order: stroke;
		stroke: rgba(255, 255, 255, 0.85);
		stroke-width: 24px;
	}
	.selected {
		fill: rgba(36, 87, 214, 0.22);
		stroke: #2457d6;
		stroke-width: 2;
		pointer-events: none;
	}
	.hovered {
		fill: rgba(255, 255, 255, 0.18);
		stroke: rgba(36, 87, 214, 0.75);
		stroke-width: 2;
		pointer-events: none;
	}
	.focused {
		fill: none;
		stroke: #1c1f1d;
		stroke-width: 2;
		stroke-dasharray: 4 3;
		pointer-events: none;
	}
	.drop-target {
		fill: rgba(36, 87, 214, 0.3);
		stroke: #2457d6;
		stroke-width: 3;
		pointer-events: none;
	}
	.module-id {
		font-family: var(--font-mono);
		font-size: 95px;
		fill: #fff;
		paint-order: stroke;
		stroke: rgba(0, 0, 0, 0.55);
		stroke-width: 18px;
		pointer-events: none;
	}
	.wall-outline {
		fill: none;
		stroke: #1c1f1d;
		stroke-width: 1.5;
		pointer-events: none;
	}
</style>
