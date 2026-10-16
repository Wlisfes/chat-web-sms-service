# Chat Web SMS Service

基于 `chat-web-skyline-service` 工程基准初始化的 NestJS 11 空项目，用于后续开发 SMS 服务。

## 环境

- Node.js 22
- Yarn 1.22.22

## 本地运行

复制 `.env.example` 为 `.env`，填写 Nacos Namespace ID：

```bash
cp .env.example .env
node scripts/yarn-auth.cjs install --frozen-lockfile --check-files --ignore-scripts
yarn dev
```

本地启动会优先使用 Nacos 客户端默认端口 `7777`；如果检测到端口冲突，启动脚本会自动随机选择可用端口，不需要配置到 Nacos。

未设置 `PORT` 时需要在 `.env` 中配置。模板默认监听 `5060`：

- `GET /` 返回 `Hello World!`
- `GET /health/live` 返回进程存活状态

对外访问预留 Gateway：

- `GET /api/sms/`
- `GET /api/sms/health/live`

该路由尚未登记到 Gateway，本仓库不修改 Gateway。

服务通过 `@wlisfes/chat-web-base-schema` 的 `NacosModule` 读取 `chat-web-sms-service-development.yaml` 并注册实例。

## 当前边界

空模板只保留欢迎页、存活检查、Nacos 和网关身份上下文。共享包还没有 `chat-web-sms-mysql`，因此没有 `src/database/`、`src/feign/` 和 Schema 迁移命令。短信业务出现后再按 Skyline 的模块目录添加。

## 共享基础包

项目安装 `@wlisfes/chat-web-base-schema`，并按照该包的 `peerDependencies` 与 Skyline 锁定的版本补齐：

- `@nestjs/swagger`、`@nestjs/typeorm`
- `class-transformer`、`express`
- `js-yaml`、`mysql2`、`redis`、`typeorm`

这些依赖用于保证 Base Schema 的导出入口可以正常解析。当前服务不连接短信库，TypeORM 也不会在启动时改表。`@wlisfes` 私有包通过仓库 `.npmrc` 指向 GitHub Packages，`yarn run install` 和 `yarn run base:update` 会依次复用 `NODE_AUTH_TOKEN`、`gh auth token` 或用户级 `~/.npmrc` 中的 GitHub Packages Token。

## 验证

```bash
yarn format:check
yarn test
```

## 部署

仓库保留 `chat-home-server` Docker 自动部署。只有合并到 `main` 后才触发构建部署；日常开发继续使用 `developer`。部署细节见 `deploy/RUNBOOK.md`。
