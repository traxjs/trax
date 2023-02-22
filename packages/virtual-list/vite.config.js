// vite.config.js
import preact from "@preact/preset-vite";
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [preact()],
    test: {
        environment: 'jsdom'
    },
    build: {
        rollupOptions: {
            input: {
                "index": "index.html",
                "virtual-list": "src/virtual-list.tsx"
            },
            external: [
                "@traxjs/trax",
                "@traxjs/trax-react",
                "react",
                "preact"
            ],
            output: {
                strict: true,
                dir: "dist",
                entryFileNames: '[name].js'
            }
        },
    },
});
