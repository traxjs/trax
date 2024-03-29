// vite.config.js
import preact from "@preact/preset-vite";
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [preact()],
    test: {
        environment: 'jsdom'
    },
    build: {
        rollupOptions: {
            input: {
                "index": "index.html",
                "panel": "src/panel/panel.html"
            },
            output: {
                strict: true,
                dir: "dist"
            }
        },
    },
});

