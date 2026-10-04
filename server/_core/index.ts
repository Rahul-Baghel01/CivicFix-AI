import "dotenv/config";
import { createServer } from "node:http";
import net from "node:net";
import { createApp, initializeDatabase } from "./app";
import { validateServerConfig } from "./env";
import { serveStatic } from "./static";

async function findAvailablePort(start: number) {
  for (let port = start; port < start + 20; port++) {
    const available = await new Promise<boolean>(resolve => {
      const candidate = net.createServer();
      candidate.once("error", () => resolve(false));
      candidate.listen(port, () => candidate.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No available port found starting from ${start}`);
}

async function startServer() {
  const config = validateServerConfig();
  await initializeDatabase();
  const app = createApp();
  const server = createServer(app);
  if (config.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else serveStatic(app);
  const port =
    config.NODE_ENV === "production"
      ? config.PORT
      : await findAvailablePort(config.PORT);
  server.listen(port, () =>
    console.log(`Server running on http://localhost:${port}/`)
  );
}

startServer().catch(error => {
  console.error("[CivicFix] Startup failed:", error.message);
  process.exitCode = 1;
});
