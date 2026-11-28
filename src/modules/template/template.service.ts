import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository, DataBaseService, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import { type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { AffectedResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { SmsAppUtilsService } from '@/modules/app/app.utils.service'
import { SmsTemplateUtilsService } from '@/modules/template/template.utils.service'
import * as SmsTemplateDto from '@/modules/template/dto/template.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class SmsTemplateService {
    constructor(
        @InjectRepository(Schema.TbSmsTemplate) private readonly repository: Repository<Schema.TbSmsTemplate>,
        private readonly database: DataBaseService,
        private readonly smsAppUtilsService: SmsAppUtilsService,
        private readonly smsTemplateUtilsService: SmsTemplateUtilsService
    ) {}

    /** 短信模板静态枚举。 */
    public async httpBaseSmsTemplateEnums(): Promise<SmsTemplateDto.SmsTemplateEnumsResponseDto> {
        return {
            typeOptions: Schema.TbSmsAppTypeDefinition.options,
            auditOptions: Schema.TbSmsTemplateAuditDefinition.options
        }
    }

    /** 当前登录客户新增短信模板。类型跟随应用，新建后进入待审核。 */
    public async httpBaseSmsCreateMineTemplate(
        principal: AuthPrincipal,
        body: SmsTemplateDto.CreateMineSmsTemplateDto
    ): Promise<SmsTemplateDto.SmsTemplateResponseDto> {
        const userKeyId = this.resolveCustomerKeyId(principal)
        const app = await this.smsAppUtilsService.findRequired(body.appKeyId)
        this.assertCustomerApp(app, userKeyId)
        const queryRunner = await this.database.transaction()
        let lockAcquired = false
        try {
            lockAcquired = await this.smsTemplateUtilsService.acquireCreateLock(queryRunner)
            if (!lockAcquired) {
                throw new ConflictException('短信模板创建繁忙，请稍后重试')
            }
            const manager = queryRunner.manager
            const template = manager.create(Schema.TbSmsTemplate, {
                userKeyId,
                appKeyId: app.keyId,
                templateId: await this.smsTemplateUtilsService.generateTemplateId(manager),
                templateName: body.templateName.trim(),
                type: app.type,
                audit: Schema.TbSmsTemplateAudit.PENDING,
                content: body.content,
                htmlContent: body.htmlContent,
                createBy: principal.uid,
                modifyBy: principal.uid
            })
            const response = await manager.save(template)
            await queryRunner.commitTransaction()
            return response
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction()
            }
            throw error
        } finally {
            try {
                if (lockAcquired) {
                    await this.smsTemplateUtilsService.releaseCreateLock(queryRunner)
                }
            } finally {
                await queryRunner.release()
            }
        }
    }

    /** 当前登录客户更新自己的短信模板。已通过审核的模板不能再改。 */
    public async httpBaseSmsUpdateMineTemplate(
        principal: AuthPrincipal,
        body: SmsTemplateDto.UpdateMineSmsTemplateDto
    ): Promise<SmsTemplateDto.SmsTemplateResponseDto> {
        const userKeyId = this.resolveCustomerKeyId(principal)
        return this.repository.manager.transaction(async manager => {
            const template = await this.smsTemplateUtilsService.findRequired(body.keyId, manager)
            this.assertCustomerTemplate(template, userKeyId)
            if (template.audit === Schema.TbSmsTemplateAudit.PASSED) {
                throw new ConflictException('已通过审核的短信模板不能修改')
            }
            if (template.audit === Schema.TbSmsTemplateAudit.DISABLED) {
                throw new ConflictException('已禁用的短信模板不能修改')
            }
            manager.merge(Schema.TbSmsTemplate, template, {
                templateName: body.templateName.trim(),
                content: body.content,
                htmlContent: body.htmlContent,
                audit: Schema.TbSmsTemplateAudit.PENDING,
                rejectReason: null,
                modifyBy: principal.uid
            })
            return manager.save(template)
        })
    }

    /** 当前登录客户分页查询自己的短信模板。 */
    public async httpBaseSmsColumnMineTemplate(
        principal: AuthPrincipal,
        body: SmsTemplateDto.ListMineSmsTemplateDto
    ): Promise<PageResult<SmsTemplateDto.SmsTemplateResponseDto>> {
        const userKeyId = this.resolveCustomerKeyId(principal)
        return this.database.builder(this.repository, async qb => {
            qb.andWhere('t.userKeyId = :userKeyId', { userKeyId })
            if (isNotEmpty(body.appKeyId)) {
                qb.andWhere('t.appKeyId = :appKeyId', { appKeyId: body.appKeyId })
            }
            if (isNotEmpty(body.templateId?.trim())) {
                qb.andWhere('t.templateId LIKE :templateId', { templateId: `%${body.templateId.trim()}%` })
            }
            if (isNotEmpty(body.templateName?.trim())) {
                qb.andWhere('t.templateName LIKE :templateName', { templateName: `%${body.templateName.trim()}%` })
            }
            if (isNotEmpty(body.type)) {
                qb.andWhere('t.type = :type', { type: body.type })
            }
            if (isNotEmpty(body.audit)) {
                qb.andWhere('t.audit = :audit', { audit: body.audit })
            }
            qb.orderBy('t.createTime', 'DESC')
                .skip((body.page - 1) * body.size)
                .take(body.size)
            const [list, total] = await qb.getManyAndCount()
            return { page: body.page, size: body.size, total, list }
        })
    }

    /** 当前登录客户查询已通过审核的模板，供发送页选择。 */
    public async httpBaseSmsSelectMineTemplate(
        principal: AuthPrincipal,
        body: SmsTemplateDto.SelectMineSmsTemplateDto
    ): Promise<SmsTemplateDto.SmsTemplateResponseDto[]> {
        const userKeyId = this.resolveCustomerKeyId(principal)
        return this.database.builder(this.repository, async qb => {
            qb.andWhere('t.userKeyId = :userKeyId AND t.audit = :audit', { userKeyId, audit: Schema.TbSmsTemplateAudit.PASSED })
            if (isNotEmpty(body.appKeyId)) {
                qb.andWhere('t.appKeyId = :appKeyId', { appKeyId: body.appKeyId })
            }
            return qb.orderBy('t.createTime', 'DESC').getMany()
        })
    }

    /** 当前登录客户删除自己的短信模板。已通过审核的模板不能删除。 */
    public async httpBaseSmsDeleteMineTemplate(
        principal: AuthPrincipal,
        body: SmsTemplateDto.DeleteMineSmsTemplateDto
    ): Promise<AffectedResponseDataDto> {
        const userKeyId = this.resolveCustomerKeyId(principal)
        return this.repository.manager.transaction(async manager => {
            const template = await this.smsTemplateUtilsService.findRequired(body.keyId, manager)
            this.assertCustomerTemplate(template, userKeyId)
            if (template.audit === Schema.TbSmsTemplateAudit.PASSED) {
                throw new ConflictException('已通过审核的短信模板不能删除')
            }
            if (template.audit === Schema.TbSmsTemplateAudit.DISABLED) {
                throw new ConflictException('已禁用的短信模板不能删除')
            }
            const result = await manager.delete(Schema.TbSmsTemplate, { keyId: template.keyId })
            return { affected: result.affected ?? 0 }
        })
    }

    /** 网关把 C 端客户主键放在 uid。 */
    private resolveCustomerKeyId(principal: AuthPrincipal): number {
        const userKeyId = Number(principal.uid)
        if (!Number.isInteger(userKeyId) || userKeyId < 1) {
            throw new ForbiddenException('当前登录客户无效')
        }
        return userKeyId
    }

    private assertCustomerApp(app: Schema.TbSmsApp, userKeyId: number): void {
        if (app.userKeyId !== userKeyId) {
            throw new ForbiddenException('无权使用该短信应用')
        }
    }

    private assertCustomerTemplate(template: Schema.TbSmsTemplate, userKeyId: number): void {
        if (template.userKeyId !== userKeyId) {
            throw new ForbiddenException('无权操作该短信模板')
        }
    }
}
