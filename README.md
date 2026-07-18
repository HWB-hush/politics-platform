# 时政信息平台

这是一个前后端分离的时政信息平台，用于聚合、浏览和管理时政资讯。平台提供用户注册与登录、文章浏览与分类/关键词筛选、专题观察、每日简报，以及实时来源同步；业务数据持久化到 MySQL。

## 技术栈

- 前端：Vue 3、Vue Router、Vite
- 后端：Node.js、Express、mysql2、dotenv、CORS
- 数据库：MySQL

## 项目结构

- `web/`：Vue 3 前端应用
- `server/`：Express API、实时同步任务和数据库访问代码
- `server/sql/init.sql`：数据库结构与初始数据

## 环境要求

- Node.js（建议使用当前 LTS 版本）
- npm
- MySQL 8.x

## 安装依赖

项目根目录、后端和前端分别拥有 `package.json`，请在项目根目录执行：

```bash
npm install
npm install --prefix server
npm install --prefix web
```

## 初始化数据库

确保 MySQL 服务已经启动，然后从项目根目录导入初始化脚本：

```bash
mysql -u root -p < server/sql/init.sql
```

脚本会创建并使用 `politics_platform` 数据库，同时创建项目所需表和初始数据。

## 配置环境变量

复制示例配置并按本地 MySQL 环境修改：

```bash
cp server/.env.example server/.env
```

示例配置包含服务端口、MySQL 主机、端口、用户名、密码、数据库名和连接池上限。`server/.env` 包含本地凭据，已被 `.gitignore` 忽略，请勿提交。

生产环境必须设置至少 32 个字符的强随机 `AUTH_TOKEN_SECRET`；缺少或过短时，后端会拒绝启动。可使用 Node.js 生成随机值：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

只有明确的 `NODE_ENV=development` 或 `NODE_ENV=test` 才允许在未配置该变量时生成进程临时随机 secret。项目的 `npm run dev` 已通过跨平台的 Node 开发入口明确设置 `NODE_ENV=development`；重启开发服务后已有登录令牌会失效。请勿在生产环境使用公开固定值。

`npm start` 不设置 `NODE_ENV`，因此默认采用严格安全策略：必须在 `server/.env` 或进程环境中提供至少 32 个字符的 `AUTH_TOKEN_SECRET`，否则后端启动失败。`NODE_ENV=production` 同样执行该严格策略。

## 开发运行

在项目根目录同时启动后端和前端开发服务器：

```bash
npm run dev
```

也可以分别启动：

```bash
npm run dev --prefix server
npm run dev --prefix web
```

默认前端地址为 `http://localhost:5173`，后端地址为 `http://localhost:3000`。

## 实时来源同步

后端启动后会按服务配置运行实时来源同步。需要手动执行一次同步时，在项目根目录运行：

```bash
npm run sync:realtime --prefix server
```

同步结果会写入 MySQL，并通过文章接口参与浏览与筛选。

## 生产构建与运行

构建前端生产资源：

```bash
npm run build
```

构建结果位于 `web/dist/`。启动生产模式后端：

```bash
npm start
```

如需在本地预览前端生产构建，可运行：

```bash
npm run preview --prefix web
```

生产部署时应由 Web 服务器或静态托管服务发布 `web/dist/`，并按部署环境配置 API 转发与 `server/.env`。

## 主要功能

- 用户注册、登录和登录状态校验
- 文章列表、详情浏览、分类筛选与关键词搜索
- 专题内容展示
- 时政简报、指标和议程信息展示
- 实时资讯来源同步
- MySQL 数据持久化
