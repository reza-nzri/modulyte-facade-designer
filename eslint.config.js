import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// The domain layer must stay framework-free so it can be reused by an API or other clients.
		files: ['src/lib/domain/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{ patterns: ['svelte', 'svelte/*', '$app/*', 'three', '$lib/features/*'] }
			]
		}
	},
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', 'coverage/', 'playwright-report/', 'test-results/']
	}
);
