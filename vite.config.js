import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [sveltekit()],
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: '@import "./src/lib/styles/_variables.scss";',
            },
        },
    },
    server: {
        proxy: {
            "/chess": {
                target: "ws://localhost:3000",
                ws: true,
            },
        },
    },
});
