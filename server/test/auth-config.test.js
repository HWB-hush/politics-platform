import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const serverDirectory = new URL("..", import.meta.url);

function runAuthModule(source, environment = {}) {
  const env = { ...process.env, ...environment };
  delete env.AUTH_TOKEN_SECRET;

  if (environment.NODE_ENV === undefined) {
    delete env.NODE_ENV;
  }

  if (environment.AUTH_TOKEN_SECRET) {
    env.AUTH_TOKEN_SECRET = environment.AUTH_TOKEN_SECRET;
  }

  return spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: serverDirectory,
    env,
    encoding: "utf8"
  });
}

test("production startup fails when AUTH_TOKEN_SECRET is missing", () => {
  const result = runAuthModule('await import("./src/auth.js")', { NODE_ENV: "production" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTH_TOKEN_SECRET is required in production/);
});

test("startup fails when NODE_ENV and AUTH_TOKEN_SECRET are both missing", () => {
  const result = runAuthModule('await import("./src/auth.js")');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTH_TOKEN_SECRET is required unless NODE_ENV is development or test/);
});

test("startup fails with a short AUTH_TOKEN_SECRET when NODE_ENV is missing", () => {
  const result = runAuthModule('await import("./src/auth.js")', {
    AUTH_TOKEN_SECRET: "too-short"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTH_TOKEN_SECRET must be at least 32 characters unless NODE_ENV is development or test/);
});

test("development without AUTH_TOKEN_SECRET uses a process-random secret", () => {
  const createResult = runAuthModule(
    'const { createAuthToken } = await import("./src/auth.js"); console.log(createAuthToken({ id: 42 }));',
    { NODE_ENV: "development" }
  );

  assert.equal(createResult.status, 0, createResult.stderr);
  const token = createResult.stdout.trim();
  assert.ok(token);

  const verifyResult = runAuthModule(
    `const { verifyAuthToken } = await import("./src/auth.js"); console.log(JSON.stringify(verifyAuthToken(${JSON.stringify(token)})));`,
    { NODE_ENV: "development" }
  );

  assert.equal(verifyResult.status, 0, verifyResult.stderr);
  assert.equal(verifyResult.stdout.trim(), "null");
});

test("production accepts an explicit AUTH_TOKEN_SECRET", () => {
  const result = runAuthModule(
    'const { createAuthToken } = await import("./src/auth.js"); console.log(createAuthToken({ id: 7 }));',
    {
      NODE_ENV: "production",
      AUTH_TOKEN_SECRET: "test-only-secret-with-at-least-32-characters"
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^[^.]+\.[A-Za-z0-9_-]+\s*$/);
});

test("production rejects an AUTH_TOKEN_SECRET shorter than 32 characters", () => {
  const result = runAuthModule('await import("./src/auth.js")', {
    NODE_ENV: "production",
    AUTH_TOKEN_SECRET: "too-short"
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AUTH_TOKEN_SECRET must be at least 32 characters/);
});
