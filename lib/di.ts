import fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { kBooting, kInConfigure } from "./symbols.ts";
import { type AppPluginInstance } from "./app-plugin.ts";

interface FastifyDiOptions {
  rootPlugin: AppPluginInstance;
  serverOptions?: FastifyServerOptions;
  onFastifyCreated?: (fastify: FastifyInstance, locator: PluginLocator) => void | Promise<void>;
  onRootRegistered?: (fastify: FastifyInstance) => void | Promise<void>;
}

export type PluginLocator = {
  services: Map<string, unknown>,
  scopedServices: Map<string, unknown>,
  appPlugins: Set<string>
}
export function createLocator (): PluginLocator {
  return {
    services: new Map(),
    scopedServices: new Map(),
    appPlugins: new Set()
  }
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

  const locator = createLocator()
  if (onFastifyCreated) {
    await onFastifyCreated(app, locator)
  }

  await rootPlugin.register(app, locator);

  if (onRootRegistered) {
    await onRootRegistered(app)
  }

  await app.ready();
  app[kBooting] = false;

  return app;
}
