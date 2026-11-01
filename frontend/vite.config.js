import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Compile modern syntax (optional chaining, ??, etc.) down so the site runs on older phones, back to about Chrome 64 / Safari 11 (2018).
  build: { target: ["es2018", "chrome64", "safari11", "firefox60", "edge79"], cssTarget: "chrome64" },
});
