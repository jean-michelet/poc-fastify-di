import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { servicePlugin } from "../../../../lib/service-plugin.ts";
import type { PasswordManagerPlugin } from "./password-manager.port.ts";

const SCRYPT_KEYLEN = 32;
const SCRYPT_COST = 65536;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 2;
const SCRYPT_MAXMEM = 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE * 2;

export function scryptHash(value: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(Math.min(16, SCRYPT_KEYLEN / 2));

    scrypt(
      value,
      salt,
      SCRYPT_KEYLEN,
      {
        cost: SCRYPT_COST,
        blockSize: SCRYPT_BLOCK_SIZE,
        parallelization: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAXMEM,
      },
      (error, key) => {
        /* c8 ignore start - Requires extreme or impractical configuration values */
        if (error !== null) {
          reject(error);
        } /* c8 ignore end */ else {
          resolve(`${salt.toString("hex")}.${key.toString("hex")}`);
        }
      }
    );
  });
}

function compare(value: string, hash: string): Promise<boolean> {
  const [salt, hashed] = hash.split(".");
  const saltBuffer = Buffer.from(salt, "hex");
  const hashedBuffer = Buffer.from(hashed, "hex");

  return new Promise((resolve) => {
    scrypt(
      value,
      saltBuffer,
      SCRYPT_KEYLEN,
      {
        cost: SCRYPT_COST,
        blockSize: SCRYPT_BLOCK_SIZE,
        parallelization: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAXMEM,
      },
      (error, key) => {
        /* c8 ignore start - Requires extreme or impractical configuration values */
        if (error !== null) {
          // Ensures same runtime in case of error
          timingSafeEqual(hashedBuffer, hashedBuffer);
          resolve(false);
        } /* c8 ignore end */ else {
          resolve(timingSafeEqual(key, hashedBuffer));
        }
      }
    );
  });
}

export const passwordManagerPlugin: PasswordManagerPlugin = servicePlugin({
  name: "password-manager",
  expose: () => ({
    hash: scryptHash,
    compare,
  }),
});
