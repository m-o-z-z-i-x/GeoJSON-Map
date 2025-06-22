## About the Project

This is a web application for working with geographic data and building routes. The project is created to demonstrate skills in Vue.js and geospatial data, and includes interactive maps and routing algorithms.

> [!NOTE]  
> Moscow is chosen as the test region. The GeoJSON contains routes only within this region (inside the area marked on the map).

## Demo

<img src="public/assets/webp/demo.webp">

## Project Requirements

### Main Features
1. **Interactive map with rendered roads**
   - Ability to zoom for detailed viewing
   - Ability to move the map to explore different areas
2. **Setting points on the map**
   - Points are represented as markers that can be moved via drag-and-drop
   - When a new point is selected, the previous one is removed for easier interaction
3. **Finding the shortest route**
   - The algorithm calculates and highlights the path on the map between the set points
   - Direction and one-way roads are not considered for route simplification

## Project Structure

### Main Components

- `src/components/Map.vue` - main map component, responsible for rendering and interaction
- `src/components/LoadingProgress.vue` - component displaying data loading progress
- `src/views/MapView.vue` - view containing the map and controls

### Technologies

- **Vue.js 3** - main framework for UI development
- **Leaflet.js** - library for interactive maps
- **Turf.js** - for geospatial calculations
- **Vite** - project build tool
- **SASS** - for styling (installed but not used)
- **Pinia** - for state management (installed but not used)
- **Vue Router** - for routing (installed but not used)

## Main Functionality

### Interactive Map
- Display of Moscow's road network from GeoJSON
- Setting and moving markers using drag-and-drop
- Automatic removal of the previous point when adding a new one

### Routing Algorithm
- Implementation of the [A*](https://en.wikipedia.org/wiki/A*_search_algorithm) algorithm for finding the shortest path
- Takes into account the real road network (no building crossings)
- Calculations are performed in a Web Worker to keep the UI responsive
- Visualization of search progress
- Maximum distance between points is limited (50 km)

### Data Processing
- Loading data from OpenStreetMap via Overpass API
- Automatic filtering of data by Moscow boundaries
- Data structure optimization for road graph processing

## How to Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Download road data:**
   Road data in GeoJSON format can be obtained in two ways:
   - Via Overlay API command:
   ```bash
   npm run fetch-roads
   ```
   - Manually download the `roads.geojson` file and place it in the `public/data/` directory

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

## Technical Features

- Architecture based on Vue 3 Composition API
- Use of Web Worker for background calculations
- Working with real geodata of Moscow's road network
- Performance optimization for processing large amounts of data
- Detailed error handling and logging