import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "@/App.vue";
import "@/styles/main.scss";

// создание роутера
const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			component: () => import("@/views/MapView.vue")
		}
	]
});

// создание приложения
const app = createApp(App);

// использование роутера
app.use(router);

// монтирование приложения
app.mount("#app");