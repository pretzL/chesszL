import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { mkdirSync, copyFileSync, existsSync } from "fs";
import { resolve } from "path";

export default defineConfig({
    plugins: [
        sveltekit(),
        {
            name: "copy-server",
            closeBundle: () => {
                const buildDir = resolve(process.cwd(), "build");

                if (!existsSync(buildDir)) {
                    mkdirSync(buildDir, { recursive: true });
                }

                try {
                    copyFileSync(resolve(process.cwd(), "server.js"), resolve(buildDir, "server.js"));
                    console.log("Successfully copied server.js to build directory");
                } catch (error) {
                    console.error("Error copying server.js:", error);
                    throw error;
                }
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
