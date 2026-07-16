<script setup>
	import { ref, onMounted, onUnmounted } from "vue";
	import L from "leaflet";
	import "leaflet/dist/leaflet.css";
	import * as turf from "@turf/turf";
	import LoadingProgress from "@/components/LoadingProgress.vue";

	const mapContainer = ref(null);
	const map = ref(null);
	const worker = ref(null);
	const routeLayer = ref(null);
	const roadData = ref(null);
	const startMarker = ref(null);
	const endMarker = ref(null);
	const startPoint = ref(null);
	const endPoint = ref(null);
	const route = ref(null);
	const isMobile = ref(window.innerWidth <= 768);
	const boundaryLayer = ref(null);

	// loading state for roads
	const isLoadingRoads = ref(false);
	const roadsLoadingMessage = ref("");
	const roadsLoadingProgress = ref(0);

	// loading state for route
	const isLoadingRoute = ref(false);
	const routeLoadingMessage = ref("");
	const routeLoadingProgress = ref(0);

	// center of Moscow and radius in kilometers
	const moscowCenter = {
		lat: 55.7558,
		lng: 37.6173
	}
	const moscowRadius = 15; // 15 km from center

	// map initialization
	onMounted(() => {
		console.log("Map initialization");
		console.log("Map container:", mapContainer.value);

		if (!mapContainer.value) {
			console.error("Map container not found!");
			return;
		}

		map.value = L.map(mapContainer.value).setView([moscowCenter.lat, moscowCenter.lng], 11);

		console.log("Map created");

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "© OpenStreetMap contributors"
		}).addTo(map.value);
		console.log("Base layer added");

		// add a circle showing the area boundaries
		boundaryLayer.value = L.circle([moscowCenter.lat, moscowCenter.lng], {
			radius: moscowRadius * 1000, // convert km to meters
			color: "#3388ff",
			fillColor: "#3388ff",
			fillOpacity: 0.1,
			weight: 2
		}).addTo(map.value);

		// worker initialization
		try {
			worker.value = new Worker(new URL("../scripts/pathFinder.worker.js", import.meta.url), {
				type: "module"
			});
			worker.value.onmessage = handleWorkerMessage;

			console.log("Web worker initialized");

			// send area parameters to worker
			worker.value.postMessage({
				type: "set_area",
				data: {
					center: moscowCenter,
					radius: moscowRadius
				}
			});

			// load road data
			loadRoadData();
		} catch (error) {
			console.error("Error during web worker initialization:", error);

			isLoadingRoads.value = false;
			roadsLoadingMessage.value = "initialization error";
		}

		// add click handler for setting points
		map.value.on("click", handleMapClick);
		console.log("Click handler added");

		// add resize handler
		const handleResize = () => {
			isMobile.value = window.innerWidth <= 768;
			if (map.value) {
				map.value.invalidateSize();
			}
		}

		window.addEventListener("resize", handleResize);
		console.log("Resize handler added");
	});

	// cleanup
	onUnmounted(() => {
		if (map.value) {
			map.value.remove();
		}
		if (worker.value) {
			worker.value.terminate();
			worker.value = null;
		}

		window.removeEventListener("resize", handleResize);
	});

	// handle messages from worker
	const handleWorkerMessage = (event) => {
		const { type, path, error, roads, progress, center, radius } = event.data;

		console.log("Message received from worker:", type, event.data);

		if (error) {
			console.error("Error from worker:", error);

			isLoadingRoads.value = false;
			isLoadingRoute.value = false;

			// show a clear message for 'no path found' error
			if (error === "No path found between points") {
				routeLoadingMessage.value = "Could not find a path between the selected points. Try choosing different points.";
			} else {
				roadsLoadingMessage.value = `Error: ${error}`;
				routeLoadingMessage.value = `Error: ${error}`;
			}
			
			setTimeout(() => {
				roadsLoadingMessage.value = "";
				routeLoadingMessage.value = "";
			}, 5000); // Increased timeout to 5 seconds for better readability

			return;
		}

		switch (type) {
			case "init_complete":
				console.log("Worker initialization complete");

				isLoadingRoads.value = false;
				roadsLoadingProgress.value = 0;
				roadsLoadingMessage.value = "";

				break;

			case "area_set":
				console.log("Area parameters set:", { center, radius });
				break;

			case "roads_loaded":
				roadData.value = roads;
				// give time to display 100% progress
				setTimeout(() => {
					isLoadingRoads.value = false;
					roadsLoadingProgress.value = 0;
					roadsLoadingMessage.value = "";
				}, 1000);
				break;

			case "roads_progress":
				roadsLoadingProgress.value = progress;
				roadsLoadingMessage.value = `Loading road data: ${Math.round(progress)}%`;
				break;

			case "route_progress":
				routeLoadingProgress.value = progress;
				routeLoadingMessage.value = `Searching for the shortest route: ${Math.round(progress)}%`;
				break;

			case "route_found":
				if (path) {
					drawRoute(path);
				}

				// give time to display 100% progress before closing
				setTimeout(() => {
					isLoadingRoute.value = false;
					routeLoadingProgress.value = 0;
					routeLoadingMessage.value = "";
				}, 1000);

				break;

			default:
				console.warn("Unknown message type:", type);
		}
	}

	// load road data
	const loadRoadData = async () => {
		try {
			console.log("Starting to load road data");

			isLoadingRoads.value = true;
			roadsLoadingProgress.value = 0;
			roadsLoadingMessage.value = "Loading road data...";

			const response = await fetch("/data/roads.geojson");

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			console.log("Road data loaded:", data);

			if (!data || !data.features || !Array.isArray(data.features)) {
				throw new Error("Invalid road data format");
			}

			// send data to worker
			sendDataToWorker(data);
		} catch (error) {
			console.error("Error during road data loading:", error);

			isLoadingRoads.value = false;
			roadsLoadingMessage.value = `Error: ${error.message}`;

			setTimeout(() => {
				roadsLoadingMessage.value = "";
			}, 3000);
		}
	}

	// send data to worker
	const sendDataToWorker = (data) => {
		worker.value.postMessage({
			type: "init",
			data: {
				roads: data
			}
		});
		console.log("Data sent to worker");
	}

	// function to add a point to the map
	const addPoint = (lat, lng) => {
		// if there is no start point, add it
		if (!startPoint.value) {
			startPoint.value = [lat, lng];

			addMarker(lat, lng, "start");
		}

		// if there is a start point but no end point, add the end point
		else if (!endPoint.value) {
			endPoint.value = [lat, lng];

			addMarker(lat, lng, "end");
			// automatically search for a route after both points are set
			findRoute();
		}
		// if both points are already set, replace the end point
		else {
			endPoint.value = [lat, lng];

			addMarker(lat, lng, "end");
			// recalculate the route
			findRoute();
		}
	}

	// handle map click
	const handleMapClick = (e) => {
		const { lat, lng } = e.latlng;

		console.log("Map click:", { lat, lng });

		// check if the point is within the allowed area
		const point = turf.point([lng, lat]);
		const center = turf.point([moscowCenter.lng, moscowCenter.lat]);
		const distance = turf.distance(point, center, { units: "kilometers" });

		if (distance > moscowRadius) {
			roadsLoadingMessage.value = "The point is outside the allowed area";

			setTimeout(() => {
				roadsLoadingMessage.value = "";
			}, 3000);

			return;
		}

		// if there is a route, clear it when clicking on the map
		if (route.value) {
			clearMap();
		}

		// add a new point
		addPoint(lat, lng);
	}

	// function to find a route
	const findRoute = async () => {
		if (!startPoint.value || !endPoint.value) {
			console.error("Start or end point not selected");
			return;
		}

		isLoadingRoute.value = true;
		routeLoadingProgress.value = 0;
		routeLoadingMessage.value = "Searching for the shortest route: 0%";

		// convert coordinates to numbers and check their validity
		const startLat = parseFloat(startPoint.value[0]);
		const startLng = parseFloat(startPoint.value[1]);
		const endLat = parseFloat(endPoint.value[0]);
		const endLng = parseFloat(endPoint.value[1]);

		if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
			console.error("Invalid coordinates:", { startPoint: startPoint.value, endPoint: endPoint.value });

			isLoadingRoute.value = false;
			routeLoadingMessage.value = "Error: invalid coordinates";

			return;
		}

		console.log("Searching for a route between points:", {
			start: { lat: startLat, lng: startLng },
			end: { lat: endLat, lng: endLng }
		});

		try {
			worker.value.postMessage({
				type: "find_route",
				data: {
					startLat,
					startLng,
					endLat,
					endLng
				}
			});
		} catch (error) {
			console.error("Error sending data to worker:", error);

			isLoadingRoute.value = false;
			routeLoadingMessage.value = "Error searching for route";
		}
	}

	// draw the route on the map
	const drawRoute = (path) => {
		console.log("Starting to draw the route:", path);

		if (!path || !path.geometry || !path.geometry.coordinates) {
			console.error("Invalid path data for drawing");
			return;
		}

		try {
			// remove existing route
			if (routeLayer.value) {
				routeLayer.value.remove();
			}

			// convert coordinates from [lng, lat] to [lat, lng] for leaflet
			const leafletPath = path.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

			// create a polyline
			routeLayer.value = L.polyline(leafletPath, {
				color: "#3388ff",
				weight: 5,
				opacity: 0.7
			}).addTo(map.value);

			console.log("Route successfully drawn");

			// get bounds before any map operations
			const bounds = routeLayer.value.getBounds();

			// make sure the map is ready and disable animations
			if (map.value) {
				const originalZoomAnimation = map.value.options.zoomAnimation;
				map.value.options.zoomAnimation = false;

				// fit bounds
				map.value.fitBounds(bounds, {
					padding: [50, 50],
					animate: false
				});

				// re-enable animations after a short delay
				setTimeout(() => {
					if (map.value) {
						map.value.options.zoomAnimation = originalZoomAnimation;
					}
				}, 100);
			}

			console.log("Map centered on route");

			// set route details
			route.value = {
				distance: path.properties.distance,
				time: path.properties.time
			}

			console.log("Route details:", route.value);
		} catch (error) {
			console.error("Error drawing route:", error);
		}
	}

	// add marker to the map
	const addMarker = (lat, lng, type) => {
		console.log("Adding marker:", { lat, lng, type });

		try {
			// remove existing marker of the same type
			if (type === "start" && startMarker.value) {
				map.value.removeLayer(startMarker.value);
			} else if (type === "end" && endMarker.value) {
				map.value.removeLayer(endMarker.value);
			}

			// create a new marker
			const marker = L.marker([lat, lng], {
				draggable: true,
				icon: L.divIcon({
					className: `marker ${type}`,
					html: type === "start" ? "A" : "B",
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				})
			});

			// add marker to the map
			marker.addTo(map.value);

			// add click handler for removal
			marker.on("click", () => {
				removeMarker(type);
			});

			// add dragend handler
			marker.on("dragend", (e) => {
				const newPos = e.target.getLatLng();
				const point = turf.point([newPos.lng, newPos.lat]);
				const center = turf.point([moscowCenter.lng, moscowCenter.lat]);
				const distance = turf.distance(point, center, { units: "kilometers" });

				if (distance > moscowRadius) {
					// return marker to previous position
					e.target.setLatLng([lat, lng]);

					roadsLoadingMessage.value = "The point is outside the allowed area";

					setTimeout(() => {
						roadsLoadingMessage.value = "";
					}, 3000);

					return;
				}

				if (type === "start") {
					startPoint.value = [newPos.lat, newPos.lng];
				} else {
					endPoint.value = [newPos.lat, newPos.lng];
				}

				// recalculate route on marker drag
				if (startPoint.value && endPoint.value) {
					findRoute();
				}
			});

			// save marker reference
			if (type === "start") {
				startMarker.value = marker;
			} else {
				endMarker.value = marker;
			}

			console.log("Marker successfully added");
		} catch (error) {
			console.error("Error adding marker:", error);
		}
	}

	// remove marker from map
	const removeMarker = (type) => {
		console.log("Removing marker:", type);

		if (type === "start") {
			if (startMarker.value) {
				map.value.removeLayer(startMarker.value);
				startMarker.value = null;
			}

			startPoint.value = null;
		} else if (type === "end") {
			if (endMarker.value) {
				map.value.removeLayer(endMarker.value);
				endMarker.value = null;
			}

			endPoint.value = null;
		}

		// clear route if one of the points is removed
		if (routeLayer.value) {
			routeLayer.value.remove();
			routeLayer.value = null;
		}

		route.value = null;
	}

	// clear the map
	const clearMap = () => {
		// remove markers
		if (startMarker.value) {
			map.value.removeLayer(startMarker.value);
			startMarker.value = null;
		}
		if (endMarker.value) {
			map.value.removeLayer(endMarker.value);
			endMarker.value = null;
		}

		// clear points
		startPoint.value = null;
		endPoint.value = null;

		// clear route
		if (routeLayer.value) {
			routeLayer.value.remove();
			routeLayer.value = null;
		}

		// clear route information
		route.value = null;

		console.log("Map cleared");
	}

	// format distance
	const formatDistance = (km) => {
		if (km < 1) {
			return `${Math.round(km * 1000)} m`;
		}

		return `${km.toFixed(1)} km`;
	}

	// format time
	const formatTime = (hours) => {
		const minutes = Math.round((hours - Math.floor(hours)) * 60);

		if (Math.floor(hours) === 0) {
			return `${minutes} min`;
		}

		return `${Math.floor(hours)} h ${minutes} min`;
	}
