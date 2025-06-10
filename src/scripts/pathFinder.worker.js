// реализация воркера для поиска пути
import * as turf from "@turf/turf";

// глобальные переменные
let graph = null;
let areaCenter = null;
let areaRadius = null;

// класс графа для поиска пути
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

// реализация очереди с приоритетом
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

// вычисление расстояния между двумя точками
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // радиус земли в км
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// обработка данных о дорогах и создание графа
function processRoadData(roads) {
  const graph = new Graph();
  const totalFeatures = roads.features.length;
  let processedFeatures = 0;
  let totalNodes = 0;
  let totalEdges = 0;

  console.log("Обработка данных о дорогах, всего элементов:", totalFeatures);

  // сначала создаем все узлы
  for (const feature of roads.features) {
    if (feature.geometry.type === "LineString") {
      const coordinates = feature.geometry.coordinates;
      for (let i = 0; i < coordinates.length; i++) {
        // geojson использует [долгота, широта]
        const [lng, lat] = coordinates[i];
        // создаем id узла с точными координатами
        const nodeId = `${lat},${lng}`;
        if (!graph.nodes.has(nodeId)) {
          graph.addNode(nodeId, lat, lng);
          totalNodes++;
        }
      }
    }
  }

  console.log(`Создано ${totalNodes} узлов`);

  // затем создаем ребра
  for (const feature of roads.features) {
    if (feature.geometry.type === "LineString") {
      const coordinates = feature.geometry.coordinates;
      for (let i = 0; i < coordinates.length - 1; i++) {
        // geojson использует [долгота, широта]
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

  console.log(`Граф создан с ${totalNodes} узлами и ${totalEdges} рёбрами`);
  return graph;
}

// поиск ближайшего узла к точке
function findNearestNode(graph, lat, lng) {
  let minDist = Infinity;
  let nearestNode = null;
  const initialSearchRadius = 0.01; // ~1.1 км
  const maxSearchRadius = 0.05; // ~5.5 км
  let currentSearchRadius = initialSearchRadius;
  let closestNode = null;
  let closestNodeDistance = Infinity;
  let checkedNodes = 0;

  console.log("Поиск ближайшего узла к точке:", { lat, lng });
  console.log("Всего узлов в графе:", graph.nodes.size);

  // проверяем валидность входных координат
  if (typeof lat !== "number" || typeof lng !== "number" || 
    isNaN(lat) || isNaN(lng) || 
    lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.error("Некорректные координаты:", { lat, lng });
    return null;
  }

  // сначала проверяем точное совпадение
  const exactNodeId = `${lat},${lng}`;
  if (graph.nodes.has(exactNodeId)) {
    console.log("Найдено точное совпадение узла:", exactNodeId);
    return exactNodeId;
  }

  // если точного совпадения нет, ищем ближайший узел
  while (currentSearchRadius <= maxSearchRadius) {
    console.log(`Поиск с радиусом: ${currentSearchRadius} градусов (${Math.round(currentSearchRadius * 111)} км)`);
    
    for (const [nodeId, node] of graph.nodes) {
      checkedNodes++;
      const dist = calculateDistance(lat, lng, node.lat, node.lng);
      
      // обновляем информацию о ближайшем расстоянии
      if (dist < closestNodeDistance) {
        closestNodeDistance = dist;
        closestNode = { id: nodeId, coords: node, distance: dist };
      }
      
      // проверяем, находится ли узел в пределах текущего радиуса поиска
      if (dist < minDist && dist < currentSearchRadius) {
        minDist = dist;
        nearestNode = nodeId;
      }

      // логируем каждые 1000 проверенных узлов
      if (checkedNodes % 1000 === 0) {
        console.log("Прогресс:", {
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

    // если нашли узел в текущем радиусе, прекращаем поиск
    if (nearestNode) {
      break;
    }

    // увеличиваем радиус поиска
    currentSearchRadius *= 2;
  }

  // если не нашли узел в пределах максимального радиуса, используем самый близкий найденный узел
  if (!nearestNode && closestNode) {
    console.log("Используем ближайший узел вне радиуса поиска:", {
      nodeId: closestNode.id,
      distance: closestNode.distance,
      coordinates: closestNode.coords
    });
    return closestNode.id;
  }

  if (nearestNode) {
    const nodeCoords = graph.nodes.get(nearestNode);
    console.log("Найден ближайший узел:", {
      nodeId: nearestNode,
      distance: minDist,
      coordinates: nodeCoords,
      closestDistanceInGraph: closestNodeDistance,
      totalCheckedNodes: checkedNodes,
      inputCoordinates: { lat, lng },
      searchRadius: currentSearchRadius
    });
  } else {
    console.warn("Узел не найден в пределах максимального радиуса поиска:", {
      maxSearchRadius,
      closestDistanceInGraph: closestNodeDistance,
      totalCheckedNodes: checkedNodes,
      inputCoordinates: { lat, lng },
      closestNode: closestNode
    });
  }

  return nearestNode || (closestNode ? closestNode.id : null);
}

// алгоритм поиска пути a*
function findPath(graph, startNode, endNode) {
  console.log("Начало поиска пути:", {
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
  const MAX_ITERATIONS = 50000; // увеличиваем лимит итераций
  const MAX_DISTANCE = 50; // максимальное расстояние в километрах

  // проверяем, не слишком ли далеко точки друг от друга
  const directDistance = calculateDistance(
    graph.nodes.get(startNode).lat,
    graph.nodes.get(startNode).lng,
    graph.nodes.get(endNode).lat,
    graph.nodes.get(endNode).lng
  );

  if (directDistance > MAX_DISTANCE) {
    console.warn("Точки находятся слишком далеко друг от друга:", directDistance, "км");
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

    // проверяем расстояние до цели
    const currentDistance = calculateDistance(
      graph.nodes.get(current).lat,
      graph.nodes.get(current).lng,
      graph.nodes.get(endNode).lat,
      graph.nodes.get(endNode).lng
    );

    // если мы слишком далеко от цели, прекращаем поиск
    if (currentDistance > MAX_DISTANCE * 2) {
      console.warn("Поиск пути остановлен: слишком далеко от цели");
      return null;
    }

    if (processedNodes % 1000 === 0) {
      const progress = Math.min(95, Math.round((processedNodes / totalNodes) * 100));
      self.postMessage({
        type: "route_progress",
        progress: progress
      });
      console.log("Прогресс поиска пути:", {
        progress,
        processedNodes,
        openSetSize: openSet.values.length,
        closedSetSize: closedSet.size
      });
    }

    if (current === endNode) {
      console.log("Путь найден!", {
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
        
        // проверяем, есть ли уже этот узел в openSet
        const existingIndex = openSet.values.findIndex(item => item.val === neighbor);
        if (existingIndex === -1) {
          openSet.enqueue(neighbor, fScore.get(neighbor));
        }
      }
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.warn("Поиск пути остановлен из-за достижения максимального количества итераций");
  } else {
    console.warn("Путь между узлами не найден");
  }

  return null;
}

// восстановление пути из карты camefrom
function reconstructPath(cameFrom, current) {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.unshift(current);
  }
  return path;
}

// вычисление деталей маршрута
function calculateRouteDetails(graph, path) {
  let distance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    distance += graph.getEdgeWeight(path[i], path[i + 1]);
  }
  const time = distance / 5;
  return { distance, time };
}

// функция для проверки, находится ли точка в пределах области
function isPointInArea(point) {
  if (!areaCenter || !areaRadius) return true; // если область не задана, считаем что точка в пределах
  
  const center = turf.point([areaCenter.lng, areaCenter.lat]);
  const distance = turf.distance(point, center, { units: "kilometers" });
  
  return distance <= areaRadius;
}

// обработка сообщений от основного потока
self.onmessage = async (event) => {
  try {
    const { type, data } = event.data;
    console.log("Полученное сообщение:", { type, data });

    switch (type) {
      case "init":
        console.log("Инициализация поисковика пути с данными о дорогах");
        graph = processRoadData(data.roads);
        self.postMessage({ type: "init_complete" });
        break;

      case "set_area":
        console.log("Установка параметров области:", data);
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
          throw new Error("Граф не инициализирован. Пожалуйста, сначала загрузите данные о дорогах.");
        }

        console.log("Поиск маршрута с данными:", data);
        const { startLat, startLng, endLat, endLng } = data;

        // проверяем валидность входных координат
        if (!startLat || !startLng || !endLat || !endLng) {
          throw new Error("Начальная или конечная точка находится вне разрешенной области");
        }

        // проверяем, находятся ли точки в пределах заданной области
        if (areaCenter && areaRadius) {
          const startPoint = turf.point([startLng, startLat]);
          const endPoint = turf.point([endLng, endLat]);
          const centerPoint = turf.point([areaCenter.lng, areaCenter.lat]);
          
          const startDistance = turf.distance(startPoint, centerPoint, { units: "kilometers" });
          const endDistance = turf.distance(endPoint, centerPoint, { units: "kilometers" });
          
          if (startDistance > areaRadius || endDistance > areaRadius) {
            throw new Error("Начальная или конечная точка находится вне разрешенной области");
          }
        }

        console.log("Поиск ближайших узлов...");
        const startNode = findNearestNode(graph, startLat, startLng);
        console.log("Найден начальный узел:", startNode);

        const endNode = findNearestNode(graph, endLat, endLng);
        console.log("Найден конечный узел:", endNode);

        if (!startNode || !endNode) {
          throw new Error("Не удалось найти ближайшие узлы для начальной или конечной точки");
        }

        console.log("Поиск пути между узлами:", { 
          startNode,
          endNode,
          startCoords: graph.nodes.get(startNode),
          endCoords: graph.nodes.get(endNode)
        });

        const path = findPath(graph, startNode, endNode);

        if (!path) {
          throw new Error("Путь между точками не найден");
        }

        const routeDetails = calculateRouteDetails(graph, path);
        
        // преобразуем путь в GeoJSON формат
        const coordinates = path.map(nodeId => {
          const node = graph.nodes.get(nodeId);
          // GeoJSON использует [долгота, широта]
          return [node.lng, node.lat];
        });

        const routeGeoJSON = {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coordinates
          },
          properties: routeDetails
        };

        console.log("Маршрут найден:", { 
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
        console.warn("Неизвестный тип сообщения:", type);
    }
  } catch (error) {
    console.error("Ошибка в поисковике пути:", error);
    self.postMessage({
      type: "error",
      error: error.message
    });
  }
};