<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		open = $bindable(false),
		title,
		subtitle,
		width = 640,
		children,
		footer,
		testId
	}: {
		open?: boolean;
		title: string;
		subtitle?: string;
		width?: number;
		children: Snippet;
		footer?: Snippet;
		testId?: string;
	} = $props();

	const uid = $props.id();
	let dialog = $state<HTMLDialogElement>();

	// Native <dialog> provides focus trapping, Esc handling and an accessible modal role.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function onBackdropClick(event: MouseEvent) {
		if (event.target === dialog) open = false;
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={onBackdropClick}
	style:--dialog-width="{width}px"
	aria-labelledby="{uid}-title"
	data-testid={testId}
>
	{#if open}
		<div class="frame">
			<header>
				<div>
					<h2 id="{uid}-title">{title}</h2>
					{#if subtitle}<p>{subtitle}</p>{/if}
				</div>
				<button
					class="btn btn-ghost btn-icon"
					onclick={() => (open = false)}
					aria-label="Schließen"
				>
					<Icon name="x" />
				</button>
			</header>
			<div class="body">
				{@render children()}
			</div>
			{#if footer}
				<footer>{@render footer()}</footer>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	dialog {
		width: min(var(--dialog-width), calc(100vw - 32px));
		max-height: calc(100vh - 48px);
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius-l);
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow-l);
	}
	dialog::backdrop {
		background: rgba(28, 31, 29, 0.32);
		backdrop-filter: blur(2px);
	}
	dialog[open] {
		animation: rise 0.16s ease-out;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
	.frame {
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 50px);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		padding: 20px 20px 12px 24px;
		border-bottom: 1px solid var(--line);
	}
	h2 {
		font-size: 18px;
	}
	header p {
		margin: 4px 0 0;
		color: var(--muted);
		font-size: 14px;
	}
	.body {
		padding: 20px 24px;
		overflow: auto;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 14px 24px;
		border-top: 1px solid var(--line);
		background: var(--surface-muted);
		border-radius: 0 0 var(--radius-l) var(--radius-l);
	}
</style>
