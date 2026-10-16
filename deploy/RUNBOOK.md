# SMS 部署与排障手册

## 当前形态

SMS 是按 `chat-web-skyline-service` 初始化的空 NestJS 服务，只在 `chat-home-server` 使用 Docker 部署。Runner 标签为 `chat-home-server`，GitHub Environment 为 `production-home`。

当前没有短信业务模块、数据库和 Feign。Gateway `/api/sms/**` 也尚未登记，本仓库不得擅自修改 Gateway。

## 容器基线

- Compose 项目：`chat-web-service`
- Compose 服务：`sms-service`
- 容器：`chat-web-sms-service`
- 容器端口：`5060`；发布地址由 `HOST_BIND_IP` 控制，默认同机探活
- 外部网络：`chat-web-infrastructure`
- 健康接口：`GET /health/live`
- 预留公开入口：Gateway `/api/sms/**`，登记前不要用该路径判断部署是否成功
- 日志：`json-file`，单文件最大 `20m`，保留 `30` 个文件

## 配置

机器配置位于 `/opt/chat-web-sms-service/.env`，从 `deploy/.env.example` 复制后填写。真实命名空间、密码和 Token 不得提交。

首次启动前需要在 Nacos 创建 Data ID `chat-web-sms-service.yaml`（本地开发示例为 `chat-web-sms-service-development.yaml`）。空模板不读取数据库节点。若网关身份守卫启动时要求身份密钥，按其他服务补齐 `gateway.principal`，不要把真实密钥写入仓库。

同机部署不要设置 `NACOS_REGISTER_IP`。留空后服务注册容器网卡 IP，供同一 Docker 网络中的 Gateway 访问。只有确认 Gateway 能直接访问该地址的 `5060` 时才填写。

## 数据库

共享包当前没有 `chat-web-sms-mysql`。`deploy.sh` 不执行 Schema 迁移。出现短信表后再补 `src/database/`、`src/cli/apply-schema*.ts`，并在切换容器前用临时单库账号执行增量 SQL。TypeORM 必须保持 `synchronize: false`。

## 验证

```bash
docker inspect chat-web-sms-service --format '{{.Config.Image}} {{.State.Health.Status}} {{.RestartCount}}'
docker exec chat-web-sms-service node -e "require('http').get('http://127.0.0.1:5060/health/live', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
docker logs --tail 100 chat-web-sms-service
```

Gateway 路由登记后，再增加 `/api/sms/health/live` 探活。登记前该路径不存在，不能当作部署失败。
