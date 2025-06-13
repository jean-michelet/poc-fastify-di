import fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { kBooting, kInConfigure } from "./symbols.ts";
import { type AppPluginInstance } from "./app-plugin.ts";

interface FastifyDiOptions {
  rootPlugin: AppPluginInstance;
  serverOptions?: FastifyServerOptions;
  onFastifyCreated?: (fastify: FastifyInstance) => void | Promise<void>;
  onRootRegistered?: (fastify: FastifyInstance) => void | Promise<void>;
}

export async function createApp({
  serverOptions,
  rootPlugin,
  onFastifyCreated,
  onRootRegistered,
}: FastifyDiOptions) {
  const app = fastify(serverOptions);
  app.decorate(kBooting, true);
  app.decorate(kInConfigure, false);

  if (onFastifyCreated) {
    await onFastifyCreated(app)
  }

  await rootPlugin.register(app);

  if (onRootRegistered) {
    await onRootRegistered(app)
  }

  await app.ready();
  app[kBooting] = false;

  return app;
}
