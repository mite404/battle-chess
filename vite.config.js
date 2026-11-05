import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: ["t-03h6er8ektc0n2ycxq9hzo3cb-p20959.onamp.dev"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ["three"], chess: ["chess.js"] },
      },
    },
  },
});
