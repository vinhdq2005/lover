import { createNotificationWorker } from "./handler.ts";
Deno.serve(createNotificationWorker());
