/** RabbitMQ 虚拟主机；SMS、SRM、Dispatch 的 Nacos `rabbitmq.vhost` 必须都是这个值。 */
export const SMS_RABBITMQ_VHOST = '/chat-sms'
/** 短信交换机。 */
export const SMS_EXCHANGE = 'chat.sms.exchange'
/** 提交队列：SMS 发布，SRM 消费并选路。 */
export const SMS_SUBMIT_QUEUE = 'chat.sms.submit'
/** 提交路由键。 */
export const SMS_SUBMIT_ROUTING_KEY = 'sms.submit'
/** SRM 选路失败的短信进入死信队列，供人工排查。 */
export const SMS_DEAD_EXCHANGE = 'chat.sms.dead.exchange'
export const SMS_SUBMIT_DEAD_QUEUE = 'chat.sms.submit.dead'
export const SMS_SUBMIT_DEAD_ROUTING_KEY = 'sms.submit.dead'

/** 提交到 SRM 的短信。SMS 和 SRM 各声明一份，字段改动时要同步。 */
export interface SmsSubmitPayload {
    /** 本次提交生成的短信标识，当前不落库。 */
    messageId: string
    /** 短信应用主键，SRM 用它查应用绑定的路由。 */
    appKeyId: number
    /** 短信类型：MRKT、NTFY、SOTP。 */
    type: string
    /** 方向：Skyline 国家/地区主键。 */
    countryKeyId: number
    /** 接收号码：含国际区号，不带 + 号。 */
    toNumber: string
    /** 短信内容。 */
    content: string
    /** 提交时间，ISO-8601。 */
    submittedAt: string
}
