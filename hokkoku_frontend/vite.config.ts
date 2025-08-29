import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const rawApiUrl = process.env.VITE_API_URL || ""
let target = rawApiUrl || "http://localhost:8000"
let wsTarget = target.replace(/^http/, "ws")
let authHeader = ""

try {
  const m = rawApiUrl.match(/^https?:\/\/([^:]+):([^@]+)@(.+)$/)
  if (m) {
    const [, u, p, d] = m
    target = `https://${d}`
    wsTarget = `wss://${d}`
    authHeader = "Basic " + Buffer.from(`${u}:${p}`).toString("base64")
  }
} catch {}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target,
        changeOrigin: true,
        secure: false,
        ws: false,
        headers: authHeader ? { Authorization: authHeader } : undefined,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            if (authHeader) proxyReq.setHeader("Authorization", authHeader)
          })
        },
      },
      "/ws": {
        target: wsTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
        headers: authHeader ? { Authorization: authHeader } : undefined,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            if (authHeader) proxyReq.setHeader("Authorization", authHeader)
          })
          proxy.on("proxyReqWs", (proxyReq) => {
            if (authHeader) proxyReq.setHeader("Authorization", authHeader)
          })
        },
      },
    },
  },
})

