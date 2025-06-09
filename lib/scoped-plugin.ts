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
export type DepProps<
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
  services?: Services;
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
): ScopedPluginInstance<AwaitedReturn<ExposeFn>> {
  const { name, services = {}, expose } = options;

  let booted = false;
  let registered = false
  let depsProps: DepProps<Services>;

  const instance: ScopedPluginInstance<AwaitedReturn<ExposeFn>> = {
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
          depsProps = await loadDeps(services as DepProps<Services>, fastify);

          fastify.addHook("onReady", async () => {
            booted = true;
          });
        },
        { name, encapsulate: true }
      );

      await fastify.register(plugin);
      registered = true
    },

    get(req: FastifyRequest): AwaitedReturn<ExposeFn> {
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
