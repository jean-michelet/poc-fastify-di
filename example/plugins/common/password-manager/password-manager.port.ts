import type { ServicePluginInstance } from "../../../../lib/service-plugin.ts";

export interface PasswordManager {
  hash(value: string): Promise<string>;
  compare(value: string, hash: string): Promise<boolean>;
}

export type PasswordManagerPlugin = ServicePluginInstance<PasswordManager>;
