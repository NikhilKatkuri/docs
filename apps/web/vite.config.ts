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
});
