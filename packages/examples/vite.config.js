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
            output: {
                strict: true
            }
        },
    },
})

