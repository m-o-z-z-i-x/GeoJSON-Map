import { existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const roadsPath = join(__dirname, "..", "public", "data", "roads.geojson");

if (!existsSync(roadsPath)) {
	console.error("\x1b[31m%s\x1b[0m", "Ошибка: файл roads.geojson не найден!");
	console.error("\x1b[33m%s\x1b[0m", "Пожалуйста, запустите 'npm run fetch-roads' для загрузки необходимых данных.");
	process.exit(1);
}

console.log("\x1b[32m%s\x1b[0m", "✓ Файл roads.geojson найден, запуск сервера разработки..."); 