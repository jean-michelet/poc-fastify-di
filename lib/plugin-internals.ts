import type { FastifyInstance } from "fastify";
import { kBooting, kInConfigure } from "./symbols.ts";

export type MaybePromise<T> = T | Promise<T>;
export type AwaitedFn<F extends (...a: any[]) => any> = Awaited<ReturnType<F>>;

export function assertRegisterable(f: FastifyInstance, type: string) {
  if (!f[kBooting])
    throw new Error(`You can only register a ${type} plugin during booting.`);
  if (f[kInConfigure])
    throw new Error(
      `You can only inject a ${type} plugin, not register it manually.`
    );
}
