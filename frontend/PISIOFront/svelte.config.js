import adapter from '@sveltejs/adapter-node'; // Izmenjeno sa adapter-auto
import { relative, sep } from 'node:path';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),

    compilerOptions: {
        // Zadržavamo tvoju logiku za Svelte 5 Runes
        runes: ({ filename }) => {
            const relativePath = relative(import.meta.dirname, filename);
            const pathSegments = relativePath.toLowerCase().split(sep);
            const isExternalLibrary = pathSegments.includes('node_modules');

            return isExternalLibrary ? undefined : true;
        }
    },
    kit: {
        adapter: adapter()
    }
};

export default config;
