# SMS 部署与排障手册

## 当前形态

SMS 是按 `chat-web-skyline-service` 工程基准开发的 NestJS 服务，只在 `chat-home-server` 使用 Docker 部署。Runner 标签为 `chat-home-server`，GitHub Environment 为 `production-home`。

负责客户短信应用与短信报价。公网入口为 Gateway `/api/sms/**`，服务间入口为 Gateway `/feign/sms/**`；本仓库不得擅自修改 Gateway。

## 容器基线

- Compose 项目：`chat-web-service`
- Compose 服务：`sms-service`
- 容器：`chat-web-sms-service`
- 容器端口：`5060`；发布地址由 `HOST_BIND_IP` 控制，默认同机探活
- 外部网络：`chat-web-infrastructure`
- 健康接口：`GET /health/live`
- 公开入口：Gateway `/api/sms/**`；服务间入口：Gateway `/feign/sms/**`
- 日志：`json-file`，单文件最大 `20m`，保留 `30` 个文件

## 配置

机器配置位于 `/opt/chat-web-sms-service/.env`，从 `deploy/.env.example` 复制后填写。真实命名空间、密码和 Token 不得提交。

首次启动前需要在 Nacos 创建 Data ID `chat-web-sms-service.yaml`（本地开发示例为 `chat-web-sms-service-development.yaml`）。必须包含 `database.chat-web-sms`、`gateway.feign`（含 `service_token`）、`gateway.principal` 和 `server.secret`。`server.secret` 用于短信应用密钥加密，必须与历史密文加密时的值一致。不要把真实密钥写入仓库。

同机部署不要设置 `NACOS_REGISTER_IP`。留空后服务注册容器网卡 IP，供同一 Docker 网络中的 Gateway 访问。只有确认 Gateway 能直接访问该地址的 `5060` 时才填写。

## 数据库

数据库 `chat-web-sms`。`deploy.sh` 在切换容器前运行 `dist/cli/apply-schema-bootstrap.js`：配置账号已是单库账号时直接执行，否则创建 `sms_mig_` 前缀的临时单库账号执行共享包 `chat-web-sms-mysql` 的增量 SQL，结束后回收。执行记录在 `tb_sms_schema_migration`，已执行文件的校验和变化时中止部署。TypeORM 必须保持 `synchronize: false`。

## 验证

```bash
docker inspect chat-web-sms-service --format '{{.Config.Image}} {{.State.Health.Status}} {{.RestartCount}}'
docker exec chat-web-sms-service node -e "require('http').get('http://127.0.0.1:5060/health/live', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
docker logs --tail 100 chat-web-sms-service
```

也可通过 Gateway `/api/sms/health/live` 探活。