</script>

<template>
	<div ref="mapContainer" class="map-container"></div>

	<!-- sidebar with route information -->
	<div v-if="route" class="route-info">
		<div class="route-info__content">
			<h3>Route Information</h3>

			<div class="route-info__details">
				<div class="route-info__item">
					<span class="route-info__label">Distance:</span>
					<span class="route-info__value">{{ formatDistance(route.distance) }}</span>
				</div>

				<div class="route-info__item">
					<span class="route-info__label">Time in route:</span>
					<span class="route-info__value">{{ formatTime(route.time) }}</span>
				</div>
			</div>

			<button class="route-info__clear" @click="clearMap">Clear Route</button>
		</div>
	</div>

	<LoadingProgress
		:show="isLoadingRoads"
		:message="roadsLoadingMessage"
		:progress="roadsLoadingProgress"
	/>
	<LoadingProgress
		:show="isLoadingRoute"
		:message="routeLoadingMessage"
		:progress="routeLoadingProgress"
	/>
</template>

<style lang="scss" scoped>
	.map-container {
		width: 100%;
		height: 100vh;
	}

	.route-info {
		position: fixed;
		top: 20px;
		right: 20px;
		background: var(--white);
		border-radius: var(--border-radius);
		box-shadow: var(--shadow-lg);
		padding: 20px;
		z-index: 1000;
		min-width: 300px;

		&__content {
			h3 {
				margin: 0 0 15px;
				color: var(--text-primary);
				font-size: 18px;
			}
		}

		&__details {
			margin-bottom: 20px;
		}

		&__item {
			display: flex;
			justify-content: space-between;
			margin-bottom: 10px;
			padding: 8px 0;
			border-bottom: 1px solid var(--background-light);

			&:last-child {
				border-bottom: none;
				margin-bottom: 0;
			}
		}

		&__label {
			color: var(--text-secondary);
			font-size: 14px;
		}

		&__value {
			color: var(--text-primary);
			font-weight: 500;
			font-size: 14px;
		}

		&__clear {
			width: 100%;
			padding: 10px;
			background: var(--danger-color);
			color: white;
			border: none;
			border-radius: var(--border-radius);
			cursor: pointer;
			font-size: 14px;
			transition: opacity 0.2s;

			&:hover {
				opacity: 0.9;
			}
		}
	}

	@media screen and (max-width: 768px) {
		.route-info {
			left: 50% !important;
			bottom: 20px !important;
			top: auto !important;
			right: auto !important;
			transform: translateX(-50%);
			margin: 0 !important;
			min-width: unset !important;
			width: 90vw;
			max-width: 400px;
		}
	}
</style>