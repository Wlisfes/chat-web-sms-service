import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository, DataBaseService, Repository } from '@wlisfes/chat-web-base-schema/database'
import { FeignClientCrmManager, resolveFeignServiceAuthorization } from '@wlisfes/chat-web-base-schema/feign'
import { PageResult, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import { type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { AffectedResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { ConfigService } from '@nestjs/config'
import { SmsAppUtilsService } from '@/modules/app/app.utils.service'
import { SmsTaskUtilsService } from '@/modules/task/task.utils.service'
import * as SmsTaskDto from '@/modules/task/dto/task.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class SmsTaskService {
    constructor(
        @InjectRepository(Schema.TbSmsTask) private readonly repository: Repository<Schema.TbSmsTask>,
        private readonly database: DataBaseService,
        private readonly smsTaskUtilsService: SmsTaskUtilsService,
        private readonly smsAppUtilsService: SmsAppUtilsService,
        private readonly crmClient: FeignClientCrmManager,
        private readonly configService: ConfigService
    ) {}

    /** 短信任务静态枚举。 */
    public async httpBaseSmsTaskEnums(): Promise<SmsTaskDto.SmsTaskEnumsResponseDto> {
        return {
            statusOptions: Schema.TbSmsTaskStatusDefinition.options,
            sourceOptions: Schema.TbSmsTaskSourceDefinition.options,
            typeOptions: Schema.TbSmsAppTypeDefinition.options
        }
    }

    /** 新增短信任务。类型和客户、应用快照取自当前数据，不信任调用方传入。 */
    public async httpBaseSmsCreateTask(
        principal: AuthPrincipal,
        body: SmsTaskDto.CreateSmsTaskDto
    ): Promise<SmsTaskDto.SmsTaskResponseDto> {
        const serviceAuthorization = resolveFeignServiceAuthorization(this.configService)
        const user = await this.crmClient.httpBaseCrmUserResolver(serviceAuthorization, { keyId: body.userKeyId })
        const app = await this.smsAppUtilsService.findRequired(body.appKeyId)
        if (app.userKeyId !== body.userKeyId) {
            throw new BadRequestException('短信应用不属于该客户')
        }
        if (app.status !== Schema.TbSmsAppStatus.ACTIVE) {
            throw new BadRequestException('短信应用未激活，不能创建任务')
        }
        const task = this.repository.create({
            taskName: body.taskName.trim(),
            userKeyId: user.keyId,
            userName: user.name,
            userAlias: user.alias,
            appKeyId: app.keyId,
            appId: app.appId,
            appAlias: app.appAlias,
            type: app.type,
            content: body.content?.trim(),
            templateId: body.templateId?.trim(),
            currency: user.currency,
            planTime: body.planTime,
            status: Schema.TbSmsTaskStatus.PENDING,
            source: body.source,
            fileKey: body.fileKey?.trim(),
            fileName: body.fileName?.trim(),
            totalCount: 0,
            successCount: 0,
            failCount: 0,
            cancelCount: 0,
            chargeCount: 0,
            amount: 0,
            version: 1,
            remark: body.remark?.trim(),
            createBy: principal.uid,
            modifyBy: principal.uid
        })
        return this.repository.save(task)
    }

    /** 更新待发送任务。只有未到发送时间时才能改计划时间，并递增版本号。 */
    public async httpBaseSmsUpdateTask(
        principal: AuthPrincipal,
        body: SmsTaskDto.UpdateSmsTaskDto
    ): Promise<SmsTaskDto.SmsTaskResponseDto> {
        return this.repository.manager.transaction(async manager => {
            const task = await this.smsTaskUtilsService.findRequired(body.keyId, manager)
            this.smsTaskUtilsService.assertPending(task)
            this.smsTaskUtilsService.assertVersion(task, body.version)
            const changes = this.collectChanges(body)
            if (isNotEmpty(body.planTime)) {
                changes.planTime = this.smsTaskUtilsService.assertPlanTimeChange(task, body.planTime)
                changes.version = Number(task.version) + 1
            }
            if (Object.keys(changes).length === 0) {
                throw new BadRequestException('没有可更新的短信任务字段')
            }
            manager.merge(Schema.TbSmsTask, task, { ...changes, modifyBy: principal.uid })
            return manager.save(task)
        })
    }

    /** 查询短信任务详情。 */
    public async httpBaseSmsTaskResolver(body: SmsTaskDto.SmsTaskKeyDto): Promise<SmsTaskDto.SmsTaskResponseDto> {
        return this.smsTaskUtilsService.findRequired(body.keyId)
    }

    /** 分页查询短信任务。 */
    public async httpBaseSmsColumnTask(body: SmsTaskDto.ListSmsTaskDto): Promise<PageResult<SmsTaskDto.SmsTaskResponseDto>> {
        return this.database.builder(this.repository, async qb => {
            if (isNotEmpty(body.userKeyId)) qb.andWhere('t.userKeyId = :userKeyId', { userKeyId: body.userKeyId })
            if (isNotEmpty(body.appKeyId)) qb.andWhere('t.appKeyId = :appKeyId', { appKeyId: body.appKeyId })
            if (isNotEmpty(body.status)) qb.andWhere('t.status = :status', { status: body.status })
            if (isNotEmpty(body.source)) qb.andWhere('t.source = :source', { source: body.source })
            if (isNotEmpty(body.type)) qb.andWhere('t.type = :type', { type: body.type })
            if (isNotEmpty(body.taskName?.trim())) qb.andWhere('t.taskName LIKE :taskName', { taskName: `%${body.taskName.trim()}%` })
            qb.orderBy('t.createTime', 'DESC')
                .skip((body.page - 1) * body.size)
                .take(body.size)
            const [list, total] = await qb.getManyAndCount()
            return { page: body.page, size: body.size, total, list }
        })
    }

    /** 删除待发送任务。已开始发送的任务保留记录，不能物理删除。 */
    public async httpBaseSmsDeleteTask(body: SmsTaskDto.DeleteSmsTaskDto): Promise<AffectedResponseDataDto> {
        return this.repository.manager.transaction(async manager => {
            const task = await this.smsTaskUtilsService.findRequired(body.keyId, manager)
            this.smsTaskUtilsService.assertPending(task)
            this.smsTaskUtilsService.assertVersion(task, body.version)
            const result = await manager.delete(Schema.TbSmsTask, { keyId: task.keyId, version: task.version })
            return { affected: result.affected ?? 0 }
        })
    }

    /** 收集调用方实际传入的可修改字段。 */
    private collectChanges(body: SmsTaskDto.UpdateSmsTaskDto): Partial<Schema.TbSmsTask> {
        const changes: Partial<Schema.TbSmsTask> = {}
        if (body.taskName !== undefined) changes.taskName = body.taskName.trim()
        if (body.content !== undefined) changes.content = body.content?.trim()
        if (body.templateId !== undefined) changes.templateId = body.templateId?.trim()
        if (body.fileKey !== undefined) changes.fileKey = body.fileKey?.trim()
        if (body.fileName !== undefined) changes.fileName = body.fileName?.trim()
        if (body.remark !== undefined) changes.remark = body.remark?.trim()
        return changes
    }
}
