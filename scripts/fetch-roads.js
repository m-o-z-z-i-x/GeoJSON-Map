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
		// create directory for saving if it does not exist
		await mkdir(OUTPUT_DIR, { recursive: true });
		console.log("Downloading road data from Overpass API...");
		
		const file = createWriteStream(TEMP_FILE);
		
		https.get(ROADS_URL, (response) => {
			if (response.statusCode !== 200) {
				throw new Error(`Error downloading file: ${response.statusCode}`);
			}

			console.log("Download started...");
			response.pipe(file);

			file.on("finish", async () => {
				file.close();
				console.log("Download completed successfully!");
				console.log("Converting data from OSM to GeoJSON...");
				
				try {
					// read OSM data
					const osmData = JSON.parse(await readFile(TEMP_FILE, 'utf8'));
					
					// convert to GeoJSON
					const geojsonData = osmtogeojson(osmData);
					
					// save GeoJSON
					await writeFile(OUTPUT_FILE, JSON.stringify(geojsonData, null, 2));
					
					console.log("Conversion completed successfully!");
					console.log("Data saved to file:", OUTPUT_FILE);
					
					// delete temporary file
					await unlink(TEMP_FILE);
				} catch (error) {
					console.error("Error during data conversion:", error.message);
					process.exit(1);
				}
			});
		}).on("error", (err) => {
			console.error("Error during file download:", err.message);
			process.exit(1);
		});

		file.on("error", (err) => {
			console.error("Error writing file:", err.message);
			process.exit(1);
		});
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}

downloadFile(); 