import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const roadsPath = join(__dirname, "..", "public", "data", "roads.geojson");

if (!existsSync(roadsPath)) {
	console.error("\x1b[31m%s\x1b[0m", "Error: Roads.geojson file not found!");
	console.error("\x1b[33m%s\x1b[0m", "Please run 'npm run fetch-roads' to download the required data.");
	process.exit(1);
}

console.log("\x1b[32m%s\x1b[0m", "✓ roads.geojson file found, starting development server..."); 