import type { ConfirmChannel } from 'amqplib'

/** 短信任务交换机：延时队列到期后转入这里。 */
export const SMS_TASK_EXCHANGE = 'chat.sms.task.exchange'
/** 到点队列：立即发送，以及延时到期后的目标。本服务发布并消费。 */
export const SMS_TASK_FIRE_QUEUE = 'chat.sms.task.fire'
export const SMS_TASK_FIRE_ROUTING_KEY = 'sms.task.fire'
/** 到点队列的死信，消费失败时进入死信。 */
export const SMS_TASK_DEAD_EXCHANGE = 'chat.sms.task.dead.exchange'
export const SMS_TASK_FIRE_DEAD_QUEUE = 'chat.sms.task.fire.dead'
export const SMS_TASK_FIRE_DEAD_ROUTING_KEY = 'sms.task.fire.dead'
/** 不足 3 小时的任务才入队。 */
export const SMS_TASK_ENQUEUE_WINDOW_MS = 3 * 60 * 60 * 1000
/** 延时队列在消息离开后再保留 1 小时，避免队列提前过期把消息删掉。 */
export const SMS_TASK_DELAY_QUEUE_GRACE_MS = 60 * 60 * 1000

/** 每个任务版本一条延时队列，旧版本到期后由本服务按版本丢弃。 */
export function smsTaskDelayQueue(taskKeyId: number, version: number): string {
    return `chat.sms.task.delay.${taskKeyId}.${version}`
}

/** 声明任务交换机和到点队列。延时队列在发布时按任务版本单独声明。 */
export async function setupSmsTaskTopology(channel: ConfirmChannel): Promise<void> {
    await channel.assertExchange(SMS_TASK_EXCHANGE, 'direct', { durable: true })
    await channel.assertExchange(SMS_TASK_DEAD_EXCHANGE, 'direct', { durable: true })
    await channel.assertQueue(SMS_TASK_FIRE_DEAD_QUEUE, { durable: true })
    await channel.bindQueue(SMS_TASK_FIRE_DEAD_QUEUE, SMS_TASK_DEAD_EXCHANGE, SMS_TASK_FIRE_DEAD_ROUTING_KEY)
    await channel.assertQueue(SMS_TASK_FIRE_QUEUE, {
        durable: true,
        deadLetterExchange: SMS_TASK_DEAD_EXCHANGE,
        deadLetterRoutingKey: SMS_TASK_FIRE_DEAD_ROUTING_KEY
    })
    await channel.bindQueue(SMS_TASK_FIRE_QUEUE, SMS_TASK_EXCHANGE, SMS_TASK_FIRE_ROUTING_KEY)
}
