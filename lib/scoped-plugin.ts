import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import { kBooting } from "./symbols.ts";
import type { PropsOf, ServicePluginInstance } from "./service-plugin.ts";
import { ensurePluginNotRegisteredOnScope, loadDeps } from "./utils.ts";

type AwaitedReturn<T extends (...args: any[]) => any> = Awaited<ReturnType<T>>;

type DepProps<
  Services extends Record<string, ServicePluginInstance<any>>
> = {
  [K in keyof Services]: PropsOf<Services[K]>;
};

export interface ScopedPluginInstance<ScopeProps> {
  name: string;
  register(
    fastify: FastifyInstance,
    opts?: FastifyPluginOptions
  ): Promise<void>;
  get(req: FastifyRequest): ScopeProps;
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
  ExposeFn extends (req: FastifyRequest, deps: DepProps<Services>) => any = (
    req: FastifyRequest,
    deps: DepProps<Services>
  ) => {}
>(
  options: ScopedPluginDefinition<Services, ExposeFn>
) {
  const { name, dependencies = {}, expose } = options;

  let booted = false;
  let depsProps: DepProps<Services>;

  const instance: ScopedPluginInstance<ReturnType<ExposeFn>> = {
    name,

    async register(fastify) {
      if (!fastify[kBooting]) {
        throw new Error(
          "You can only register a scoped plugin during booting."
        );
      }

      ensurePluginNotRegisteredOnScope(fastify, name, "Scoped service");

      const plugin = fp(
        async (fastify) => {
          depsProps = await loadDeps(dependencies as DepProps<Services>, fastify);

          fastify.addHook("onReady", async () => {
            booted = true;
          });
        },
        { name }
      );

      await fastify.register(plugin);
    },

    get(req: FastifyRequest): ReturnType<ExposeFn> {
      if (!booted) {
        throw new Error(
          `Cannot call .get() for "${name}" before Fastify is ready`
        );
      }
      return expose(req, depsProps);
    },
  };

  return Object.freeze(instance);
}
