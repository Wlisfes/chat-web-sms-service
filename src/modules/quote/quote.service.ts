import { FeignClientCrmManager, FeignClientFinanceManager, resolveFeignServiceAuthorization } from '@wlisfes/chat-web-base-schema/feign'
import { InjectRepository, DataBaseService, In, Repository } from '@wlisfes/chat-web-base-schema/database'
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { AffectedResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { PageResult, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import { SmsQuoteUtilsService } from '@/modules/quote/quote.utils.service'
import { type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { SmsAppUtilsService } from '@/modules/app/app.utils.service'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import * as SmsQuoteDto from '@/modules/quote/dto/quote.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class SmsQuoteService {
    constructor(
        @InjectRepository(Schema.TbSmsQuoteDraft) private readonly draftRepository: Repository<Schema.TbSmsQuoteDraft>,
        @InjectRepository(Schema.TbSmsQuote) private readonly quoteRepository: Repository<Schema.TbSmsQuote>,
        private readonly database: DataBaseService,
        private readonly smsAppUtilsService: SmsAppUtilsService,
        private readonly smsQuoteUtilsService: SmsQuoteUtilsService,
        private readonly crmClient: FeignClientCrmManager,
        private readonly financeClient: FeignClientFinanceManager,
        private readonly configService: ConfigService
    ) {}

    /**短信报价静态枚举。*/
    public async httpBaseSmsQuoteEnums(): Promise<SmsQuoteDto.SmsQuoteEnumsResponseDto> {
        return {
            changeStatusOptions: Schema.TbSmsQuoteDraftChangeStatusDefinition.options,
            sourceOptions: Schema.TbSmsQuoteDraftSourceDefinition.options,
            statusOptions: Schema.TbSmsQuoteStatusDefinition.options
        }
    }

    /**按 Feign 单次上限分批查询短信基础价格，并按入参顺序返回，缺失时抛错。*/
    private async findFrozenSmsRequired(serviceAuthorization: string, countryKeyIds: number[]) {
        const uniqueKeyIds = [...new Set(countryKeyIds)]
        const groups: number[][] = []
        for (let index = 0; index < uniqueKeyIds.length; index += 100) {
            groups.push(uniqueKeyIds.slice(index, index + 100))
        }
        const results = await Promise.all(
            groups.map(keyIds => this.financeClient.httpBaseFinanceColumnFrozenSmsResolver(serviceAuthorization, { countryKeyIds: keyIds }))
        )
        const rateByCountry = new Map(results.flat().map(rate => [rate.countryKeyId, rate]))
        const missingKeyIds = uniqueKeyIds.filter(keyId => !rateByCountry.has(keyId))
        if (missingKeyIds.length > 0) {
            throw new BadRequestException(`以下国家/地区尚未配置短信基础价格：${missingKeyIds.join(',')}`)
        }
        return uniqueKeyIds.map(keyId => rateByCountry.get(keyId)!)
    }

    /**按 Feign 单次上限分批查询 CRM 客户摘要，缺失客户不阻断列表展示。*/
    private async findCrmUsers(keyIds: number[]): Promise<Array<{ keyId: number; name: string; alias: string }>> {
        const uniqueKeyIds = [...new Set(keyIds)]
        if (uniqueKeyIds.length === 0) {
            return []
        }
        const serviceAuthorization = resolveFeignServiceAuthorization(this.configService)
        const groups: number[][] = []
        for (let index = 0; index < uniqueKeyIds.length; index += 100) {
            groups.push(uniqueKeyIds.slice(index, index + 100))
        }
        const results = await Promise.all(
            groups.map(group => this.crmClient.httpBaseCrmColumnUserResolver(serviceAuthorization, { keyIds: group }))
        )
        return results.flat().map(user => ({ keyId: user.keyId, name: user.name, alias: user.alias }))
    }

    /**初始化短信报价草稿批次。*/
    public async httpBaseSmsInitQuoteDraft(
        principal: AuthPrincipal,
        body: SmsQuoteDto.InitSmsQuoteDraftDto
    ): Promise<SmsQuoteDto.InitSmsQuoteDraftResponseDto> {
        // CRM 与 Finance 均通过服务间 Feign 调用，统一使用服务凭据，不转发终端用户 Token。
        const serviceAuthorization = resolveFeignServiceAuthorization(this.configService)
        const [user, rates] = await Promise.all([
            this.crmClient.httpBaseCrmUserResolver(serviceAuthorization, { keyId: body.userKeyId }),
            this.findFrozenSmsRequired(serviceAuthorization, body.countryKeyIds)
        ])
        const app = await this.smsAppUtilsService.findForUser(body.userKeyId, body.appId)
        const exchange = await this.financeClient.httpBaseFinanceCurrencyExchangeResolver(serviceAuthorization, {
            currency: user.currency
        })

        return this.draftRepository.manager.transaction(async manager => {
            const draftRepository = manager.getRepository(Schema.TbSmsQuoteDraft)
            const quoteRepository = manager.getRepository(Schema.TbSmsQuote)
            const countryKeyIds = rates.map(rate => rate.countryKeyId)
            const existingQuotes =
                countryKeyIds.length === 0
                    ? []
                    : await quoteRepository
                          .createQueryBuilder('t')
                          .where('t.userKeyId = :userKeyId AND t.appKeyId = :appKeyId', {
                              userKeyId: user.keyId,
                              appKeyId: app.keyId
                          })
                          .andWhere('t.countryKeyId IN (:...countryKeyIds)', { countryKeyIds })
                          .andWhere('t.status <> :deleted', { deleted: Schema.TbSmsQuoteStatus.DELETED })
                          .andWhere('(t.expiryTime IS NULL OR t.expiryTime > :now)', { now: new Date() })
                          .orderBy('t.effectiveTime', 'DESC')
                          .addOrderBy('t.keyId', 'DESC')
                          .getMany()
            const existingByCountry = new Map<number, Schema.TbSmsQuote>()
            for (const quote of existingQuotes) {
                if (!existingByCountry.has(quote.countryKeyId)) {
                    existingByCountry.set(quote.countryKeyId, quote)
                }
            }
            const draftBatchId = randomUUID()
            const drafts = rates.map(rate => {
                const existing = existingByCountry.get(rate.countryKeyId)
                const upUsd = existing?.upUsd ?? rate.upUsd
                const downUsd = existing?.downUsd ?? rate.downUsd
                return draftRepository.create({
                    draftBatchId,
                    userKeyId: user.keyId,
                    appKeyId: app.keyId,
                    appId: app.appId,
                    userAlias: user.alias,
                    appAlias: app.appAlias,
                    countryKeyId: rate.countryKeyId,
                    code: rate.code,
                    mcc: rate.mcc,
                    upUsd,
                    downUsd,
                    currency: exchange.currency,
                    upLocal: Math.round(upUsd * exchange.rate),
                    downLocal: Math.round(downUsd * exchange.rate),
                    exchangeRate: exchange.rate,
                    exchangeDate: exchange.date,
                    effectiveTime: existing?.effectiveTime,
                    expiryTime: existing?.expiryTime,
                    source: existing ? Schema.TbSmsQuoteDraftSource.EXISTING : Schema.TbSmsQuoteDraftSource.ADDITION,
                    remark: existing?.remark,
                    createBy: principal.uid,
                    modifyBy: principal.uid
                })
            })
            await draftRepository.save(drafts)
            return { draftBatchId, total: drafts.length }
        })
    }

    /**分页查询短信报价草稿。*/
    public async httpBaseSmsColumnQuoteDraft(
        body: SmsQuoteDto.ListSmsQuoteDraftDto
    ): Promise<PageResult<SmsQuoteDto.SmsQuoteDraftListItemResponseDto>> {
        return this.database.builder(this.draftRepository, async qb => {
            qb.where('t.draftBatchId = :draftBatchId', { draftBatchId: body.draftBatchId })
                .orderBy('t.countryKeyId', 'ASC')
                .skip((body.page - 1) * body.size)
                .take(body.size)
            const [list, total] = await qb.getManyAndCount()
            return {
                page: body.page,
                size: body.size,
                total,
                list: list.map(item => {
                    const existing = item.source === Schema.TbSmsQuoteDraftSource.EXISTING
                    const changeStatus = existing
                        ? Schema.TbSmsQuoteDraftChangeStatus.UNCHANGED
                        : Schema.TbSmsQuoteDraftChangeStatus.ADDITION
                    return { ...item, upStatus: changeStatus, downStatus: changeStatus }
                })
            }
        })
    }

    /**更新短信报价草稿。*/
    public async httpBaseSmsUpdateQuoteDraft(
        principal: AuthPrincipal,
        body: SmsQuoteDto.UpdateSmsQuoteDraftDto
    ): Promise<Schema.TbSmsQuoteDraft> {
        return this.draftRepository.manager.transaction(async manager => {
            const draft = await this.smsQuoteUtilsService.findDraft(body.keyId, manager)
            manager.merge(Schema.TbSmsQuoteDraft, draft, {
                upUsd: body.upUsd,
                downUsd: body.downUsd,
                upLocal: Math.round(body.upUsd * Number(draft.exchangeRate)),
                downLocal: Math.round(body.downUsd * Number(draft.exchangeRate)),
                effectiveTime: isNotEmpty(body.effectiveTime) ? new Date(body.effectiveTime) : draft.effectiveTime,
                expiryTime: isNotEmpty(body.expiryTime) ? new Date(body.expiryTime) : draft.expiryTime,
                remark: body.remark,
                modifyBy: principal.uid
            })
            return manager.save(draft)
        })
    }

    /**批量删除短信报价草稿。*/
    public async httpBaseSmsDeleteQuoteDraft(body: SmsQuoteDto.DeleteSmsQuoteDraftDto): Promise<AffectedResponseDataDto> {
        // 草稿只是发布前的临时数据，删除时直接物理删除，不再保留草稿状态。
        const result = await this.draftRepository.delete({ keyId: In([...new Set(body.keyIds)]) })
        return { affected: result.affected ?? 0 }
    }

    /**预览短信报价草稿批次。*/
    public async httpBaseSmsPreviewQuote(body: SmsQuoteDto.SmsQuoteDraftBatchDto): Promise<SmsQuoteDto.SmsQuotePreviewResponseDto> {
        const list = await this.smsQuoteUtilsService.getActiveDraftBatch(body.draftBatchId)
        return {
            draftBatchId: body.draftBatchId,
            userKeyId: list[0].userKeyId,
            appId: list[0].appId,
            currency: list[0].currency,
            total: list.length,
            list
        }
    }

    /**发布短信报价草稿批次。*/
    public async httpBaseSmsPublishQuote(
        principal: AuthPrincipal,
        body: SmsQuoteDto.SmsQuoteDraftBatchDto
    ): Promise<SmsQuoteDto.PublishSmsQuoteResponseDto> {
        const queryRunner = await this.database.transaction()
        const lockedScopes: Array<{ userKeyId: number; appKeyId: number }> = []
        try {
            const manager = queryRunner.manager
            const drafts = await this.smsQuoteUtilsService.getActiveDraftBatch(body.draftBatchId, manager, '没有可发布的报价草稿')
            const scopes = new Map<string, { userKeyId: number; appKeyId: number }>()
            for (const draft of drafts) {
                scopes.set(`${draft.userKeyId}:${draft.appKeyId}`, { userKeyId: draft.userKeyId, appKeyId: draft.appKeyId })
            }
            // 按固定顺序加锁，避免多个批次交叉发布时出现锁等待环。
            for (const [, scope] of [...scopes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
                const acquired = await this.smsQuoteUtilsService.acquireQuotePublishLock(queryRunner, scope.userKeyId, scope.appKeyId)
                if (!acquired) {
                    throw new ConflictException('报价发布繁忙，请稍后重试')
                }
                lockedScopes.push(scope)
            }
            const quoteRepository = manager.getRepository(Schema.TbSmsQuote)
            const publishedTime = new Date()
            const quotes: Schema.TbSmsQuote[] = []
            for (const draft of drafts) {
                const effectiveTime = isNotEmpty(draft.effectiveTime) ? new Date(draft.effectiveTime) : publishedTime
                const expiryTime = isNotEmpty(draft.expiryTime) ? new Date(draft.expiryTime) : null
                if (isNotEmpty(expiryTime) && expiryTime.getTime() <= effectiveTime.getTime()) {
                    throw new BadRequestException(`${draft.code} 报价失效时间必须晚于生效时间`)
                }
                const scope = {
                    userKeyId: draft.userKeyId,
                    appKeyId: draft.appKeyId,
                    countryKeyId: draft.countryKeyId,
                    deleted: Schema.TbSmsQuoteStatus.DELETED,
                    effectiveTime
                }
                // 新报价生效前尚未生效的旧报价会被替换，标记为已作废。
                await quoteRepository
                    .createQueryBuilder()
                    .update(Schema.TbSmsQuote)
                    .set({ status: Schema.TbSmsQuoteStatus.DELETED, modifyBy: principal.uid })
                    .where('userKeyId = :userKeyId AND appKeyId = :appKeyId AND countryKeyId = :countryKeyId', scope)
                    .andWhere('status <> :deleted AND effectiveTime >= :effectiveTime', scope)
                    .execute()
                // 仍覆盖新生效时间的旧报价只截断失效时间，保留历史价格，状态由时间实时计算。
                await quoteRepository
                    .createQueryBuilder()
                    .update(Schema.TbSmsQuote)
                    .set({ expiryTime: effectiveTime, modifyBy: principal.uid })
                    .where('userKeyId = :userKeyId AND appKeyId = :appKeyId AND countryKeyId = :countryKeyId', scope)
                    .andWhere('status <> :deleted AND effectiveTime < :effectiveTime', scope)
                    .andWhere('(expiryTime IS NULL OR expiryTime > :effectiveTime)', scope)
                    .execute()
                const quote = quoteRepository.create({
                    userKeyId: draft.userKeyId,
                    appKeyId: draft.appKeyId,
                    appId: draft.appId,
                    userAlias: draft.userAlias,
                    appAlias: draft.appAlias,
                    countryKeyId: draft.countryKeyId,
                    code: draft.code,
                    mcc: draft.mcc,
                    upUsd: draft.upUsd,
                    downUsd: draft.downUsd,
                    currency: draft.currency,
                    upLocal: draft.upLocal,
                    downLocal: draft.downLocal,
                    exchangeRate: draft.exchangeRate,
                    exchangeDate: draft.exchangeDate,
                    effectiveTime,
                    expiryTime,
                    publishedTime,
                    remark: draft.remark,
                    createBy: principal.uid,
                    modifyBy: principal.uid
                })
                quote.status = this.smsQuoteUtilsService.resolveQuoteStatus(quote, publishedTime)
                quotes.push(quote)
            }
            await quoteRepository.save(quotes)
            // 发布成功后草稿已转为正式报价，直接物理删除该批次草稿。
            await manager.getRepository(Schema.TbSmsQuoteDraft).delete({ draftBatchId: body.draftBatchId })
            await queryRunner.commitTransaction()
            return { draftBatchId: body.draftBatchId, published: quotes.length }
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction()
            }
            throw error
        } finally {
            try {
                for (const scope of lockedScopes) {
                    await this.smsQuoteUtilsService.releaseQuotePublishLock(queryRunner, scope.userKeyId, scope.appKeyId)
                }
            } finally {
                await queryRunner.release()
            }
        }
    }

    /**分页查询正式短信报价。*/
    public async httpBaseSmsColumnQuote(body: SmsQuoteDto.ListSmsQuoteDto): Promise<PageResult<SmsQuoteDto.SmsQuoteListItemResponseDto>> {
        const now = new Date()
        return this.database.builder(this.quoteRepository, async qb => {
            if (isNotEmpty(body.userKeyId)) {
                qb.andWhere('t.userKeyId = :userKeyId', { userKeyId: body.userKeyId })
            }
            if (isNotEmpty(body.userAlias?.trim())) {
                qb.andWhere('t.userAlias LIKE :userAlias', { userAlias: `%${body.userAlias.trim()}%` })
            }
            if (isNotEmpty(body.appId?.trim())) {
                qb.andWhere('t.appId = :appId', { appId: body.appId.trim() })
            }
            if (isNotEmpty(body.appAlias?.trim())) {
                qb.andWhere('t.appAlias LIKE :appAlias', { appAlias: `%${body.appAlias.trim()}%` })
            }
            if (isNotEmpty(body.code?.trim())) {
                qb.andWhere('t.code = :code', { code: body.code.trim() })
            }
            if (isNotEmpty(body.mcc?.trim())) {
                qb.andWhere('t.mcc LIKE :mcc', { mcc: `%${body.mcc.trim()}%` })
            }
            if (isNotEmpty(body.statuses) && body.statuses.length > 0) {
                this.smsQuoteUtilsService.whereQuoteStatuses(qb, body.statuses, now)
            }
            if (isNotEmpty(body.countryKeyIds) && body.countryKeyIds.length > 0) {
                qb.andWhere('t.countryKeyId IN (:...countryKeyIds)', { countryKeyIds: body.countryKeyIds })
            }
            qb.orderBy('t.publishedTime', 'DESC')
                .addOrderBy('t.keyId', 'DESC')
                .skip((body.page - 1) * body.size)
                .take(body.size)
            const [quotes, total] = await qb.getManyAndCount()
            const users = await this.findCrmUsers(quotes.map(quote => quote.userKeyId))
            const userByKeyId = new Map(users.map(user => [user.keyId, user]))
            return {
                page: body.page,
                size: body.size,
                total,
                list: quotes.map(quote => ({
                    ...quote,
                    status: this.smsQuoteUtilsService.resolveQuoteStatus(quote, now),
                    userOptions: userByKeyId.get(quote.userKeyId)
                })) as SmsQuoteDto.SmsQuoteListItemResponseDto[]
            }
        })
    }
}
