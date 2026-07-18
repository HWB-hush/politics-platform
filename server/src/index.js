import cors from "cors";
import express from "express";
import { createAuthToken, getBearerToken, hashPassword, toSafeUser, verifyAuthToken, verifyPassword } from "./auth.js";
import { pingDatabase } from "./db.js";
import { getBriefingPayload, listTopics } from "./repositories/contentRepository.js";
import { createUser, findUserByAccount, findUserByEmail, findUserById, findUserByUsername } from "./repositories/userRepository.js";
import {
  getRealtimeArticleDetail,
  getRealtimeSourceDefinitions,
  listRealtimeArticles,
  listLatestRealtimeResults,
  listRealtimeHistory,
  runRealtimeSync,
  startRealtimeScheduler
} from "./services/realtimeSyncService.js";

const app = express();
const port = process.env.PORT || 3000;
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-zA-Z0-9_]{4,24}$/;

app.use(cors());
app.use(express.json());

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    await pingDatabase();
    res.json({ ok: true, database: "connected" });
  })
);

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const username = req.body.username?.trim();
    const displayName = req.body.displayName?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password ?? "";

    if (!usernamePattern.test(username || "")) {
      res.status(400).json({ message: "用户名需为 4-24 位字母、数字或下划线" });
      return;
    }

    if (!displayName || displayName.length < 2 || displayName.length > 30) {
      res.status(400).json({ message: "昵称长度需为 2-30 个字符" });
      return;
    }

    if (!emailPattern.test(email || "")) {
      res.status(400).json({ message: "请输入有效邮箱地址" });
      return;
    }

    if (typeof password !== "string" || password.length < 8 || password.length > 64) {
      res.status(400).json({ message: "密码长度需为 8-64 位" });
      return;
    }

    const [existingUsername, existingEmail] = await Promise.all([findUserByUsername(username), findUserByEmail(email)]);

    if (existingUsername) {
      res.status(409).json({ message: "用户名已存在" });
      return;
    }

    if (existingEmail) {
      res.status(409).json({ message: "邮箱已被注册" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({
      username,
      displayName,
      email,
      passwordHash
    });

    res.status(201).json({
      token: createAuthToken(user),
      user: toSafeUser(user)
    });
  })
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const account = req.body.account?.trim();
    const password = req.body.password ?? "";

    if (!account || !password) {
      res.status(400).json({ message: "请输入用户名或邮箱以及密码" });
      return;
    }

    const user = await findUserByAccount(account);

    if (!user || user.status !== "active" || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ message: "账号或密码错误" });
      return;
    }

    res.json({
      token: createAuthToken(user),
      user: toSafeUser(user)
    });
  })
);

app.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    const token = getBearerToken(req);
    const payload = verifyAuthToken(token);

    if (!payload) {
      res.status(401).json({ message: "登录状态已失效，请重新登录" });
      return;
    }

    const user = await findUserById(payload.sub);

    if (!user || user.status !== "active") {
      res.status(401).json({ message: "当前账号不可用" });
      return;
    }

    res.json({ user: toSafeUser(user) });
  })
);

app.post("/api/auth/logout", (_req, res) => {
  res.json({ ok: true });
});

app.get(
  "/api/realtime-data",
  asyncHandler(async (_req, res) => {
    res.json({
      sources: getRealtimeSourceDefinitions(),
      items: await listLatestRealtimeResults()
    });
  })
);

app.get(
  "/api/realtime-data/:sourceKey/history",
  asyncHandler(async (req, res) => {
    const parsedLimit = Number.parseInt(req.query.limit || "20", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;

    res.json({
      sourceKey: req.params.sourceKey,
      items: await listRealtimeHistory(req.params.sourceKey, limit)
    });
  })
);

app.post(
  "/api/realtime-data/sync",
  asyncHandler(async (_req, res) => {
    res.json(await runRealtimeSync());
  })
);

app.get(
  "/api/briefing",
  asyncHandler(async (_req, res) => {
    res.json(await getBriefingPayload());
  })
);

app.get(
  "/api/topics",
  asyncHandler(async (_req, res) => {
    res.json(await listTopics());
  })
);

app.get(
  "/api/articles",
  asyncHandler(async (req, res) => {
    const category = req.query.category?.trim();
    const queryText = req.query.q?.trim();

    res.json(
      await listRealtimeArticles({
        category,
        queryText
      })
    );
  })
);

app.get(
  "/api/articles/:slug",
  asyncHandler(async (req, res) => {
    const article = await getRealtimeArticleDetail(req.params.slug);

    if (!article) {
      res.status(404).json({ message: "Article not found" });
      return;
    }

    res.json(article);
  })
);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Database request failed"
  });
});

app.listen(port, () => {
  console.log(`Politics Platform API running at http://localhost:${port}`);
});

startRealtimeScheduler();
