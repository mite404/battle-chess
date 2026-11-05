import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: ["t-03h3eq6f8fy5awhaksf031dtu-p27682.onamp.dev"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ["three"], chess: ["chess.js"] },
      },
    },
  },
});
