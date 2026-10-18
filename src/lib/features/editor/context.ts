import { getContext, setContext } from 'svelte';
import type { EditorStore } from './editorStore.svelte';

const KEY = Symbol('facade-editor');

export function provideEditor(store: EditorStore): EditorStore {
	return setContext(KEY, store);
}

export function useEditor(): EditorStore {
	const store = getContext<EditorStore | undefined>(KEY);
	if (!store) throw new Error('useEditor() must be called inside the editor page');
	return store;
}
