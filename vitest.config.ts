import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", "dist", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"],
    },
  },
  resolve: {
    alias: {
      "@mihirsarya/manim-scroll-runtime": path.resolve(__dirname, "runtime/src"),
      "@mihirsarya/manim-scroll-react": path.resolve(__dirname, "react/src"),
      "@mihirsarya/manim-scroll-next": path.resolve(__dirname, "next/src"),
    },
  },
});
