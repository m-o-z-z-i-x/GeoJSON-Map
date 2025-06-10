<script setup>
	import { ref, onMounted, onUnmounted } from "vue";
	import L from "leaflet";
	import "leaflet/dist/leaflet.css";
	import * as turf from "@turf/turf";
	import convexHull from "@turf/convex";
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

	// состояние загрузки дорог
	const isLoadingRoads = ref(false);
	const roadsLoadingMessage = ref("");
	const roadsLoadingProgress = ref(0);

	// состояние загрузки маршрута
	const isLoadingRoute = ref(false);
	const routeLoadingMessage = ref("");
	const routeLoadingProgress = ref(0);

	// центр москвы и радиус в километрах
	const moscowCenter = {
		lat: 55.7558,
		lng: 37.6173
	};
	const moscowRadius = 15; // 15 км от центра

	// инициализация карты
	onMounted(() => {
		console.log("Инициализация карты...");
		console.log("Контейнер карты:", mapContainer.value);

		if (!mapContainer.value) {
			console.error("Контейнер карты не найден!");
			return;
		}

		map.value = L.map(mapContainer.value).setView([moscowCenter.lat, moscowCenter.lng], 11);
		console.log("Карта создана");

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: "© OpenStreetMap contributors"
		}).addTo(map.value);
		console.log("Базовый слой добавлен");

		// добавляем круг, показывающий границы области
		boundaryLayer.value = L.circle([moscowCenter.lat, moscowCenter.lng], {
			radius: moscowRadius * 1000, // конвертируем км в метры
			color: "#3388ff",
			fillColor: "#3388ff",
			fillOpacity: 0.1,
			weight: 2
		}).addTo(map.value);

		// инициализация воркера
		try {
			worker.value = new Worker(new URL("../scripts/pathFinder.worker.js", import.meta.url), {
				type: "module"
			});
			worker.value.onmessage = handleWorkerMessage;
			console.log("Web Worker инициализирован");

			// отправляем параметры области в воркер
			worker.value.postMessage({
				type: "set_area",
				data: {
					center: moscowCenter,
					radius: moscowRadius
				}
			});

			// загрузка данных о дорогах
			loadRoadData();
		} catch (error) {
			console.error("Ошибка при инициализации Web Worker:", error);
			isLoadingRoads.value = false;
			roadsLoadingMessage.value = "Ошибка инициализации";
		}

		// добавляем обработчик кликов для установки точек
		map.value.on("click", handleMapClick);
		console.log("Обработчик кликов добавлен");

		// добавляем обработчик изменения размера
		const handleResize = () => {
			isMobile.value = window.innerWidth <= 768;
			if (map.value) {
				map.value.invalidateSize();
			}
		};
		window.addEventListener("resize", handleResize);
		console.log("Обработчик изменения размера добавлен");
	});

	// очистка
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

	// функция для определения границ области на основе данных о дорогах
	const calculateAreaBoundary = (roads) => {
		if (!roads || !roads.features || !roads.features.length) {
			return null;
		}

		// создаем массив всех координат из дорог
		const allCoordinates = roads.features.flatMap(feature => {
			if (feature.geometry.type === "LineString") {
				return feature.geometry.coordinates;
			} else if (feature.geometry.type === "MultiLineString") {
				return feature.geometry.coordinates.flat();
			}
			return [];
		});

		if (allCoordinates.length === 0) {
			return null;
		}

		// создаем выпуклую оболочку из всех координат
		const points = turf.points(allCoordinates);
		const convexHullPolygon = convexHull(points);

		return convexHullPolygon;
	};

	// обработка сообщений от воркера
	const handleWorkerMessage = (event) => {
		const { type, path, error, roads, progress, center, radius } = event.data;
		console.log("Получено сообщение от воркера:", type, event.data);

		if (error) {
			console.error("Ошибка от воркера:", error);
			isLoadingRoads.value = false;
			isLoadingRoute.value = false;
			
			// показываем понятное сообщение для ошибки "путь не найден"
			if (error === "No path found between points") {
				routeLoadingMessage.value = "Не удалось найти путь между выбранными точками. Попробуйте выбрать другие точки.";
			} else {
				roadsLoadingMessage.value = `Ошибка: ${error}`;
				routeLoadingMessage.value = `Ошибка: ${error}`;
			}
			
			setTimeout(() => {
				roadsLoadingMessage.value = "";
				routeLoadingMessage.value = "";
			}, 5000); // увеличенный таймаут до 5 секунд для лучшей читаемости
			return;
		}

		switch (type) {
			case "init_complete":
				console.log("Инициализация воркера завершена");
				isLoadingRoads.value = false;
				roadsLoadingProgress.value = 0;
				roadsLoadingMessage.value = "";
				break;

			case "area_set":
				console.log("Параметры области установлены:", { center, radius });
				break;

			case "roads_loaded":
				roadData.value = roads;
				// даем время на отображение 100% прогресса
				setTimeout(() => {
					isLoadingRoads.value = false;
					roadsLoadingProgress.value = 0;
					roadsLoadingMessage.value = "";
				}, 1000);
				break;

			case "roads_progress":
				roadsLoadingProgress.value = progress;
				roadsLoadingMessage.value = `Загрузка данных о дорогах: ${Math.round(progress)}%`;
				break;

			case "route_progress":
				routeLoadingProgress.value = progress;
				routeLoadingMessage.value = `Поиск кратчайшего маршрута: ${Math.round(progress)}%`;
				break;

			case "route_found":
				if (path) {
					drawRoute(path);
				}
				// даем время на отображение 100% прогресса перед закрытием
				setTimeout(() => {
					isLoadingRoute.value = false;
					routeLoadingProgress.value = 0;
					routeLoadingMessage.value = "";
				}, 1000);
				break;

			default:
				console.warn("Неизвестный тип сообщения:", type);
		}
	};

	// загрузка данных о дорогах
	const loadRoadData = async () => {
		try {
			console.log("Начинаем загрузку данных дорог");
			isLoadingRoads.value = true;
			roadsLoadingProgress.value = 0;
			roadsLoadingMessage.value = "Загрузка данных о дорогах...";

			const response = await fetch("/data/roads.geojson");
			if (!response.ok) {
				throw new Error(`Ошибка HTTP! статус: ${response.status}`);
			}
			const data = await response.json();
			console.log("Данные дорог загружены:", data);

			if (!data || !data.features || !Array.isArray(data.features)) {
				throw new Error("Некорректный формат данных о дорогах");
			}

			// отправка данных воркеру
			sendDataToWorker(data);
		} catch (error) {
			console.error("Ошибка при загрузке данных дорог:", error);
			isLoadingRoads.value = false;
			roadsLoadingMessage.value = `Ошибка: ${error.message}`;
			setTimeout(() => {
				roadsLoadingMessage.value = "";
			}, 3000);
		}
	};

	// отправка данных воркеру
	const sendDataToWorker = (data) => {
		worker.value.postMessage({
			type: "init",
			data: {
				roads: data
			}
		});
		console.log("Данные отправлены в worker");
	};

	// функция для добавления точки на карту
	const addPoint = (lat, lng) => {
		// если нет начальной точки, добавляем её
		if (!startPoint.value) {
			startPoint.value = [lat, lng];
			addMarker(lat, lng, "start");
		}
		// если есть начальная точка, но нет конечной, добавляем конечную
		else if (!endPoint.value) {
			endPoint.value = [lat, lng];
			addMarker(lat, lng, "end");
			// автоматически ищем маршрут после установки обеих точек
			findRoute();
		}
		// если обе точки уже установлены, заменяем конечную
		else {
			endPoint.value = [lat, lng];
			addMarker(lat, lng, "end");
			// пересчитываем маршрут
			findRoute();
		}
	};

	// обработка клика по карте
	const handleMapClick = (e) => {
		const { lat, lng } = e.latlng;
		console.log("Клик по карте:", { lat, lng });

		// проверяем, находится ли точка в пределах области
		const point = turf.point([lng, lat]);
		const center = turf.point([moscowCenter.lng, moscowCenter.lat]);
		const distance = turf.distance(point, center, { units: "kilometers" });

		if (distance > moscowRadius) {
			roadsLoadingMessage.value = "Точка находится за пределами допустимой области";
			setTimeout(() => {
				roadsLoadingMessage.value = "";
			}, 3000);
			return;
		}

		// если есть маршрут, очищаем его при клике на карту
		if (route.value) {
			clearMap();
		}

		// добавляем новую точку
		addPoint(lat, lng);
	};

	// функция для поиска маршрута
	const findRoute = async () => {
		if (!startPoint.value || !endPoint.value) {
			console.error("Не выбраны начальная или конечная точка");
			return;
		}

		isLoadingRoute.value = true;
		routeLoadingProgress.value = 0;
		routeLoadingMessage.value = "Поиск кратчайшего маршрута: 0%";

		// преобразуем координаты в числа и проверяем их валидность
		const startLat = parseFloat(startPoint.value[0]);
		const startLng = parseFloat(startPoint.value[1]);
		const endLat = parseFloat(endPoint.value[0]);
		const endLng = parseFloat(endPoint.value[1]);

		if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
			console.error("Некорректные координаты:", { startPoint: startPoint.value, endPoint: endPoint.value });
			isLoadingRoute.value = false;
			routeLoadingMessage.value = "Ошибка: некорректные координаты";
			return;
		}

		console.log("Поиск маршрута между точками:", {
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
			console.error("Ошибка при отправке данных в воркер:", error);
			isLoadingRoute.value = false;
			routeLoadingMessage.value = "Ошибка при поиске маршрута";
		}
	};

	// отрисовка маршрута на карте
	const drawRoute = (path) => {
		console.log("Начинаем отрисовку маршрута:", path);
		if (!path || !path.geometry || !path.geometry.coordinates) {
			console.error("Некорректные данные пути для отрисовки");
			return;
		}

		try {
			// удаляем существующий маршрут
			if (routeLayer.value) {
				routeLayer.value.remove();
			}

			// меняем координаты с [долгота, широта] на [широта, долгота] для leaflet
			const leafletPath = path.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

			// создаем полилинию
			routeLayer.value = L.polyline(leafletPath, {
				color: "#3388ff",
				weight: 5,
				opacity: 0.7
			}).addTo(map.value);
			console.log("Маршрут успешно отрисован");

			// получаем границы перед любыми операциями с картой
			const bounds = routeLayer.value.getBounds();

			// убеждаемся, что карта готова и отключаем анимации
			if (map.value) {
				const originalZoomAnimation = map.value.options.zoomAnimation;
				map.value.options.zoomAnimation = false;

				// подгоняем границы
				map.value.fitBounds(bounds, {
					padding: [50, 50],
					animate: false
				});

				// включаем анимации обратно после небольшой задержки
				setTimeout(() => {
					if (map.value) {
						map.value.options.zoomAnimation = originalZoomAnimation;
					}
				}, 100);
			}

			console.log("Карта отцентрирована по маршруту");

			// устанавливаем детали маршрута
			route.value = {
				distance: path.properties.distance,
				time: path.properties.time
			};
			console.log("Детали маршрута:", route.value);
		} catch (error) {
			console.error("Ошибка при отрисовке маршрута:", error);
		}
	};

	// добавляем маркер на карту
	const addMarker = (lat, lng, type) => {
		console.log("Добавление маркера:", { lat, lng, type });
		try {
			// удаляем существующий маркер того же типа
			if (type === "start" && startMarker.value) {
				map.value.removeLayer(startMarker.value);
			} else if (type === "end" && endMarker.value) {
				map.value.removeLayer(endMarker.value);
			}

			// создаем новый маркер
			const marker = L.marker([lat, lng], {
				draggable: true,
				icon: L.divIcon({
					className: `marker ${type}`,
					html: type === "start" ? "A" : "B",
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				})
			});

			// добавляем маркер на карту
			marker.addTo(map.value);

			// добавляем обработчик клика для удаления
			marker.on("click", () => {
				removeMarker(type);
			});

			// добавляем обработчик окончания перетаскивания
			marker.on("dragend", (e) => {
				const newPos = e.target.getLatLng();
				const point = turf.point([newPos.lng, newPos.lat]);
				const center = turf.point([moscowCenter.lng, moscowCenter.lat]);
				const distance = turf.distance(point, center, { units: "kilometers" });

				if (distance > moscowRadius) {
					// возвращаем маркер на предыдущую позицию
					e.target.setLatLng([lat, lng]);

					roadsLoadingMessage.value = "Точка находится за пределами допустимой области";

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

				// пересчитываем маршрут при перетаскивании маркера
				if (startPoint.value && endPoint.value) {
					findRoute();
				}
			});

			// сохраняем ссылку на маркер
			if (type === "start") {
				startMarker.value = marker;
			} else {
				endMarker.value = marker;
			}

			console.log("Маркер успешно добавлен");
		} catch (error) {
			console.error("Ошибка при добавлении маркера:", error);
		}
	};

	// удаляем маркер с карты
	const removeMarker = (type) => {
		console.log("Удаление маркера:", type);

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

		// очищаем маршрут, если одна из точек удалена
		if (routeLayer.value) {
			routeLayer.value.remove();
			routeLayer.value = null;
		}

		route.value = null;
	};

	// очищаем карту
	const clearMap = () => {
		// удаляем маркеры
		if (startMarker.value) {
			map.value.removeLayer(startMarker.value);
			startMarker.value = null;
		}
		if (endMarker.value) {
			map.value.removeLayer(endMarker.value);
			endMarker.value = null;
		}
		
		// очищаем точки
		startPoint.value = null;
		endPoint.value = null;
		
		// очищаем маршрут
		if (routeLayer.value) {
			routeLayer.value.remove();
			routeLayer.value = null;
		}
		
		// очищаем информацию о маршруте
		route.value = null;
		
		console.log("Карта очищена");
	};

	// форматирование расстояния
	const formatDistance = (km) => {
		if (km < 1) {
			return `${Math.round(km * 1000)} м`;
		}

		return `${km.toFixed(1)} км`;
	};

	// форматирование времени
	const formatTime = (hours) => {
		const minutes = Math.round((hours - Math.floor(hours)) * 60);

		if (Math.floor(hours) === 0) {
			return `${minutes} мин`;
		}

		return `${Math.floor(hours)} ч ${minutes} мин`;
	};
</script>

<template>
	<div ref="mapContainer" class="map-container"></div>

	<!-- сайдбар с информацией о маршруте -->
	<div v-if="route" class="route-info">
		<div class="route-info__content">
			<h3>Информация о маршруте</h3>

			<div class="route-info__details">
				<div class="route-info__item">
					<span class="route-info__label">Расстояние:</span>
					<span class="route-info__value">{{ formatDistance(route.distance) }}</span>
				</div>

				<div class="route-info__item">
					<span class="route-info__label">Время в пути:</span>
					<span class="route-info__value">{{ formatTime(route.time) }}</span>
				</div>
			</div>

			<button class="route-info__clear" @click="clearMap">Очистить маршрут</button>
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
</style>