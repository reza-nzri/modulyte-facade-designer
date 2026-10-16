<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<main class="error-page">
	<div class="card">
		<p class="eyebrow">Fehler {page.status}</p>
		<h1>{page.error?.message ?? 'Etwas ist schiefgelaufen.'}</h1>
		<p>
			Ihre Gestaltung wird automatisch im Browser gespeichert. Laden Sie die Seite neu, um
			weiterzuarbeiten.
		</p>
		{#if page.error?.errorId}
			<p class="mono ref">Fehler-Referenz: {page.error.errorId}</p>
		{/if}
		<a class="btn btn-primary" href={resolve('/')}>Zurück zum Fassadendesigner</a>
	</div>
</main>

<style>
	.error-page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.card {
		max-width: 460px;
		padding: 32px;
		display: grid;
		gap: 12px;
	}
	h1 {
		font-size: 22px;
	}
	p {
		margin: 0;
		color: var(--muted);
	}
	.ref {
		font-size: 12px;
	}
	a {
		justify-self: start;
		text-decoration: none;
	}
</style>
