import * as turf from "@turf/turf";

// global variables
let graph = null;
let areaCenter = null;
let areaRadius = null;

// graph class for path finding
class Graph {
	constructor() {
		this.nodes = new Map();
		this.edges = new Map();
	}

	addNode(id, lat, lng) {
		this.nodes.set(id, { lat, lng });

		if (!this.edges.has(id)) {
			this.edges.set(id, new Map());
		}
	}

	addEdge(from, to, weight) {
		if (!this.edges.has(from)) {
			this.edges.set(from, new Map());
		}
		if (!this.edges.has(to)) {
			this.edges.set(to, new Map());
		}

		this.edges.get(from).set(to, weight);
		this.edges.get(to).set(from, weight);
	}

	getNeighbors(node) {
		return Array.from(this.edges.get(node)?.keys() || []);
	}

	getEdgeWeight(from, to) {
		return this.edges.get(from)?.get(to) || Infinity;
	}
}

// priority queue implementation
class PriorityQueue {
	constructor() {
		this.values = [];
	}

	enqueue(val, priority) {
		this.values.push({ val, priority });
		this.sort();
	}

	dequeue() {
		return this.values.shift();
	}

	sort() {
		this.values.sort((a, b) => a.priority - b.priority);
	}

	isEmpty() {
		return this.values.length === 0;
	}
}

// calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
	const R = 6371; // radius of the earth in km
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
		Math.sin(dLng/2) * Math.sin(dLng/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	return R * c;
}

// process road data and create graph
function processRoadData(roads) {
	const graph = new Graph();
	const totalFeatures = roads.features.length;
	let processedFeatures = 0;
	let totalNodes = 0;
	let totalEdges = 0;

	console.log("Processing road data, total features:", totalFeatures);

	// first create all nodes
	for (const feature of roads.features) {
		if (feature.geometry.type === "LineString") {
			const coordinates = feature.geometry.coordinates;

			for (let i = 0; i < coordinates.length; i++) {
				// geojson uses [lng, lat]
				const [lng, lat] = coordinates[i];
				// create node id with exact coordinates
				const nodeId = `${lat},${lng}`;

				if (!graph.nodes.has(nodeId)) {
					graph.addNode(nodeId, lat, lng);
					totalNodes++;
				}
			}
		}
	}

	console.log(`Created ${totalNodes} nodes`);

	// then create edges
	for (const feature of roads.features) {
		if (feature.geometry.type === "LineString") {
			const coordinates = feature.geometry.coordinates;

			for (let i = 0; i < coordinates.length - 1; i++) {
				// geojson uses [lng, lat]
				const [lng1, lat1] = coordinates[i];
				const [lng2, lat2] = coordinates[i + 1];

				const node1Id = `${lat1},${lng1}`;
				const node2Id = `${lat2},${lng2}`;

				const weight = calculateDistance(lat1, lng1, lat2, lng2);

				graph.addEdge(node1Id, node2Id, weight);
				totalEdges++;
			}
		}

		processedFeatures++;

		if (processedFeatures % 100 === 0 || processedFeatures === totalFeatures) {
			const progress = Math.round((processedFeatures / totalFeatures) * 100);

			self.postMessage({
				type: "roads_progress",
				progress
			});
		}
	}

	console.log(`Graph created with ${totalNodes} nodes and ${totalEdges} edges`);
	return graph;
}

