// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        lib: {
            // Could also be a dictionary or array of multiple entry points
            entry: resolve(__dirname, 'lib/trax.js'),
            name: 'trax',
            fileName: 'trax'
        },
        rollupOptions: {

        },
    },
})

