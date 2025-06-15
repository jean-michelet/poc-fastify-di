import { it, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createConfigPlugin } from "../../../example/plugins/infrastructure/config.ts";
import { createApp } from "../../../lib/di.ts";
import { appPlugin } from "../../../lib/app-plugin.ts";
import path from "node:path";
import { TransformDecodeCheckError } from "@sinclair/typebox/value";

it("should throw if env variables are invalid", async (t: TestContext) => {
  t.plan(1);
  const config = createConfigPlugin(
    path.join(import.meta.dirname, "./fixtures/.env.invalid")
  );

  try {
    await createApp({
      rootPlugin: appPlugin({
        name: "app",
        dependencies: {
          services: {
            config,
          },
        },
      }),
    });
  } catch (error) {
    t.assert.ok(error instanceof TransformDecodeCheckError);
  }
});
