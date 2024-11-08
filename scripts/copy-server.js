// scripts/copy-server.js
import { copyFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
    const buildDir = resolve(__dirname, "..", "build");

    // Ensure build directory exists
    if (!existsSync(buildDir)) {
        mkdirSync(buildDir, { recursive: true });
    }

    // Copy server.js to build directory
    copyFileSync(resolve(__dirname, "..", "server.js"), resolve(buildDir, "server.js"));

    console.log("Successfully copied server.js to build directory");
} catch (error) {
    console.error("Error copying server.js:", error);
    process.exit(1);
}
