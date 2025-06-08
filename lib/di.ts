import fastify, { type FastifyServerOptions } from "fastify";
import { kBooting, kInConfigure } from "./symbols.ts";
import { type AppPluginInstance } from "./app-plugin.ts";

interface FastifyDiOptions {
  serverOptions?: FastifyServerOptions;
  rootPlugin: AppPluginInstance;
}

export async function createApp({ serverOptions, rootPlugin }: FastifyDiOptions) {
  const app = fastify(serverOptions);
  app.decorate(kBooting, true)
  app.decorate(kInConfigure, false)
  await rootPlugin.register(app)
  await app.ready()
  app[kBooting] = false;
  return app
}
