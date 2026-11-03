import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository, DataBaseService, EntityManager, Repository } from '@wlisfes/chat-web-base-schema/database'
import { isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** 把计划发送时间解析成时间对象。库内读出的值可能已经是格式化字符串。 */
export function parsePlanTime(value: Date | string): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value
    const text = String(value).trim()
    const normalized = text.includes('T') ? text : text.replace(' ', 'T')
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) {
        throw new BadRequestException('计划发送时间格式错误')
    }
    return date
}

/** 空的计划时间表示立即发送，视为已经到点。 */
export function isPlanTimeDue(planTime: Date | string | null | undefined, now = new Date()): boolean {
    if (!isNotEmpty(planTime)) return true
    return parsePlanTime(planTime).getTime() <= now.getTime()
}

@Injectable()
export class SmsTaskUtilsService {
    constructor(
        @InjectRepository(Schema.TbSmsTask) private readonly repository: Repository<Schema.TbSmsTask>,
        private readonly database: DataBaseService
    ) {}

    /** 查询必需的短信任务。传入事务管理器时加写锁。 */
    public async findRequired(keyId: number, manager?: EntityManager): Promise<Schema.TbSmsTask> {
        const repository = (manager ?? this.repository.manager).getRepository(Schema.TbSmsTask)
        const task = await this.database.builder(repository, qb => {
            qb.where('t.keyId = :keyId', { keyId })
            if (isNotEmpty(manager)) qb.setLock('pessimistic_write')
            return qb.getOne()
        })
        if (!task) throw new NotFoundException('短信任务不存在')
        return task
    }

    /** 待发送任务才允许修改或删除。 */
    public assertPending(task: Schema.TbSmsTask): void {
        if (task.status !== Schema.TbSmsTaskStatus.PENDING) {
            throw new ConflictException('只有待发送任务可以修改或删除')
        }
    }

    /** 版本不一致说明任务已被改期或并发更新。 */
    public assertVersion(task: Schema.TbSmsTask, version: number): void {
        if (Number(task.version) !== Number(version)) {
            throw new ConflictException('短信任务版本已变化，请刷新后重试')
        }
    }

    /** 未到发送时间才允许改期。新时间不能早于当前时间。 */
    public assertPlanTimeChange(task: Schema.TbSmsTask, planTime: Date | string, now = new Date()): Date {
        if (isPlanTimeDue(task.planTime, now)) {
            throw new ConflictException('已到发送时间，不能修改发送时间')
        }
        const next = parsePlanTime(planTime)
        if (next.getTime() < now.getTime()) {
            throw new BadRequestException('新的发送时间不能早于当前时间')
        }
        return next
    }
}