// search for nearest node to point
function findNearestNode(graph, lat, lng) {
	let minDist = Infinity;
	let nearestNode = null;
	const initialSearchRadius = 0.01; // ~1.1 km
	const maxSearchRadius = 0.05; // ~5.5 km
	let currentSearchRadius = initialSearchRadius;
	let closestNode = null;
	let closestNodeDistance = Infinity;
	let checkedNodes = 0;

	console.log("Searching for nearest node to point:", { lat, lng });
	console.log("Total nodes in graph:", graph.nodes.size);

	// check validity of input coordinates
	if (typeof lat !== "number" || typeof lng !== "number" || 
		isNaN(lat) || isNaN(lng) || 
		lat < -90 || lat > 90 || lng < -180 || lng > 180) {
		console.error("Invalid coordinates:", { lat, lng });
		return null;
	}

	// first check exact match
	const exactNodeId = `${lat},${lng}`;

	if (graph.nodes.has(exactNodeId)) {
		console.log("Exact node match found:", exactNodeId);
		return exactNodeId;
	}

	// if exact match is not found, search for nearest node
	while (currentSearchRadius <= maxSearchRadius) {
		console.log(`Searching with radius: ${currentSearchRadius} degrees (${Math.round(currentSearchRadius * 111)} km)`);
		
		for (const [nodeId, node] of graph.nodes) {
			checkedNodes++;
			const dist = calculateDistance(lat, lng, node.lat, node.lng);
			
			// update information about closest distance
			if (dist < closestNodeDistance) {
				closestNodeDistance = dist;
				closestNode = { id: nodeId, coords: node, distance: dist }
			}
			
			// check if node is within current search radius
			if (dist < minDist && dist < currentSearchRadius) {
				minDist = dist;
				nearestNode = nodeId;
			}

			// log every 1000 checked nodes
			if (checkedNodes % 1000 === 0) {
				console.log("Progress:", {
					checkedNodes,
					closestDistance: closestNodeDistance,
					minDist,
					currentSearchRadius,
					currentBestNode: nearestNode ? {
						id: nearestNode,
						coords: graph.nodes.get(nearestNode),
						distance: minDist
					} : null
				});
			}
		}

		// if found node in current radius, stop search
		if (nearestNode) {
			break;
		}

		// increase search radius
		currentSearchRadius *= 2;
	}

	// if no node found within max radius, use closest found node
	if (!nearestNode && closestNode) {
		console.log("Using closest node outside search radius:", {
			nodeId: closestNode.id,
			distance: closestNode.distance,
			coordinates: closestNode.coords
		});
		return closestNode.id;
	}

	if (nearestNode) {
		const nodeCoords = graph.nodes.get(nearestNode);

		console.log("Nearest node found:", {
			nodeId: nearestNode,
			distance: minDist,
			coordinates: nodeCoords,
			closestDistanceInGraph: closestNodeDistance,
			totalCheckedNodes: checkedNodes,
			inputCoordinates: { lat, lng },
			searchRadius: currentSearchRadius
		});
	} else {
		console.warn("Node not found within max search radius:", {
			maxSearchRadius,
			closestDistanceInGraph: closestNodeDistance,
			totalCheckedNodes: checkedNodes,
			inputCoordinates: { lat, lng },
			closestNode: closestNode
		});
	}

	return nearestNode || (closestNode ? closestNode.id : null);
}

// a* path finding algorithm
function findPath(graph, startNode, endNode) {
	console.log("Path search started:", {
		startNode,
		endNode,
		startCoords: graph.nodes.get(startNode),
		endCoords: graph.nodes.get(endNode)
	});

	const openSet = new PriorityQueue();
	const closedSet = new Set();
	const cameFrom = new Map();
	const gScore = new Map();
	const fScore = new Map();
	let totalNodes = graph.nodes.size;
	let processedNodes = 0;
	let iterations = 0;
	const MAX_ITERATIONS = 50000; // increase iteration limit
	const MAX_DISTANCE = 50; // max distance in kilometers

	// check if points are too far from each other
	const directDistance = calculateDistance(
		graph.nodes.get(startNode).lat,
		graph.nodes.get(startNode).lng,
		graph.nodes.get(endNode).lat,
		graph.nodes.get(endNode).lng
	);

	if (directDistance > MAX_DISTANCE) {
		console.warn("Points are too far from each other:", directDistance, "km");
		return null;
	}

	for (const nodeId of graph.nodes.keys()) {
		gScore.set(nodeId, Infinity);
		fScore.set(nodeId, Infinity);
	}

	gScore.set(startNode, 0);
	fScore.set(startNode, calculateDistance(
		graph.nodes.get(startNode).lat,
		graph.nodes.get(startNode).lng,
		graph.nodes.get(endNode).lat,
		graph.nodes.get(endNode).lng
	));

	openSet.enqueue(startNode, fScore.get(startNode));

	while (!openSet.isEmpty() && iterations < MAX_ITERATIONS) {
		iterations++;
		const current = openSet.dequeue().val;
		processedNodes++;

		// check distance to goal
		const currentDistance = calculateDistance(
			graph.nodes.get(current).lat,
			graph.nodes.get(current).lng,
			graph.nodes.get(endNode).lat,
			graph.nodes.get(endNode).lng
		);

		// if we are too far from the goal, stop search
		if (currentDistance > MAX_DISTANCE * 2) {
			console.warn("Path search stopped: too far from goal");
			return null;
		}

		if (processedNodes % 1000 === 0) {
			const progress = Math.min(95, Math.round((processedNodes / totalNodes) * 100));

			self.postMessage({
				type: "route_progress",
				progress: progress
			});
			console.log("Path search progress:", {
				progress,
				processedNodes,
				openSetSize: openSet.values.length,
				closedSetSize: closedSet.size
			});
		}

		if (current === endNode) {
			console.log("Path found!", {
				iterations,
				processedNodes,
				pathLength: reconstructPath(cameFrom, current).length
			});
			self.postMessage({
				type: "route_progress",
				progress: 100
			});
			return reconstructPath(cameFrom, current);
		}

		closedSet.add(current);

		for (const neighbor of graph.getNeighbors(current)) {
			if (closedSet.has(neighbor)) continue;

			const tentativeGScore = gScore.get(current) + 
				graph.getEdgeWeight(current, neighbor);

			if (tentativeGScore < gScore.get(neighbor)) {
				cameFrom.set(neighbor, current);
				gScore.set(neighbor, tentativeGScore);
				
				const hScore = calculateDistance(
					graph.nodes.get(neighbor).lat,
					graph.nodes.get(neighbor).lng,
					graph.nodes.get(endNode).lat,
					graph.nodes.get(endNode).lng
				);
				
				fScore.set(neighbor, tentativeGScore + hScore);
				
				// check if already this node in openSet
				const existingIndex = openSet.values.findIndex(item => item.val === neighbor);
				if (existingIndex === -1) {
					openSet.enqueue(neighbor, fScore.get(neighbor));
				}
			}
		}
	}

	if (iterations >= MAX_ITERATIONS) {
		console.warn("Path search stopped due to reaching max iterations");
	} else {
		console.warn("Path between nodes not found");
	}

	return null;
}

