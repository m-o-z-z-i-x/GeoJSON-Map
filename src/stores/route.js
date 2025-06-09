import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useRouteStore = defineStore("route", () => {
	const startPoint = ref(null);
	const endPoint = ref(null);
	const route = ref(null);
	const isLoading = ref(false);
	const error = ref(null);

	function setStartPoint(point) {
		startPoint.value = point;
	}

	function setEndPoint(point) {
		endPoint.value = point;
	}

	function setRoute(newRoute) {
		route.value = newRoute;
	}

	function clearRoute() {
		startPoint.value = null;
		endPoint.value = null;
		route.value = null;
		error.value = null;
	}

	function setError(newError) {
		error.value = newError;
	}

	const hasRoute = computed(() => !!route.value);
	const isComplete = computed(() => !!startPoint.value && !!endPoint.value);

	return {
		startPoint,
		endPoint,
		route,
		isLoading,
		error,
		setStartPoint,
		setEndPoint,
		setRoute,
		clearRoute,
		setError,
		hasRoute,
		isComplete
	};
});