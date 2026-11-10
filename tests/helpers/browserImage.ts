import { createServer } from "vite";

/** A client ESM server, independent of Vitest's SSR module transformer and the development app. */
export async function startBrowserImageHarness() {
  const server = await createServer({
    configFile: false,
    envDir: false,
    publicDir: false,
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: true,
      hmr: false,
      watch: null,
    },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("BROWSER_HARNESS_NOT_LISTENING");
    }
    return {
      url:
        `http://127.0.0.1:${address.port}/tests/browser/image-preparation.html`,
      close: () => server.close(),
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}
