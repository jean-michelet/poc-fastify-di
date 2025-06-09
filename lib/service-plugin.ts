import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from "fastify-plugin";
import { kBooting, kInConfigure } from "./symbols.ts";
import { ensurePluginNotRegisteredOnScope, loadDeps } from "./utils.ts";

type AwaitedReturn<T extends (...a: any) => any> = Awaited<ReturnType<T>>;

export type PropsOf<PI> = PI extends ServicePluginInstance<infer P> ? P : never;

export type DepProps<
  Services extends Record<string, ServicePluginInstance<any>>
> = {
  [K in keyof Services]: PropsOf<Services[K]>;
};

export interface ServicePluginInstance<Props extends Record<string, any> = {}> {
  readonly name: string;
  readonly props: Props;
  readonly register: (
    fastify: FastifyInstance,
    opts?: FastifyPluginOptions
  ) => Promise<void>;
  forTesting: (resolving?: Set<string>) => Promise<Props>;
}

export interface ServiceDefinition<
  Services extends Record<string, ServicePluginInstance<any>>,
  ExposeFn extends (deps: DepProps<Services>) => any
> {
  readonly name: string;
  readonly dependencies?: Services;
  readonly lifecycle?: "singleton" | "transient";
  readonly expose: ExposeFn;
}

export function servicePlugin<
  Services extends Record<string, ServicePluginInstance<any>> = {},
  ExposeFn extends (deps: DepProps<Services>) => any = (
    deps: DepProps<Services>
  ) => {}
>(
  options: ServiceDefinition<Services, ExposeFn>
): ServicePluginInstance<AwaitedReturn<ExposeFn>> {
  const { name, dependencies = {}, expose, lifecycle = "singleton" } = options;

  let exposedProps: AwaitedReturn<ExposeFn>;

  let testMode = false;
  let registered = false;
  let booting = false; // That's ok, because register is only called during booting

  async function doLoadProps(
    fastify?: FastifyInstance,
    resolving: Set<string> = new Set()
  ): Promise<AwaitedReturn<ExposeFn>> {
    const depsProps = await loadDeps(
      dependencies as DepProps<Services>,
      fastify,
      resolving
    );
    exposedProps = await expose(depsProps);
    return exposedProps;
  }

  const instance: ServicePluginInstance<AwaitedReturn<ExposeFn>> = {
    get name() {
      return name;
    },
    get props() {
      if (testMode) {
        return exposedProps;
      }

      if (!booting) {
        throw new Error(
          `Cannot access props for service "${name}" outside of Fastify boot phase.`
        );
      }

      return exposedProps;
    },

    async register(fastify) {
      if (testMode) {
        throw new Error(
          `Impossible to register service plugin '${name}' because 'forTesting' method has been called.`
        );
      }

      if (!fastify[kBooting]) {
        throw new Error(
          "You can only register a service plugin during booting."
        );
      }

      if (fastify[kInConfigure]) {
        throw new Error(
          "You can only inject service plugin as dependency, not registering it manually."
        );
      }

      if (registered && lifecycle === "singleton") return;

      ensurePluginNotRegisteredOnScope(fastify, name, "Service");

      booting = true;
      const plugin = fp(
        async (fastify) => {
          await doLoadProps(fastify);

          fastify.addHook("onReady", async () => (booting = false));
        },
        {
          name,
          encapsulate: lifecycle === "transient",
        }
      );

      await fastify.register(plugin);
      registered = true;
    },
    async forTesting(resolving: Set<string> = new Set()) {
      if (registered || booting) {
        throw new Error(
          "forTesting() method can only be used before booting the application."
        );
      }

      if (resolving.has(name)) {
        const path = [...resolving, name].join(" -> ");
        throw new Error(`Circular dependency detected: ${path}`);
      }

      resolving.add(name);

      testMode = true;
      await doLoadProps(undefined, resolving);
      return this.props;
    },
  };

  return Object.freeze(instance);
}
