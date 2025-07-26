import {
  type FastifyRequest,
  type FastifyInstance,
  type FastifyPluginOptions,
} from "fastify";
import fp from "fastify-plugin";
import type { DepProps, ServiceConstraint } from "./service-plugin.ts";
import { kBooting, kInConfigure } from "./symbols.ts";
import type { PropsOfScoped, ScopedPluginInstance, ScopedServiceConstraint } from "./scoped-plugin.ts";
import { ensurePluginNotRegisteredOnScope } from "./utils.ts";
import type { PluginLocator } from "./di.ts";

type ScopedProps<ReqPlugins> = {
  [K in keyof ReqPlugins]: {
    get(req: FastifyRequest): PropsOfScoped<ReqPlugins[K]>;
  };
};

export interface AppPluginInstance {
  name: string;
  register: (
    fastify: FastifyInstance,
    locator: PluginLocator,
    opts?: FastifyPluginOptions,
  ) => Promise<void>;
}

export interface AppPluginDefinition<
  Services extends ServiceConstraint = {},
  ReqPlugins extends ScopedServiceConstraint = {}
> {
  name: string; // unique identity
  encapsulate?: boolean;
  dependencies?: {
    services?: Services;
    scopedServices?: ReqPlugins;
  };
  opts?: FastifyPluginOptions;
  childPlugins?: AppPluginInstance[];
  configure?: (
    fastify: FastifyInstance,
    dependencies: {
      services: DepProps<Services>;
      scopedServices: ScopedProps<ReqPlugins>
    },
    opts?: FastifyPluginOptions
  ) => void | Promise<void>;
}

export function appPlugin<
  Services extends ServiceConstraint = {},
  ReqPlugins extends Record<string, ScopedPluginInstance<any>> = {}
>(options: AppPluginDefinition<Services, ReqPlugins>): AppPluginInstance {
  const {
    name,
    encapsulate = true,
    dependencies: { services, scopedServices } = {},
    childPlugins,
    configure,
    // To avoid recursively double prefixes /a/a/a:a
    opts: baseOpts = { prefix: '' },
  } = options;

  const instance: AppPluginInstance = {
    name,
    async register(fastify, locator, opts) {
      if (!fastify[kBooting]) {
        throw new Error(
          "You can only register an application plugin during booting."
        );
      }

      if (fastify[kInConfigure]) {
        throw new Error(
          "You can only inject a child plugin, not registering it manually."
        );
      }

      ensurePluginNotRegisteredOnScope(fastify, name, 'Application')

      const plugin = fp(
        async (fastify, opts) => {
          const depsProps = {} as DepProps<Services>;
          if (services) {
            for (const key in services) {
              const dep = services[key]
              depsProps[key] = await dep.register(fastify, locator)
            }
          }

          const scopedDeps = {} as ScopedProps<ReqPlugins>
          if (scopedServices) {
            for (const key in scopedServices) {
              const getter = await scopedServices[key].register(fastify, locator);
              
              scopedDeps[key] = {
                get: getter,
              };
            }
          }

          if (childPlugins) {
            for (const child of childPlugins) {
              await child.register(fastify, locator, opts);
            }
          }

          if (configure) {
            fastify[kInConfigure] = true;
            await configure(
              fastify,
              {
                services: depsProps,
                scopedServices: scopedDeps,
              },
              opts
            );
            fastify[kInConfigure] = false;
          }
        },
        { name, encapsulate }
      );

      await fastify.register(plugin, {
        ...opts,
        ...baseOpts,
      });
    },
  };

  return instance;
}
