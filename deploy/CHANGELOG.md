# SMS 部署变更记录

## 2026-10-16（短信业务迁入）

- 承接原 CRM 的客户短信应用与短信报价，新增数据库 `chat-web-sms`（`tb_sms_app`、`tb_sms_quote_draft`、`tb_sms_quote`）。
- `deploy.sh` 在切换容器前执行 `dist/cli/apply-schema-bootstrap.js`，迁移失败时保留当前运行版本。
- Nacos 需补齐 `server.secret`（与 CRM 原值一致）。

## 2026-10-16

- 按 Skyline 工程基准初始化空项目部署模板。
- 容器名 `chat-web-sms-service`，Compose 服务名 `sms-service`，监听端口 `5060`。
- 健康检查使用 `GET /health/live`。同机部署默认不设置 `NACOS_REGISTER_IP`，注册容器网卡 IP。
- 当前没有短信库和共享 Schema，部署脚本不执行数据库迁移，也不回写 Nacos。
