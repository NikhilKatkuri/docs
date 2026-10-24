import { fileURLToPath, URL } from 'node:url';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [reactRouter(), tailwindcss()],
    server: {
        port: 3000,
        host: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@components': fileURLToPath(
                new URL('./src/components', import.meta.url)
            ),
            '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
            '@hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
            '@features': fileURLToPath(
                new URL('./src/features', import.meta.url)
            ),
        },
    },
    build: {
        sourcemap: false,
        minify: 'esbuild',
    },
});
