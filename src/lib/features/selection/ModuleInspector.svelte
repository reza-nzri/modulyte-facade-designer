<!--
	Floating inspector for the clicked module (2D and 3D): id, type, size, area, position,
	finish (own or inherited from the wall) and its share of the price.
-->
<script lang="ts">
	import { findSurface, formatCents, isModuleOverridden, mm2ToM2 } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import Icon from '$lib/features/ui/Icon.svelte';
	import {
		colorHex,
		finishLabel,
		moduleTypeLabel,
		wallShortName
	} from '$lib/features/appearance/appearance';

	const editor = useEditor();

	const wall = $derived(editor.activeWall);
	const module = $derived(editor.focusedModule);
	const modulePrice = $derived(
		module ? editor.activeWallPrice?.modules.find((m) => m.moduleId === module.id) : undefined
	);
	const finish = $derived(module ? editor.moduleFinish(module.id) : undefined);
	const surface = $derived(
		finish && editor.project ? findSurface(editor.project, finish.surfaceId) : undefined
	);
	const overridden = $derived(
		!!module && !!wall && isModuleOverridden(editor.design, wall.id, module.id)
	);

	const m2 = (mm2: number) =>
		mm2ToM2(mm2).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
</script>

{#if module && wall}
	<aside class="inspector card" aria-label="Moduldetails" data-testid="module-details">
		<header>
			<div>
				<span class="eyebrow">Modul · {wallShortName(wall)}</span>
				<h3 class="mono">{module.id}</h3>
			</div>
			<button
				class="btn btn-ghost btn-icon btn-small"
				onclick={() => (editor.focusedModuleId = null)}
				aria-label="Moduldetails schließen"
			>
				<Icon name="x" size={15} />
			</button>
		</header>
		<span class="chip type" class:special={module.type === 'special'}
			>{moduleTypeLabel(module.type)}</span
		>
		<dl>
			<dt>Größe (B × H)</dt>
			<dd class="mono">{module.width_mm} × {module.height_mm} mm</dd>
			<dt>Fläche</dt>
			<dd class="num">{m2(modulePrice?.areaMm2 ?? 0)} m²</dd>
			<dt>Position</dt>
			<dd class="mono">x {module.x_mm} · y {module.y_mm}</dd>
			<dt>Gestaltung</dt>
			<dd>
				{#if finish && surface}
					<span class="finish"
						><i style:background={colorHex(finish.color)}></i>{finishLabel(
							surface,
							finish.color
						)}</span
					>
					<small>{overridden ? 'individuell gewählt' : 'wie die übrige Wand'}</small>
				{:else}–{/if}
			</dd>
			<dt>Preisanteil</dt>
			<dd class="num">
				{formatCents(Math.round(modulePrice?.costCentsExact ?? 0))}
				{#if surface}<small>{formatCents(Math.round(surface.eur_per_m2 * 100))} pro m²</small>{/if}
			</dd>
		</dl>
		{#if module.type === 'special'}
			<p class="explain">
				<Icon name="info" size={14} /> Passstücke werden auf Maß gefertigt – dort, wo kein Standardmodul
				hineinpasst.
			</p>
		{/if}
		{#if overridden}
			<button class="btn btn-small" onclick={() => editor.resetModules(wall.id, [module.id])}>
				<Icon name="reset" size={14} /> Wie übrige Wand gestalten
			</button>
		{/if}
	</aside>
{/if}

<style>
	.inspector {
		position: absolute;
		top: 64px;
		left: 12px;
		z-index: 5;
		width: 268px;
		padding: 12px 14px;
		display: grid;
		gap: 8px;
		box-shadow: var(--shadow-m);
		animation: appear 0.14s ease-out;
	}
	@keyframes appear {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h3 {
		font-size: 17px;
	}
	.type {
		justify-self: start;
	}
	.type.special {
		background: #fbecd8;
		color: #8a4f10;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 5px 12px;
		margin: 0;
		font-size: 13px;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
		text-align: right;
	}
	dd small {
		display: block;
		color: var(--muted);
		font-size: 11px;
	}
	.finish i {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 6px;
		vertical-align: -1px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
	}
	.explain {
		display: flex;
		gap: 6px;
		margin: 0;
		font-size: 12px;
		color: var(--muted);
	}
	@media (max-width: 720px) {
		.inspector {
			position: static;
			width: auto;
			margin: 8px;
		}
	}
</style>
