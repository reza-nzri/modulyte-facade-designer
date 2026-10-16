<script lang="ts">
	import { formatCentsDelta } from '$lib/domain';
	import { useEditor } from '$lib/features/editor/context';
	import Icon from './Icon.svelte';

	const editor = useEditor();
	// Plain object on purpose: timer handles are bookkeeping, not UI state.
	const timers: Record<number, ReturnType<typeof setTimeout>> = {};

	// Each notice disappears on its own; errors stay a little longer.
	$effect(() => {
		for (const notice of editor.notices) {
			if (timers[notice.id]) continue;
			const duration = notice.kind === 'error' ? 9000 : notice.kind === 'warning' ? 7000 : 3200;
			timers[notice.id] = setTimeout(() => {
				editor.dismissNotice(notice.id);
				delete timers[notice.id];
			}, duration);
		}
	});
</script>

<div class="toast-region" aria-live="polite" aria-atomic="false">
	{#each editor.notices as notice (notice.id)}
		<div class="toast {notice.kind}" role={notice.kind === 'error' ? 'alert' : 'status'}>
			<div class="text">
				<strong>{notice.title}</strong>
				{#if notice.detail}<span>{notice.detail}</span>{/if}
			</div>
			{#if notice.deltaCents !== undefined}
				<span
					class="delta num"
					class:delta-up={notice.deltaCents > 0}
					class:delta-down={notice.deltaCents < 0}
				>
					{formatCentsDelta(notice.deltaCents)}
				</span>
			{/if}
			<button
				class="close"
				onclick={() => editor.dismissNotice(notice.id)}
				aria-label="Hinweis schließen"
			>
				<Icon name="x" size={14} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toast-region {
		position: fixed;
		left: 50%;
		bottom: 20px;
		transform: translateX(-50%);
		display: grid;
		gap: 8px;
		z-index: 50;
		pointer-events: none;
		width: min(480px, calc(100vw - 32px));
	}
	.toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 10px 10px 14px;
		border-radius: var(--radius-m);
		background: var(--ink);
		color: #fff;
		box-shadow: var(--shadow-m);
		font-size: 14px;
		animation: slide 0.18s ease-out;
	}
	@keyframes slide {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
	}
	.toast.warning {
		background: #4a3615;
	}
	.toast.error {
		background: #5c2016;
	}
	.toast.success {
		background: var(--brand-strong);
	}
	.text {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.text span {
		opacity: 0.8;
		font-size: 13px;
	}
	.delta {
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}
	.delta.delta-up {
		color: #ffc7b8;
	}
	.delta.delta-down {
		color: #b6f0cf;
	}
	.close {
		border: 0;
		background: transparent;
		color: inherit;
		opacity: 0.7;
		padding: 4px;
		border-radius: 4px;
	}
	.close:hover {
		opacity: 1;
	}
</style>
