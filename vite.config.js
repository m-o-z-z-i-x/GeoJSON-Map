import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

import vue from "@vitejs/plugin-vue";

export default defineConfig({
	plugins: [
		vue(),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url))
		},
	},
	worker: {
		format: 'es',
		plugins: []
	},
	server: {
		headers: {
			'Content-Security-Policy': `
				default-src 'self';
				script-src 'self' 'unsafe-eval' 'unsafe-inline';
				style-src 'self' 'unsafe-inline';
				img-src 'self' data: blob: https://*.tile.openstreetmap.org;
				worker-src 'self' blob:;
				connect-src 'self' https://*.tile.openstreetmap.org;
				font-src 'self';
				object-src 'none';
				base-uri 'self';
				form-action 'self';
				frame-ancestors 'none';
				block-all-mixed-content;
				upgrade-insecure-requests;
			`.replace(/\s+/g, ' ').trim()
		}
	}
});