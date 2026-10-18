import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: { runes: true },
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		paths: { base: process.env.GITHUB_PAGES === 'true' ? '/modulyte-facade-designer' : '' },
		alias: { $domain: 'src/lib/domain', $features: 'src/lib/features' }
	}
};

export default config;
