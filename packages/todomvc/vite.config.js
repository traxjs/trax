// vite.config.js
import preact from "@preact/preset-vite";
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [preact()],
    build: {
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
