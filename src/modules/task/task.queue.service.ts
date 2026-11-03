import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository, DataBaseService, Repository } from '@wlisfes/chat-web-base-schema/database'
import { RabbitmqService } from '@wlisfes/chat-web-base-schema/rabbitmq'
import { isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import { parsePlanTime } from '@/modules/task/task.utils.service'
import * as topology from '@/modules/task/task.topology'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** 入队消息：消费者按任务主键和版本读取任务表，不信任消息里的发送时间。 */
export interface SmsTaskQueuePayload {
    taskKeyId: number
    version: number
}

export interface SmsTaskEnqueueResult {
    scanned: number
    enqueued: number
    skipped: number
}

/** planTime 为空或距离现在不足 3 小时时需要入队。 */
export function shouldEnqueueTask(planTime: Date | string | null | undefined, now = new Date()): boolean {
    if (!isNotEmpty(planTime)) return true
    return parsePlanTime(planTime).getTime() - now.getTime() < topology.SMS_TASK_ENQUEUE_WINDOW_MS
}

/** 已经到点或没有计划时间时延迟为 0，直接进入到点队列。 */
export function taskEnqueueDelayMs(planTime: Date | string | null | undefined, now = new Date()): number {
    if (!isNotEmpty(planTime)) return 0
    return Math.max(0, parsePlanTime(planTime).getTime() - now.getTime())
}

@Injectable()
export class SmsTaskQueueService {
    private readonly logger = new Logger(SmsTaskQueueService.name)

    constructor(
        @InjectRepository(Schema.TbSmsTask) private readonly repository: Repository<Schema.TbSmsTask>,
        private readonly database: DataBaseService,
        private readonly rabbitmqService: RabbitmqService
    ) {}

    /** 新增或编辑后尝试入队。发布失败只记日志，留给每小时扫描补投。 */
    public async enqueueAfterSave(task: Schema.TbSmsTask): Promise<void> {
        try {
            await this.enqueue(task)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            this.logger.error(`短信任务入队失败，等待每小时扫描补投：taskKeyId=${task.keyId}，version=${task.version}，原因=${message}`)
        }
    }

    /** 扫描待发送且进入 3 小时窗口、当前版本尚未入队的任务。 */
    public async enqueueDue(now = new Date()): Promise<SmsTaskEnqueueResult> {
        const deadline = new Date(now.getTime() + topology.SMS_TASK_ENQUEUE_WINDOW_MS)
        const failed = new Set<number>()
        const result: SmsTaskEnqueueResult = { scanned: 0, enqueued: 0, skipped: 0 }
        while (true) {
            const tasks = await this.findDue(deadline, [...failed])
            if (tasks.length === 0) break
            for (const task of tasks) {
                result.scanned += 1
                try {
                    const outcome = await this.enqueue(task, now)
                    if (outcome === 'enqueued') result.enqueued += 1
                    else result.skipped += 1
                } catch (error) {
                    failed.add(task.keyId)
                    result.skipped += 1
                    const message = error instanceof Error ? error.message : String(error)
                    this.logger.error(`短信任务入队失败：taskKeyId=${task.keyId}，version=${task.version}，原因=${message}`)
                }
            }
        }
        return result
    }

    /** 按剩余时间重新发布当前版本。已经入队的任务提前被投递时使用，不改 taskVersion。 */
    public async republish(task: Schema.TbSmsTask, now = new Date()): Promise<void> {
        await this.publish(task, now)
    }

    /** 发布当前版本。已经入队或还没进入窗口时跳过。 */
    public async enqueue(task: Schema.TbSmsTask, now = new Date()): Promise<'enqueued' | 'skipped'> {
        if (!shouldEnqueueTask(task.planTime, now)) return 'skipped'
        if (task.taskVersion != null && Number(task.taskVersion) === Number(task.version)) return 'skipped'
        await this.publish(task, now)
        await this.repository.update({ keyId: task.keyId, version: task.version }, { taskVersion: task.version })
        return 'enqueued'
    }

    private async publish(task: Schema.TbSmsTask, now: Date): Promise<void> {
        const delay = Math.ceil(taskEnqueueDelayMs(task.planTime, now))
        const payload: SmsTaskQueuePayload = { taskKeyId: task.keyId, version: Number(task.version) }
        const messageId = `${task.keyId}:${task.version}`
        if (delay <= 0) {
            await this.rabbitmqService.publish(topology.SMS_TASK_EXCHANGE, topology.SMS_TASK_FIRE_ROUTING_KEY, payload, { messageId })
            this.logger.log(`短信任务已入队：taskKeyId=${task.keyId}，version=${task.version}，delay=${delay}ms`)
            return
        }
        const queue = topology.smsTaskDelayQueue(task.keyId, Number(task.version))
        await this.rabbitmqService.assertQueue(queue, {
            durable: true,
            messageTtl: delay,
            expires: delay + topology.SMS_TASK_DELAY_QUEUE_GRACE_MS,
            deadLetterExchange: topology.SMS_TASK_EXCHANGE,
            deadLetterRoutingKey: topology.SMS_TASK_FIRE_ROUTING_KEY
        })
        await this.rabbitmqService.publish('', queue, payload, { messageId })
        this.logger.log(`短信任务已入队：taskKeyId=${task.keyId}，version=${task.version}，delay=${delay}ms`)
    }

    private async findDue(deadline: Date, excludedKeyIds: number[]): Promise<Schema.TbSmsTask[]> {
        return this.database.builder(this.repository, qb => {
            qb.where('t.status = :status', { status: Schema.TbSmsTaskStatus.PENDING })
                .andWhere('(t.planTime IS NULL OR t.planTime < :deadline)', { deadline })
                .andWhere('(t.taskVersion IS NULL OR t.taskVersion < t.version)')
            if (excludedKeyIds.length > 0) qb.andWhere('t.keyId NOT IN (:...excludedKeyIds)', { excludedKeyIds })
            return qb.orderBy('t.keyId', 'ASC').take(100).getMany()
        })
    }
}
