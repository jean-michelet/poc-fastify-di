import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import { kBooting } from "./symbols.ts";
import type { DepProps, ServicePluginInstance } from "./service-plugin.ts";
import { ensurePluginNotRegisteredOnScope, loadDeps } from "./utils.ts";
import type { PluginLocator } from "./di.ts";

export type PropsOfScoped<PI> = PI extends ScopedPluginInstance<infer P> ? P : never;

type DefaultExposeFn<
  Services extends Record<string, ServicePluginInstance<any>> = {},
  Return = {}
> = (req: FastifyRequest, deps: DepProps<Services>) => Return;

type ScopedPluginGetter<T> = (req: FastifyRequest) => T;

export interface ScopedPluginInstance<
  ScopeProps extends Record<string, any> = {}
> {
  name: string;
  register(
    fastify: FastifyInstance,
    locator: PluginLocator,
    opts?: FastifyPluginOptions
  ): Promise<ScopedPluginGetter<ScopeProps>>;
}

export interface ScopedPluginDefinition<
  Services extends Record<string, ServicePluginInstance<any>>,
  ExposeFn extends (req: FastifyRequest, deps: DepProps<Services>) => any
> {
  name: string;
  dependencies?: Services;
  expose: ExposeFn;
}

export function scopedPlugin<
  Services extends Record<string, ServicePluginInstance<any>> = {},
  ExposeFn extends DefaultExposeFn<Services, any> = DefaultExposeFn<
    Services,
    {}
  >
>(options: ScopedPluginDefinition<Services, ExposeFn>) {
  const { name, dependencies = {}, expose } = options;

  const decoratorName = Symbol(name);
  const instance: ScopedPluginInstance<ReturnType<ExposeFn>> = {
    name,

    async register(fastify, locator) {
      if (!fastify[kBooting]) {
        throw new Error(
          "You can only register a scoped plugin during booting."
        );
      }

      ensurePluginNotRegisteredOnScope(fastify, name, "Scoped service");

      let booted = false;
      const plugin = fp(
        async (fastify) => {
          const depsProps = (await loadDeps(
            dependencies as DepProps<Services>,
            fastify,
            locator
          )) as DepProps<Services>;

          locator.scopedServices.set(name, (req: FastifyRequest) => {
            if (!booted) {
              throw new Error(
                `Cannot call .get() for "${name}" before Fastify is ready`
              );
            }

            if (!req[decoratorName]) {
              req[decoratorName] = expose(req, depsProps);
            }

            return req[decoratorName];
          });

          fastify.decorateRequest(Symbol.for(name), null);
          fastify.addHook("onReady", async () => {
            booted = true;
          });
        },
        { name }
      );

      await fastify.register(plugin);
      return locator.scopedServices.get(name) as ScopedPluginGetter<
        ReturnType<ExposeFn>
      >;
    },
  };

  return Object.freeze(instance);
}
