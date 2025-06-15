import { it, describe } from "node:test";
import assert from "node:assert";
import type { FastifyInstance } from "fastify";
import { scryptHash } from "../../../example/plugins/common/password-manager/scrypt-password-manager.ts";
import { createTestApp, testCookieName } from "../../../example/test-app.ts";
import type { Knex } from "knex";

async function createUser(
  knex: Knex,
  userData: Partial<{ username: string; email: string; password: string }>
) {
  const [id] = await knex("users").insert(userData);
  return id;
}

async function deleteUser(knex: Knex, username: string) {
  await knex("users").delete().where({ username });
}

async function updatePasswordWithLogin(
  app: any,
  username: string,
  payload: { currentPassword: string; newPassword: string }
) {
  return app.injectWithLogin(`${username}@example.com`, {
    method: "PUT",
    url: "/api/users/update-password",
    payload,
  });
}

describe("Users API", async () => {
  const hash = await scryptHash("Password123$");

  it("Should enforce rate limiting (429 after 3 failed attempts)", async (t) => {
    const app = await createTestApp(t);
    await createUser(app.knex, {
      username: "user-limit",
      email: "user-limit@example.com",
      password: hash,
    });

    for (let i = 0; i < 3; i++) {
      const res = await updatePasswordWithLogin(app, "user-limit", {
        currentPassword: "wrong-Password123$",
        newPassword: "Password123$",
      });
      assert.strictEqual(res.statusCode, 401);
    }

    const res = await updatePasswordWithLogin(app, "user-limit", {
      currentPassword: "wrong-Password123$",
      newPassword: "Password123$",
    });

    assert.strictEqual(res.statusCode, 429);
    await deleteUser(app.knex, "user-limit");
  });

  it("Should update the password successfully", async (t) => {
    const app = await createTestApp(t);
    await createUser(app.knex, {
      username: "user-success",
      email: "user-success@example.com",
      password: hash,
    });

    const res = await updatePasswordWithLogin(app, "user-success", {
      currentPassword: "Password123$",
      newPassword: "NewPassword123$",
    });

    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(res.payload), {
      message: "Password updated successfully",
    });

    await deleteUser(app.knex, "user-success");
  });

  it("Should return 400 if the new password is the same", async (t) => {
    const app = await createTestApp(t);
    await createUser(app.knex, {
      username: "user-same-password",
      email: "user-same-password@example.com",
      password: hash,
    });

    const res = await updatePasswordWithLogin(app, "user-same-password", {
      currentPassword: "Password123$",
      newPassword: "Password123$",
    });

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(JSON.parse(res.payload), {
      message: "New password cannot be the same as the current password.",
    });

    await deleteUser(app.knex, "user-same-password");
  });

  it("Should return 400 if newPassword does not match required pattern", async (t) => {
    const app = await createTestApp(t);
    await createUser(app.knex, {
      username: "user-pattern",
      email: "user-pattern@example.com",
      password: hash,
    });

    const res = await updatePasswordWithLogin(app, "user-pattern", {
      currentPassword: "Password123$",
      newPassword: "password123$",
    });

    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(JSON.parse(res.payload), {
      message:
        'body/newPassword must match pattern "^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).*$"',
    });

    await deleteUser(app.knex, "user-pattern");
  });

  it("Should return 401 if current password is incorrect", async (t) => {
    const app = await createTestApp(t);
    await createUser(app.knex, {
      username: "user-wrong-pw",
      email: "user-wrong-pw@example.com",
      password: hash,
    });

    const res = await updatePasswordWithLogin(app, "user-wrong-pw", {
      currentPassword: "WrongPassword123$",
      newPassword: "Password123$",
    });

    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(JSON.parse(res.payload), {
      message: "Invalid current password.",
    });

    await deleteUser(app.knex, "user-wrong-pw");
  });

  it("Should return 401 if user does not exist", async (t) => {
    const app = await createTestApp(t);
    await createUser(app.knex, {
      username: "user-ghost",
      email: "user-ghost@example.com",
      password: hash,
    });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "user-ghost@example.com",
        password: "Password123$",
      },
    });

    assert.strictEqual(login.statusCode, 200);
    await deleteUser(app.knex, "user-ghost");

    const res = await app.inject({
      method: "PUT",
      url: "/api/users/update-password",
      payload: {
        currentPassword: "Password123$",
        newPassword: "NewPassword123$",
      },
      cookies: {
        [testCookieName]: login.cookies[0].value,
      },
    });

    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(JSON.parse(res.payload), {
      message: "User does not exist.",
    });
  });

  it("Should return 500 on internal error during password hashing", async (t) => {
    const faultyPasswordManager = {
      hash: async () => {
        throw new Error("Unexpected error");
      },
      compare: async (val: string, hash: string) => val === "Password123$",
    };

    const app = await createTestApp(t, {
      passwordManager: {
        name: "faulty-password-manager",
        async register() {
          return faultyPasswordManager;
        },
      },
    });

    await createUser(app.knex, {
      username: "user-crash",
      email: "user-crash@example.com",
      password: hash,
    });

    const res = await updatePasswordWithLogin(app, "user-crash", {
      currentPassword: "Password123$",
      newPassword: "NewPassword123$",
    });

    assert.strictEqual(res.statusCode, 500);
    assert.deepStrictEqual(JSON.parse(res.payload), {
      message: "Internal Server Error",
    });

    await deleteUser(app.knex, "user-crash");
  });
});
