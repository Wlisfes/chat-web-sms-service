import { TbSmsApp, TbSmsQuote, TbSmsQuoteDraft } from '@wlisfes/chat-web-base-schema/chat-web-sms-mysql'

/** Nacos 中 SMS 服务 MySQL 配置的根路径。 */
export const SMS_MYSQL_CONFIG_KEY = 'database.chat-web-sms'

/** SMS 数据库包含的全部 TypeORM 实体。 */
export const SMS_MYSQL_ENTITIES = [TbSmsApp, TbSmsQuoteDraft, TbSmsQuote]
