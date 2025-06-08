import type { FastifyInstance } from "fastify";

export async function loadDeps<
  Services extends Record<
    string,
    {
      register: (f: FastifyInstance) => Promise<void>;
      props: any;
      forTesting: () => Promise<any>;
    }
  >
>(
  dependencies: Services,
  fastify?: FastifyInstance,
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
      depsProps[key as keyof Services] = await dep.forTesting();
    }
  }

  return depsProps;
}
