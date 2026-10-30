import { Omix } from '@wlisfes/chat-web-base-schema'

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

/**提交到通道的短信数据格式**/
export interface MessageSubmitPayload extends Omix {
    /** 本次提交生成的数字字符串雪花 ID，当前不落库。 */
    msgId: string
    /** 提交短信的C端客户主键ID */
    userKeyId: number
    /** 提交短信的C端客户名称 */
    userName: string
    /** 提交短信的应用主键ID */
    appKeyId: number
    /** 提交短信的应用ID */
    appId: string
    /** 短信类型：MRKT、NTFY、SOTP */
    type: 'MRKT' | 'NTFY' | 'SOTP'
    /** 方向：Skyline 国家/地区主键 */
    countryKeyId: number | string
    /** 号码所在国家 */
    mcc: string
    /** 接收号码：含国际区号，不带 + 号。 */
    toNumber: string
    /** 短信内容。 */
    content: string
    /** 内容字符数 */
    contentLength: number
    /** 编码方式 */
    encoding: 'UCS2' | 'GSM7'
    /** 计费条数 */
    segments: number
    /** 客户售价：USD总额(放大百万倍存储) */
    price: number
    /** 提交时间，ISO-8601。 */
    submitTime: string
    /** 提交短信任务的ID */
    taskId?: number
    /** 提交短信任务的名称 */
    taskName?: string
    /** 提交短信的模板ID */
    templateId?: string
}
