import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectRepository, Repository } from '@wlisfes/chat-web-base-schema/database'
import { RabbitmqService } from '@wlisfes/chat-web-base-schema/rabbitmq'
import { isPlanTimeDue } from '@/modules/task/task.utils.service'
import { SmsTaskQueueService, type SmsTaskQueuePayload } from '@/modules/task/task.queue.service'
import { SMS_TASK_FIRE_QUEUE } from '@/modules/task/task.topology'
import * as Schema from '@wlisfes/chat-web-base-schema'

/**
 * 短信任务到点消费者。
 * 版本不一致或任务已不是待发送时直接确认丢掉；还没到计划时间则按剩余时间重新入队。
 */
@Injectable()
export class SmsTaskConsumer implements OnApplicationBootstrap {
    private readonly logger = new Logger(SmsTaskConsumer.name)
    private tail: Promise<void> = Promise.resolve()

    constructor(
        @InjectRepository(Schema.TbSmsTask) private readonly repository: Repository<Schema.TbSmsTask>,
        private readonly rabbitmqService: RabbitmqService,
        private readonly smsTaskQueueService: SmsTaskQueueService
    ) {}

    public async onApplicationBootstrap(): Promise<void> {
        await this.rabbitmqService.consume<SmsTaskQueuePayload>(SMS_TASK_FIRE_QUEUE, async payload => {
            return this.fetchFire(payload)
        })
        this.logger.log(`已订阅短信任务到点队列：${SMS_TASK_FIRE_QUEUE}`)
    }

    /** 处理一条到点消息。本实例串行处理，避免同时改同一批任务状态。 */
    public async fetchFire(payload: SmsTaskQueuePayload): Promise<'ack' | 'reject'> {
        return this.oneByOne(() => this.handle(payload))
    }

    private async handle(payload: SmsTaskQueuePayload): Promise<'ack' | 'reject'> {
        if (!this.isPayload(payload)) {
            this.logger.error(`短信任务消息格式错误，已拒绝：${JSON.stringify(payload)}`)
            return 'reject'
        }
        const task = await this.repository.findOne({ where: { keyId: payload.taskKeyId } })
        if (!task || Number(task.version) !== Number(payload.version) || task.status !== Schema.TbSmsTaskStatus.PENDING) {
            this.logger.log(`丢弃短信任务消息：taskKeyId=${payload.taskKeyId}，version=${payload.version}`)
            return 'ack'
        }
        if (!isPlanTimeDue(task.planTime)) {
            await this.smsTaskQueueService.republish(task)
            this.logger.log(`短信任务未到发送时间，已按剩余时间重新入队：taskKeyId=${task.keyId}，version=${task.version}`)
            return 'ack'
        }
        const result = await this.repository.update(
            { keyId: task.keyId, version: task.version, status: Schema.TbSmsTaskStatus.PENDING },
            { status: Schema.TbSmsTaskStatus.SENDING, startTime: new Date() }
        )
        if (!result.affected) {
            this.logger.log(`短信任务已被其他实例处理：taskKeyId=${task.keyId}，version=${task.version}`)
            return 'ack'
        }
        this.logger.log(`短信任务已到点：taskKeyId=${task.keyId}，version=${task.version}`)
        return 'ack'
    }

    private isPayload(payload: SmsTaskQueuePayload): boolean {
        return Number.isInteger(payload?.taskKeyId) && payload.taskKeyId > 0 && Number.isInteger(payload?.version) && payload.version > 0
    }

    /** 本实例同时只处理一条；上一条失败不挡住下一条。 */
    private oneByOne<T>(work: () => Promise<T>): Promise<T> {
        const run = this.tail.then(work, work)
        this.tail = run.then(
            () => undefined,
            () => undefined
        )
        return run
    }
}
