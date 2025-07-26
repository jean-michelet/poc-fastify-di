import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { ensurePluginNotRegisteredOnScope, loadDeps } from "./utils.ts";
import type { PluginLocator } from "./di.ts";
import {
  assertRegisterable,
  type AwaitedFn,
  type MaybePromise,
} from "./plugin-internals.ts";

export type ServiceConstraint = Record<string, ServicePluginInstance<any>>
export type PropsOf<PI> = PI extends ServicePluginInstance<infer P> ? P : never;

export type DepProps<
  Services extends ServiceConstraint
> = {
  [K in keyof Services]: PropsOf<Services[K]>;
};

export interface ServicePluginInstance<T> {
  readonly name: string;
  register: (fastify: FastifyInstance, locator: PluginLocator) => Promise<T>;
}

export interface ServiceDefinition<Services, ExposeFn, Resolved> {
  readonly name: string;
  readonly dependencies?: Services;
  readonly lifecycle?: "singleton" | "transient";
  readonly expose: ExposeFn;
  readonly onClose?: (props: Resolved) => Promise<void> | void;
}

export function servicePlugin<
  Services extends ServiceConstraint= {},
  ExposeFn extends (deps: DepProps<Services>) => MaybePromise<any> = (
    deps: DepProps<Services>
  ) => {},
  Resolved = AwaitedFn<ExposeFn>
>(options: ServiceDefinition<Services, ExposeFn, Resolved>) {
  const {
    name,
    dependencies = {},
    expose,
    lifecycle = "singleton",
    onClose,
  } = options;

  async function doLoadProps(fastify: FastifyInstance, locator: PluginLocator) {
    const depsProps = (await loadDeps(
      dependencies as DepProps<Services>,
      fastify,
      locator
    )) as DepProps<Services>;

    return (await expose(depsProps)) as Resolved;
  }

  const instance: ServicePluginInstance<Resolved> = {
    get name() {
      return name;
    },
    async register(fastify, locator) {
      assertRegisterable(fastify, "service");

      if (locator.services.has(name) && lifecycle === "singleton") {
        return locator.services.get(name) as Resolved;
      }

      ensurePluginNotRegisteredOnScope(fastify, name, "Service");

      const plugin = fp(
        async (fastify) => {
          const props = await doLoadProps(fastify, locator);
          if (!locator.services.has(name)) {
            locator.services.set(name, props);
          }

          if (onClose) {
            fastify.addHook("onClose", async () => {
              await onClose(props);
            });
          }
        },
        {
          name,
          encapsulate: lifecycle === "transient",
        }
      );

      await fastify.register(plugin);
      return locator.services.get(name) as Resolved;
    },
  };

  return Object.freeze(instance);
}
