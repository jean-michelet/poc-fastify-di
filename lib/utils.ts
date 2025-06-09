import type { FastifyInstance } from "fastify";
import type { ServicePluginInstance } from "./service-plugin";

export async function loadDeps<
  Services extends Record<string, ServicePluginInstance>
>(
  dependencies: Services,
  fastify?: FastifyInstance,
  resolving: Set<string> = new Set()
): Promise<{
  [K in keyof Services]: Services[K]["props"];
}> {
  const depsProps = {} as {
    [K in keyof Services]: Services[K]["props"];
  };

  for (const key in dependencies) {
    const dep = dependencies[key];
    if (fastify) {
      await dep.register(fastify);
      depsProps[key] = dep.props;
    } else {
      depsProps[key as keyof Services] = await dep.forTesting(resolving);
    }
  }

  return depsProps;
}

export function ensurePluginNotRegisteredOnScope(
  fastify: FastifyInstance,
  name: string,
  type: "Application" | "Service" | "Scoped service"
) {
  if (fastify.hasPlugin(name)) {
    throw new Error(
      `${type} plugin with the name '${name}' has already been registered on this encapsulation context.`
    );
  }
}
