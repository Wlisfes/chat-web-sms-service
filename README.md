# Chat Web SMS Service

基于 `chat-web-skyline-service` 工程基准的 NestJS 11 SMS 服务，负责客户短信应用与短信报价。

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

对外访问经 Gateway `/api/sms/**`：

- `POST /api/sms/app/*`：客户短信应用
- `POST /api/sms/quote/*`：短信报价草稿与正式报价

服务间访问经 Gateway `/feign/sms/**`，由共享 `FeignClientSmsManager` 定义契约：`/feign/sms/app/count/resolve` 按客户统计短信应用数量，`/feign/sms/app/column/resolve` 按短信应用主键批量返回摘要（不含密钥和推送地址，供 SRM 路由绑定和选路使用）。

服务通过 `@wlisfes/chat-web-base-schema` 的 `NacosModule` 读取 `chat-web-sms-service-development.yaml` 并注册实例。

## 当前边界

- 数据库 `chat-web-sms`，Nacos 节点 `database.chat-web-sms`；实体与增量 SQL 来自 `@wlisfes/chat-web-base-schema/chat-web-sms-mysql`。
- 客户与客户配置通过 CRM Feign 查询，基础价格与汇率通过 Finance Feign 查询，使用 Nacos `gateway.feign.service_token` 服务凭据。
- 短信应用密钥依赖 Nacos `server.secret`，必须与历史密文的加密值一致。

## 共享基础包

项目安装 `@wlisfes/chat-web-base-schema`，并按照该包的 `peerDependencies` 与 Skyline 锁定的版本补齐：

- `@nestjs/swagger`、`@nestjs/typeorm`
- `class-transformer`、`express`
- `js-yaml`、`mysql2`、`redis`、`typeorm`

这些依赖用于保证 Base Schema 的导出入口可以正常解析。TypeORM 保持 `synchronize: false`，启动时不会改表；表结构由部署前的 Schema 增量 SQL 管理。`@wlisfes` 私有包通过仓库 `.npmrc` 指向 GitHub Packages，`yarn run install` 和 `yarn run base:update` 会依次复用 `NODE_AUTH_TOKEN`、`gh auth token` 或用户级 `~/.npmrc` 中的 GitHub Packages Token。

## 验证

```bash
yarn format:check
yarn test
```

## 部署

仓库保留 `chat-home-server` Docker 自动部署。只有合并到 `main` 后才触发构建部署；日常开发继续使用 `developer`。部署细节见 `deploy/RUNBOOK.md`。
