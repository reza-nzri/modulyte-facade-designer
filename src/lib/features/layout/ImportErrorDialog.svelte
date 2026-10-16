<script lang="ts">
	import type { ImportResult } from '$lib/io/importDocument';
	import Dialog from '$lib/features/ui/Dialog.svelte';

	let { error = $bindable(null) }: { error: Extract<ImportResult, { ok: false }> | null } =
		$props();

	// Open while an error is present; closing the dialog clears the error.
	const getOpen = () => error !== null;
	const setOpen = (value: boolean) => {
		if (!value) error = null;
	};
</script>

<Dialog
	bind:open={getOpen, setOpen}
	title="Datei konnte nicht geöffnet werden"
	width={520}
	testId="import-error"
>
	{#if error}
		<p class="message">{error.error}</p>
		{#if error.details.length > 0}
			<details>
				<summary>Technische Details</summary>
				<ul class="mono">
					{#each error.details as detail, index (index)}<li>{detail}</li>{/each}
				</ul>
			</details>
		{/if}
		<p class="hint">Ihr aktueller Entwurf bleibt unverändert.</p>
	{/if}
	{#snippet footer()}
		<button class="btn btn-primary" onclick={() => (error = null)}>Verstanden</button>
	{/snippet}
</Dialog>

<style>
	.message {
		margin: 0 0 12px;
		font-weight: 500;
	}
	details {
		font-size: 13px;
		color: var(--ink-soft);
	}
	ul {
		margin: 8px 0 0;
		padding-left: 18px;
		font-size: 12px;
		word-break: break-word;
	}
	.hint {
		margin: 12px 0 0;
		color: var(--muted);
		font-size: 13px;
	}
</style>
