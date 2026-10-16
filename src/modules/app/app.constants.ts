/** 短信应用密钥加密主密钥的 Nacos 配置路径，复用服务级 server.secret；值至少 32 位，只保存在 Nacos，不得写入代码或示例文件。 */
export const SMS_SERVER_SECRET_CONFIG_KEY = 'server.secret'

/** 短信应用密钥密文版本前缀；格式为 v1:iv:authTag:cipherText，均为 base64url。 */
export const SMS_SECRET_CIPHER_VERSION = 'v1'

/** 短信应用创建命名锁；应用名称按客户自增、应用别名按创建人工号和应用类型自增，统一串行生成避免序号冲突。 */
export const SMS_APP_CREATE_LOCK = 'sms:app:create'

/** 应用ID固定16位，应用密钥明文固定64位，均由大小写字母和数字组成。 */
export const SMS_APP_ID_LENGTH = 16
export const SMS_APP_SECRET_LENGTH = 64

/** 应用名称前缀：SMS-1、SMS-2…… */
export const SMS_APP_NAME_PREFIX = 'SMS-'

/** 应用别名规则：CSK + 创建人工号 + 4位应用类型（MRKT、NTFY、SOTP）+ 4位分段序号，例如 CSK1233SOTPA001、CSK1233SOTPAA01。 */
export const SMS_APP_ALIAS_PREFIX = 'CSK'
/** 单字母段数字最大值：A001-Z999。 */
export const SMS_APP_ALIAS_SINGLE_MAX = 999
/** 双字母段数字最大值：AA01-ZZ99。 */
export const SMS_APP_ALIAS_DOUBLE_MAX = 99
/** 单字母段容量：26 × 999。 */
export const SMS_APP_ALIAS_SINGLE_CAPACITY = 26 * SMS_APP_ALIAS_SINGLE_MAX
/** 同一工号同一类型的应用别名总容量：26 × 999 + 26 × 26 × 99。 */
export const SMS_APP_ALIAS_CAPACITY = SMS_APP_ALIAS_SINGLE_CAPACITY + 26 * 26 * SMS_APP_ALIAS_DOUBLE_MAX

/** 查看与重置短信应用密钥的按钮权限码。 */
export const SMS_APP_SECRET_PERMISSION = 'crm:sms-app:secret'
export const SMS_APP_SECRET_RESET_PERMISSION = 'crm:sms-app:secret:reset'
