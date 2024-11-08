import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { writeFileSync, copyFileSync } from "fs";

export default defineConfig({
    plugins: [
        sveltekit(),
        {
            name: "copy-server",
            closeBundle: () => {
                copyFileSync("./server.js", "build/server.js");
            },
        },
    ],
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
