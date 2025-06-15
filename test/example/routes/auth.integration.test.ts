import { describe, it } from "node:test";
import assert from "node:assert";

import { servicePlugin } from "../../../lib/service-plugin.ts";
import {
  createTestApp,
  expectValidationError,
  testCookieName,
} from "../../../example/test-app.ts";

describe("Auth API", () => {
  describe("POST /api/auth/login", () => {
    it("should rollback transaction on error", async (t) => {
      const crashingPasswordManager = servicePlugin({
        name: "mock-password-manager",
        expose: () => ({
          compare: async () => {
            throw new Error("Kaboom!");
          },
          hash: async (val: string) => `hash:${val}`,
        }),
      });

      const app = await createTestApp(t, {
        passwordManager: crashingPasswordManager,
      });

      const { mock: mockLogError } = t.mock.method(app.log, "error");

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "basic@example.com",
          password: "Password123$",
        },
      });

      const arg = mockLogError.calls[0].arguments[0] as unknown as {
        err: Error;
      };

      assert.strictEqual(res.statusCode, 500);
      assert.deepStrictEqual(arg.err.message, "Kaboom!");
    });

    it("should return 400 if credentials payload is invalid", async (t) => {
      const app = await createTestApp(t);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "",
          password: "Password123$",
        },
      });

      expectValidationError(
        res,
        "body/email must NOT have fewer than 1 characters"
      );
    });

    it("should authenticate with valid credentials", async (t) => {
      const app = await createTestApp(t);

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          email: "basic@example.com",
          password: "Password123$",
        },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(
        res.cookies.some((cookie) => cookie.name === testCookieName)
      );
    });

    it("should reject invalid credentials", async (t) => {
      const app = await createTestApp(t);

      const testCases = [
        {
          email: "invalid@email.com",
          password: "password",
          description: "invalid email",
        },
        {
          email: "basic@example.com",
          password: "wrong_password",
          description: "invalid password",
        },
        {
          email: "invalid@email.com",
          password: "wrong_password",
          description: "both invalid",
        },
      ];

      for (const testCase of testCases) {
        const res = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: testCase.email,
            password: testCase.password,
          },
        });

        assert.strictEqual(
          res.statusCode,
          401,
          `Expected 401 for ${testCase.description}`
        );

        assert.deepStrictEqual(JSON.parse(res.payload), {
          message: "Invalid email or password.",
        });
      }
    });
  });
});
