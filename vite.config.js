import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    base: "/react/",
    publicDir: false,
    server: {
        proxy: {
            "/api": "http://127.0.0.1:3000",
            "/frontend": "http://127.0.0.1:3000",
            "/backend": "http://127.0.0.1:3000"
        }
    }
});