# SMS 部署变更记录

## 2026-10-16

- 按 Skyline 工程基准初始化空项目部署模板。
- 容器名 `chat-web-sms-service`，Compose 服务名 `sms-service`，监听端口 `5060`。
- 健康检查使用 `GET /health/live`。同机部署默认不设置 `NACOS_REGISTER_IP`，注册容器网卡 IP。
- 当前没有短信库和共享 Schema，部署脚本不执行数据库迁移，也不回写 Nacos。
