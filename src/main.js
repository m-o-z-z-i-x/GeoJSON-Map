import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "@/App.vue";
import "@/styles/main.scss";

// router creation
const router = createRouter({
	history: createWebHistory(),
	routes: [
		{
			path: "/",
			component: () => import("@/views/MapView.vue")
		}
	]
});

// app creation
const app = createApp(App);

// use router
app.use(router);

// mount app
app.mount("#app");