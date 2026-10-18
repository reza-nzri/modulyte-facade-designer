import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: true
	},
	kit: {
		// Static SPA build: the MVP has no server-side state, so it can be hosted on any static host.
		adapter: adapter({ fallback: 'index.html' }),
		alias: {
			$domain: 'src/lib/domain',
			$features: 'src/lib/features'
		}
	}
};

export default config;