// restore path from cameFrom map
function reconstructPath(cameFrom, current) {
	const path = [current];

	while (cameFrom.has(current)) {
		current = cameFrom.get(current);
		path.unshift(current);
	}

	return path;
}

// calculate route details
function calculateRouteDetails(graph, path) {
	let distance = 0;

	for (let i = 0; i < path.length - 1; i++) {
		distance += graph.getEdgeWeight(path[i], path[i + 1]);
	}

	const time = distance / 5;

	return { distance, time }
}

// handle messages from main thread
self.onmessage = async (event) => {
	try {
		const { type, data } = event.data;

		console.log("Received message:", { type, data });

		switch (type) {
			case "init":
				console.log("Initializing path finder with road data");

				graph = processRoadData(data.roads);
				self.postMessage({ type: "init_complete" });

				break;

			case "set_area":
				console.log("Setting area parameters:", data);

				areaCenter = data.center;
				areaRadius = data.radius;

				self.postMessage({ 
					type: "area_set",
					center: areaCenter,
					radius: areaRadius
				});

				break;

			case "find_route":
				if (!graph) {
					throw new Error("Graph is not initialized. Please load road data first.");
				}

				console.log("Searching for route with data:", data);

				const { startLat, startLng, endLat, endLng } = data;

				// check validity of input coordinates
				if (!startLat || !startLng || !endLat || !endLng) {
					throw new Error("Start or end point is outside the allowed area");
				}

				// check if points are within given area
				if (areaCenter && areaRadius) {
					const startPoint = turf.point([startLng, startLat]);
					const endPoint = turf.point([endLng, endLat]);
					const centerPoint = turf.point([areaCenter.lng, areaCenter.lat]);

					const startDistance = turf.distance(startPoint, centerPoint, { units: "kilometers" });
					const endDistance = turf.distance(endPoint, centerPoint, { units: "kilometers" });

					if (startDistance > areaRadius || endDistance > areaRadius) {
						throw new Error("Start or end point is outside the allowed area");
					}
				}

				console.log("Searching for nearest nodes...");

				const startNode = findNearestNode(graph, startLat, startLng);

				console.log("Start node found:", startNode);

				const endNode = findNearestNode(graph, endLat, endLng);

				console.log("End node found:", endNode);

				if (!startNode || !endNode) {
					throw new Error("Could not find nearest nodes for start or end point");
				}

				console.log("Searching for path between nodes:", { 
					startNode,
					endNode,
					startCoords: graph.nodes.get(startNode),
					endCoords: graph.nodes.get(endNode)
				});

				const path = findPath(graph, startNode, endNode);

				if (!path) {
					throw new Error("Path between points not found");
				}

				const routeDetails = calculateRouteDetails(graph, path);

				// convert path to GeoJSON format
				const coordinates = path.map(nodeId => {
					const node = graph.nodes.get(nodeId);
					// GeoJSON uses [lng, lat]
					return [node.lng, node.lat];
				});

				const routeGeoJSON = {
					type: "Feature",
					geometry: {
						type: "LineString",
						coordinates: coordinates
					},
					properties: routeDetails
				}

				console.log("Route found:", { 
					path,
					routeDetails,
					startPoint: coordinates[0],
					endPoint: coordinates[coordinates.length - 1]
				});

				self.postMessage({
					type: "route_found",
					path: routeGeoJSON,
					details: routeDetails
				});

				break;

			default:
				console.warn("Unknown message type:", type);
		}
	} catch (error) {
		console.error("Path finder error:", error);
		self.postMessage({
			type: "error",
			error: error.message
		});
	}
}