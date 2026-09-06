import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  changeOrigin: false,
  target: "http://localhost:3000",
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5299,
    proxy: { "/api": apiProxy },
    strictPort: true,
  },
  preview: {
    port: 5299,
    proxy: { "/api": apiProxy },
    strictPort: true,
  },
});
