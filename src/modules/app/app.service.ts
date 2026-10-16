import { ConflictException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { FeignClientCrmManager, resolveFeignServiceAuthorization } from '@wlisfes/chat-web-base-schema/feign'
import { SmsAppUtilsService } from '@/modules/app/app.utils.service'
import * as SmsAppDto from '@/modules/app/dto/app.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

import { InjectRepository, DataBaseService, Repository } from '@wlisfes/chat-web-base-schema/database'
import { PageResult, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'

@Injectable()
export class SmsAppService {
    private readonly logger = new Logger(SmsAppService.name)

    constructor(
        @InjectRepository(Schema.TbSmsApp) private readonly repository: Repository<Schema.TbSmsApp>,
        private readonly database: DataBaseService,
        private readonly smsAppUtilsService: SmsAppUtilsService,
        private readonly crmClient: FeignClientCrmManager,
        private readonly configService: ConfigService
    ) {}

    /**客户短信应用静态枚举。*/
    public async httpBaseSmsAppEnums(): Promise<SmsAppDto.SmsAppEnumsResponseDto> {
        return {
            typeOptions: Schema.TbSmsAppTypeDefinition.options,
            statusOptions: Schema.TbSmsAppStatusDefinition.options
        }
    }

    /**新增客户短信应用。*/
    public async httpBaseSmsCreateApp(principal: AuthPrincipal, body: SmsAppDto.CreateSmsAppDto): Promise<SmsAppDto.SmsAppResponseDto> {
        // 客户与配置归属 CRM，通过服务间凭据查询；应用数量上限仍由 SMS 创建锁内的行锁校验。
        const serviceAuthorization = resolveFeignServiceAuthorization(this.configService)
        const [user, config] = await Promise.all([
            this.crmClient.httpBaseCrmUserResolver(serviceAuthorization, { keyId: body.userKeyId }),
            this.crmClient.httpBaseCrmUserConfigResolver(serviceAuthorization, { userKeyId: body.userKeyId })
        ])
        const queryRunner = await this.database.transaction()
        let lockAcquired = false
        try {
            lockAcquired = await this.smsAppUtilsService.acquireCreateLock(queryRunner)
            if (!lockAcquired) {
                throw new ConflictException('短信应用创建繁忙，请稍后重试')
            }
            const manager = queryRunner.manager
            const apps = await this.smsAppUtilsService.lockUserApps(manager, body.userKeyId)
            if (apps.length >= config.smsAppLimit) {
                throw new ConflictException(`该客户最多创建${config.smsAppLimit}个短信应用`)
            }
            const app = manager.create(Schema.TbSmsApp, {
                userKeyId: user.keyId,
                appId: await this.smsAppUtilsService.generateAppId(manager),
                secret: this.smsAppUtilsService.encryptSecret(this.smsAppUtilsService.generateSecret()),
                appName: this.smsAppUtilsService.generateAppName(apps),
                appAlias: await this.smsAppUtilsService.generateAppAlias(manager, principal.number, body.type),
                status: Schema.TbSmsAppStatus.INACTIVE,
                type: body.type,
                pushUrl: body.pushUrl,
                remark: body.remark,
                createBy: principal.uid,
                modifyBy: principal.uid
            })
            const response = this.smsAppUtilsService.sanitize(await manager.save(app))
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
                    await this.smsAppUtilsService.releaseCreateLock(queryRunner)
                }
            } finally {
                await queryRunner.release()
            }
        }
    }

    /**更新客户短信应用。*/
    public async httpBaseSmsUpdateApp(principal: AuthPrincipal, body: SmsAppDto.UpdateSmsAppDto): Promise<SmsAppDto.SmsAppResponseDto> {
        return this.repository.manager.transaction(async manager => {
            const app = await this.smsAppUtilsService.findRequired(body.keyId, manager)
            manager.merge(Schema.TbSmsApp, app, {
                status: body.status,
                type: body.type,
                pushUrl: body.pushUrl,
                remark: body.remark,
                modifyBy: principal.uid
            })
            return this.smsAppUtilsService.sanitize(await manager.save(app))
        })
    }

    /**查看客户短信应用密钥明文。*/
    public async httpBaseSmsAppSecretResolver(
        principal: AuthPrincipal,
        body: SmsAppDto.SmsAppSecretDto
    ): Promise<SmsAppDto.SmsAppSecretResponseDto> {
        const app = await this.smsAppUtilsService.findSecretRequired(body.keyId)
        const secret = this.smsAppUtilsService.decryptSecret(app.secret)
        this.logger.log(`查看短信应用密钥 uid=${principal.uid} keyId=${app.keyId} appId=${app.appId}`)
        return { appId: app.appId, secret }
    }

    /**重置客户短信应用密钥，仅在本次响应中返回新密钥明文。*/
    public async httpBaseSmsResetAppSecret(
        principal: AuthPrincipal,
        body: SmsAppDto.SmsAppSecretDto
    ): Promise<SmsAppDto.SmsAppSecretResponseDto> {
        const secret = this.smsAppUtilsService.generateSecret()
        const app = await this.repository.manager.transaction(async manager => {
            const app = await this.smsAppUtilsService.findSecretRequired(body.keyId, manager)
            manager.merge(Schema.TbSmsApp, app, {
                secret: this.smsAppUtilsService.encryptSecret(secret),
                modifyBy: principal.uid
            })
            return manager.save(app)
        })
        this.logger.log(`重置短信应用密钥 uid=${principal.uid} keyId=${app.keyId} appId=${app.appId}`)
        return { appId: app.appId, secret }
    }

    /**分页查询客户短信应用。*/
    public async httpBaseSmsColumnApp(body: SmsAppDto.ListSmsAppDto): Promise<PageResult<SmsAppDto.SmsAppResponseDto>> {
        return this.database.builder(this.repository, async qb => {
            if (isNotEmpty(body.userKeyId)) {
                qb.andWhere('t.userKeyId = :userKeyId', { userKeyId: body.userKeyId })
            }
            if (isNotEmpty(body.appId?.trim())) {
                qb.andWhere('t.appId LIKE :appId', { appId: `%${body.appId.trim()}%` })
            }
            if (isNotEmpty(body.appAlias?.trim())) {
                qb.andWhere('t.appAlias LIKE :appAlias', { appAlias: `%${body.appAlias.trim()}%` })
            }
            if (isNotEmpty(body.status)) {
                qb.andWhere('t.status = :status', { status: body.status })
            }
            if (isNotEmpty(body.type)) {
                qb.andWhere('t.type = :type', { type: body.type })
            }
            qb.orderBy('t.createTime', 'DESC')
                .skip((body.page - 1) * body.size)
                .take(body.size)
            const [list, total] = await qb.getManyAndCount()
            return { page: body.page, size: body.size, total, list: list.map(item => this.smsAppUtilsService.sanitize(item)) }
        })
    }

    /**查询客户短信应用下拉选项。*/
    public async httpBaseSmsSelectApp(body: SmsAppDto.SelectSmsAppDto): Promise<SmsAppDto.SmsAppResponseDto[]> {
        return this.database.builder(this.repository, async qb => {
            const list = await qb.where('t.userKeyId = :userKeyId', { userKeyId: body.userKeyId }).orderBy('t.createTime', 'DESC').getMany()
            return list.map(item => this.smsAppUtilsService.sanitize(item))
        })
    }
}
