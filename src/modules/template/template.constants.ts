/** 短信模板创建命名锁；模板 ID 全局唯一，串行生成避免冲突。 */
export const SMS_TEMPLATE_CREATE_LOCK = 'sms:template:create'

/** 模板 ID 固定 16 位，由大小写字母和数字组成。 */
export const SMS_TEMPLATE_ID_LENGTH = 16
