import {
  type FastifyRequest,
  type FastifyInstance,
  type FastifyPluginOptions,
} from "fastify";
import fp from "fastify-plugin";
import type { DepProps, ServicePluginInstance } from "./service-plugin.ts";
import { kBooting, kInConfigure } from "./symbols.ts";
import type { RequestPluginInstance } from "./request-plugin.ts";

type PropsOf<PI> = PI extends RequestPluginInstance<infer P> ? P : never;

export interface AppPluginInstance {
  name: string;
  registered: boolean;
  register: (
    fastify: FastifyInstance,
    opts?: FastifyPluginOptions
  ) => Promise<void>;
}

export interface AppPluginDefinition<
  Services extends Record<string, ServicePluginInstance<any>> = {},
  ReqPlugins extends Record<string, RequestPluginInstance<any>> = {}
> {
  name: string; // unique identity
  dependencies?: {
    services?: Services;
    scopedServices?: ReqPlugins;
  };
  opts?: FastifyPluginOptions;

  configure?: (
    fastify: FastifyInstance,
    dependencies: {
      services: DepProps<Services>,
      scopedServices: {
        [K in keyof ReqPlugins]: {
          get(req: FastifyRequest): PropsOf<ReqPlugins[K]>;
        };
      },
    },
    opts?: FastifyPluginOptions
  ) => void | Promise<void>;
}

export function appPlugin<
  Services extends Record<string, ServicePluginInstance<any>> = {},
  ReqPlugins extends Record<string, RequestPluginInstance<any>> = {}
>(options: AppPluginDefinition<Services, ReqPlugins>): AppPluginInstance {
  const {
    name,
    dependencies: {
      services,
      scopedServices
    } = {},
    configure,
    opts: baseOpts = {},
  } = options;

  let registering = false;
  let registered = false;
  const instance: AppPluginInstance = {
    name,
    registered: false,

    async register(fastify, opts) {
      if (!fastify[kBooting]) {
        throw new Error(
          "You can only register an application plugin during booting."
        );
      }

      if (registered || registering) return;
      registering = true;

      const plugin = fp(
        async (fastify, opts) => {
          const depsProps = {} as DepProps<Services>;
          if (services) {
            for (const key in services) {
              const dep = services[key];
              await dep.register(fastify, opts);
              depsProps[key as keyof Services] = dep.props;
            }
          }

          const scopedDeps = {} as {
            [K in keyof ReqPlugins]: {
              get(req: FastifyRequest): PropsOf<ReqPlugins[K]>;
            };
          };

          if (scopedServices) {
            for (const key in scopedServices) {
              const reqPlugin = scopedServices[key];
              await reqPlugin.register(fastify, opts);

              scopedDeps[key as keyof ReqPlugins] = {
                get: reqPlugin.get.bind(reqPlugin),
              };
            }
          }

          if (configure) {
            fastify[kInConfigure] = true;
            await configure(fastify, {
              services: depsProps,
              scopedServices: scopedDeps
            }, opts);
            fastify[kInConfigure] = false;
          }
        },
        { name, encapsulate: true }
      );

      fastify.register(plugin, {
        ...baseOpts,
        ...opts,
      });
      registered = true;
      registering = false;
    },
  };

  return instance;
}
