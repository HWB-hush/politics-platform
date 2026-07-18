import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const configuredTokenSecret = process.env.AUTH_TOKEN_SECRET?.trim();
const allowsEphemeralTokenSecret = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

if (!allowsEphemeralTokenSecret && !configuredTokenSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_TOKEN_SECRET is required in production");
  }

  throw new Error("AUTH_TOKEN_SECRET is required unless NODE_ENV is development or test");
}

if (!allowsEphemeralTokenSecret && configuredTokenSecret.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_TOKEN_SECRET must be at least 32 characters in production");
  }

  throw new Error("AUTH_TOKEN_SECRET must be at least 32 characters unless NODE_ENV is development or test");
}

const TOKEN_SECRET = configuredTokenSecret || randomBytes(32).toString("base64url");
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function sign(value) {
  return createHmac("sha256", TOKEN_SECRET).update(value).digest("base64url");
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);

  return `scrypt$${salt}$${Buffer.from(derivedKey).toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, salt, digest] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !digest) {
    return false;
  }

  const derivedKey = Buffer.from(await scryptAsync(password, salt, 64));
  const storedDigest = Buffer.from(digest, "hex");

  if (derivedKey.length !== storedDigest.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedDigest);
}

export function toSafeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    role: user.role
  };
}

export function createAuthToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: user.id,
      exp: now + TOKEN_TTL_SECONDS
    })
  );

  return `${payload}.${sign(payload)}`;
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload));

    if (!parsed.sub || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getBearerToken(request) {
  const authorization = request.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}
