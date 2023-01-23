// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'lib/index.js'),
            name: 'trax-react',
            fileName: 'trax-react',
        },
        rollupOptions: {
            external: [
                "@traxjs/trax",
                "react"
            ],
            output: {
                strict: true,
                globals: {
                    "react": "React",
                    "@traxjs/trax": "trax"
                }
            }
        },
    },
});

