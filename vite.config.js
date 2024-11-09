import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { mkdirSync, copyFileSync, existsSync } from "fs";
import { resolve } from "path";

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
            "/ws": {
                target: "ws://localhost:3000",
                ws: true,
            },
        },
    },
});
