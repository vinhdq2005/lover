import { build, createServer, preview } from "vite";
import { resolve } from "node:path";
import setupDisposable from "../integration/global-setup";
import { disposableRoot, disposableStatus } from "../helpers/disposableStack";
import { contentSecurityPolicy } from "../../scripts/write-hosting-headers";
export default async function setup() {
  process.env.LOVER_TEST_WORKDIR = disposableRoot;
  process.env.LOVER_TEST_APP_ORIGIN = "http://127.0.0.1:5175";
  const release = await setupDisposable();
  const status = disposableStatus();
  if (process.env.LOVER_E2E_PRODUCTION === "1") {
    const outDir = resolve(disposableRoot, "browser-dist");
    if (
      !outDir.startsWith(disposableRoot + "\\") &&
      !outDir.startsWith(disposableRoot + "/")
    ) throw new Error("DISPOSABLE_BUILD_PATH_REQUIRED");
    await build({
      configFile: resolve("vite.config.ts"),
      envDir: false,
      define: {
        "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(status.API_URL),
        "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
          status.PUBLISHABLE_KEY,
        ),
      },
      build: { outDir, emptyOutDir: true, sourcemap: false },
    });
    const production = await preview({
      configFile: resolve("vite.config.ts"),
      build: { outDir },
      preview: { host: "127.0.0.1", port: 5175, strictPort: true, headers:{"Content-Security-Policy":contentSecurityPolicy(status.API_URL)} },
    });
    return async () => {
      await new Promise<void>((resolve, reject) =>
        production.httpServer.close((error) =>
          error ? reject(error) : resolve()
        )
      );
      release();
    };
  }
  const server = await createServer({
    configFile: resolve("vite.config.ts"),
    envDir: false,
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(status.API_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        status.PUBLISHABLE_KEY,
      ),
    },
    server: {
      host: "127.0.0.1",
      port: 5175,
      strictPort: true,
      hmr: false,
      watch: null,
    },
  });
  try {
    await server.listen();
    return async () => {
      await server.close();
      release();
    };
  } catch (error) {
    await server.close();
    release();
    throw error;
  }
}
