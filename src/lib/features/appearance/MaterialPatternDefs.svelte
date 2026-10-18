<!--
	Global SVG pattern definitions for every (surface, colour) combination of the project.
	Mounted once per document so all elevations (canvas, thumbnails, compare, print) can
	reference them via url(#id). Pattern units are millimetres of the wall coordinate system.
-->
<script lang="ts">
	import type { Surface } from '$lib/domain';
	import { colorHex, patternId, shade, surfacePresentation } from './appearance';

	let { surfaces }: { surfaces: readonly Surface[] } = $props();

	const finishes = $derived(
		surfaces.flatMap((surface) =>
			surface.colors.map((color) => ({
				id: patternId(surface.id, color),
				texture: surfacePresentation(surface).texture,
				base: colorHex(color)
			}))
		)
	);

	// Brick slips: 240 × 71 mm with 10 mm joints, running bond.
	const BRICK_W = 240;
	const BRICK_H = 71;
	const JOINT = 10;
	const brickRows = [0, 1] as const;
	const brickCols = [-1, 0, 1] as const;
</script>

<svg class="pattern-defs" width="0" height="0" aria-hidden="true" focusable="false">
	<defs>
		{#each finishes as finish (finish.id)}
			{#if finish.texture === 'brick'}
				<pattern
					id={finish.id}
					patternUnits="userSpaceOnUse"
					width={BRICK_W + JOINT}
					height={(BRICK_H + JOINT) * 2}
				>
					<rect
						width={BRICK_W + JOINT}
						height={(BRICK_H + JOINT) * 2}
						fill={shade(finish.base, 0.45)}
					/>
					{#each brickRows as row (row)}
						{#each brickCols as col (col)}
							<rect
								x={col * (BRICK_W + JOINT) + (row === 1 ? (BRICK_W + JOINT) / 2 : 0)}
								y={row * (BRICK_H + JOINT) + JOINT / 2}
								width={BRICK_W}
								height={BRICK_H}
								fill={shade(
									finish.base,
									row === 0 ? (col === 0 ? 0 : -0.06) : col === 1 ? 0.05 : -0.03
								)}
							/>
						{/each}
					{/each}
				</pattern>
			{:else if finish.texture === 'battens'}
				<!-- Vertical battens: 66 mm slats with 14 mm shadow gaps. -->
				<pattern id={finish.id} patternUnits="userSpaceOnUse" width="80" height="1000">
					<rect width="80" height="1000" fill={shade(finish.base, -0.55)} />
					<rect x="7" width="66" height="1000" fill={finish.base} />
					<rect x="7" width="10" height="1000" fill={shade(finish.base, 0.18)} />
					<rect x="61" width="12" height="1000" fill={shade(finish.base, -0.18)} />
				</pattern>
			{:else if finish.texture === 'panel'}
				<!-- Large-format panels with subtle 5 mm open joints every 1250 mm. -->
				<pattern id={finish.id} patternUnits="userSpaceOnUse" width="1250" height="1250">
					<rect width="1250" height="1250" fill={finish.base} />
					<rect width="1250" height="625" fill={shade(finish.base, 0.04)} />
					<rect x="1245" width="5" height="1250" fill={shade(finish.base, -0.3)} />
					<rect y="1245" width="1250" height="5" fill={shade(finish.base, -0.3)} />
				</pattern>
			{:else}
				<pattern id={finish.id} patternUnits="userSpaceOnUse" width="100" height="100">
					<rect width="100" height="100" fill={finish.base} />
				</pattern>
			{/if}
		{/each}
	</defs>
</svg>

<style>
	/* Must stay rendered (not display:none) or browsers drop the referenced patterns. */
	.pattern-defs {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
		pointer-events: none;
	}
</style>
