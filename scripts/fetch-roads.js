import { createWriteStream } from "fs";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import https from "https";
import osmtogeojson from "osmtogeojson";

const ROADS_URL = "https://overpass-api.de/api/interpreter?data=[out:json];area[name=\"Москва\"]->.searchArea;(way[highway](area.searchArea);>;);out body;";
const OUTPUT_DIR = "public/data";
const OUTPUT_FILE = `${OUTPUT_DIR}/roads.geojson`;
const TEMP_FILE = `${OUTPUT_DIR}/roads.osm.json`;

async function downloadFile() {
  try {
    // создаем директорию для сохранения, если она не существует
    await mkdir(OUTPUT_DIR, { recursive: true });
    console.log("Загрузка данных о дорогах из Overpass API...");
    
    const file = createWriteStream(TEMP_FILE);
    
    https.get(ROADS_URL, (response) => {
      if (response.statusCode !== 200) {
        throw new Error(`Ошибка загрузки файла: ${response.statusCode}`);
      }

      console.log("Загрузка началась...");
      response.pipe(file);

      file.on("finish", async () => {
        file.close();
        console.log("Загрузка успешно завершена!");
        console.log("Конвертация данных из OSM в GeoJSON...");
        
        try {
          // читаем OSM данные
          const osmData = JSON.parse(await readFile(TEMP_FILE, 'utf8'));
          
          // конвертируем в GeoJSON
          const geojsonData = osmtogeojson(osmData);
          
          // сохраняем GeoJSON
          await writeFile(OUTPUT_FILE, JSON.stringify(geojsonData, null, 2));
          
          console.log("Конвертация успешно завершена!");
          console.log("Данные сохранены в файл:", OUTPUT_FILE);
          
          // удаляем временный файл
          await unlink(TEMP_FILE);
        } catch (error) {
          console.error("Ошибка при конвертации данных:", error.message);
          process.exit(1);
        }
      });
    }).on("error", (err) => {
      console.error("Ошибка при загрузке файла:", err.message);
      process.exit(1);
    });

    file.on("error", (err) => {
      console.error("Ошибка при записи файла:", err.message);
      process.exit(1);
    });
  } catch (error) {
    console.error("Ошибка:", error.message);
    process.exit(1);
  }
}

downloadFile(); 