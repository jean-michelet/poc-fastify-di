import type { FastifyInstance } from "fastify";
import type { ServicePluginInstance } from "./service-plugin.ts";
import rfdc from "rfdc";
import type { PluginLocator } from "./di.ts";

export const deepClone = rfdc();
export async function loadDeps<
  Services extends Record<string, ServicePluginInstance>
>(dependencies: Services, fastify: FastifyInstance, locator: PluginLocator) {
  const depsProps: Record<string, unknown> = {};
  for (const key in dependencies) {
    const dep = dependencies[key];
    if (fastify) {
      depsProps[key] = await dep.register(fastify, locator);
    }
  }

  return depsProps;
}

export function ensurePluginNotRegisteredOnScope(
  fastify: FastifyInstance,
  name: string,
  type: "Adapter" | "Application" | "Service" | "Scoped service"
) {
  if (fastify.hasPlugin(name)) {
    if (type === "Service") {
      throw new Error(
        `Service plugin '${name}' is already registered in this context. Use 'singleton' lifecycle to allow reuse.`
      );
    }

    throw new Error(
      `${type} plugin with the name '${name}' has already been registered on this context.`
    );
  }
}
