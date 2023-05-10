// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';
import preact from "@preact/preset-vite";


export default defineConfig({
    plugins: [preact()],
    test: {
        environment: 'jsdom'
    },
    build: {
        lib: {
            entry: resolve(__dirname, 'lib/index.js'),
            name: 'trax-preact',
            fileName: 'trax-preact',
        },
        rollupOptions: {
            external: [
                "@traxjs/trax",
                "preact",
                "preact/hooks"
            ],
            output: {
                strict: true,
                globals: {
                    "@traxjs/trax": "trax",
                    "preact": "preact",
                    "preact/hooks": "hooks"
                }
            }
        },
    },
});

