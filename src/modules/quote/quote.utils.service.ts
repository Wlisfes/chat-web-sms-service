import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository, Brackets, DataBaseService, EntityManager } from '@wlisfes/chat-web-base-schema/database'
import { QueryRunner, Repository, SelectQueryBuilder } from '@wlisfes/chat-web-base-schema/database'
import { fetchShrinkNumber, isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class SmsQuoteUtilsService {
    constructor(
        @InjectRepository(Schema.TbSmsQuoteDraft) private readonly draftRepository: Repository<Schema.TbSmsQuoteDraft>,
        private readonly database: DataBaseService
    ) {}

    /**把报价记录中的 USD、本币价格字段转换为实际金额返回。*/
    public fetchPriceNode<T extends Pick<Schema.TbSmsQuoteDraft, 'upUsd' | 'downUsd' | 'upLocal' | 'downLocal'>>(node: T): T {
        return {
            ...node,
            upUsd: fetchShrinkNumber(node.upUsd),
            downUsd: fetchShrinkNumber(node.downUsd),
            upLocal: fetchShrinkNumber(node.upLocal),
            downLocal: fetchShrinkNumber(node.downLocal)
        }
    }

    /**查询客户应用在指定国家/地区的现行报价（未作废、未失效，按生效时间取最新一条），作为草稿价格变更的对比基准。*/
    public async findExistingQuoteMap(
        scope: { userKeyId: number; appKeyId: number; countryKeyIds: number[] },
        manager?: EntityManager
    ): Promise<Map<number, Schema.TbSmsQuote>> {
        const existingMap = new Map<number, Schema.TbSmsQuote>()
        if (scope.countryKeyIds.length === 0) {
            return existingMap
        }
        const repository = (manager ?? this.draftRepository.manager).getRepository(Schema.TbSmsQuote)
        const list = await this.database.builder(repository, qb => {
            qb.where('t.userKeyId = :userKeyId AND t.appKeyId = :appKeyId', scope)
            qb.andWhere('t.countryKeyId IN (:...countryKeyIds)', scope)
            qb.andWhere('t.status <> :deleted', { deleted: Schema.TbSmsQuoteStatus.DELETED })
            qb.andWhere('(t.expiryTime IS NULL OR t.expiryTime > :now)', { now: new Date() })
            qb.orderBy('t.effectiveTime', 'DESC').addOrderBy('t.keyId', 'DESC')
            return qb.getMany()
        })
        for (const quote of list) {
            if (!existingMap.has(quote.countryKeyId)) {
                existingMap.set(quote.countryKeyId, quote)
            }
        }
        return existingMap
    }

    /**对比现行报价得出价格变更状态：无现行报价为新增，价格相同为未变，否则为增长或降低。*/
    public fetchChangeStatus(price: number, existing?: number): Schema.TbSmsQuoteDraftChangeStatus {
        if (!isNotEmpty(existing)) {
            return Schema.TbSmsQuoteDraftChangeStatus.NEW
        } else if (Number(price) === Number(existing)) {
            return Schema.TbSmsQuoteDraftChangeStatus.CURRENT
        }
        return Number(price) > Number(existing) ? Schema.TbSmsQuoteDraftChangeStatus.INCREASE : Schema.TbSmsQuoteDraftChangeStatus.DECREASE
    }

    /**为草稿列表追加上下行价格变更状态，并把金额转换为实际金额。*/
    public async fetchDraftChangeList(list: Schema.TbSmsQuoteDraft[]) {
        const existingMap = new Map<string, Schema.TbSmsQuote>()
        const scopes = new Map<string, Schema.TbSmsQuoteDraft[]>()
        for (const item of list) {
            const key = `${item.userKeyId}:${item.appKeyId}`
            scopes.set(key, [...(scopes.get(key) ?? []), item])
        }
        for (const items of scopes.values()) {
            const { userKeyId, appKeyId } = items[0]
            const countryKeyIds = [...new Set(items.map(item => item.countryKeyId))]
            const scopeMap = await this.findExistingQuoteMap({ userKeyId, appKeyId, countryKeyIds })
            scopeMap.forEach((quote, countryKeyId) => existingMap.set(`${userKeyId}:${appKeyId}:${countryKeyId}`, quote))
        }
        return list.map(item => {
            const existing = existingMap.get(`${item.userKeyId}:${item.appKeyId}:${item.countryKeyId}`)
            return {
                ...this.fetchPriceNode(item),
                existingUpUsd: existing ? fetchShrinkNumber(existing.upUsd) : null,
                existingDownUsd: existing ? fetchShrinkNumber(existing.downUsd) : null,
                upStatus: this.fetchChangeStatus(item.upUsd, existing?.upUsd),
                downStatus: this.fetchChangeStatus(item.downUsd, existing?.downUsd)
            }
        })
    }

    /**统计草稿批次（仅有效草稿，不含软删除）：报价条目、国家/地区、新增/涨价/降价（上行或下行任一满足）、定时生效数。*/
    public async fetchDraftSummary(draftBatchId: string) {
        const drafts = await this.database.builder(this.draftRepository, qb => {
            qb.where('t.draftBatchId = :draftBatchId', { draftBatchId })
            qb.andWhere('t.status = :status', { status: Schema.TbSmsQuoteDraftStatus.ENABLE })
            return qb.getMany()
        })
        const items = await this.fetchDraftChangeList(drafts)
        const now = Date.now()
        const count = (status: Schema.TbSmsQuoteDraftChangeStatus) => {
            return items.filter(item => item.upStatus === status || item.downStatus === status).length
        }
        return {
            total: items.length,
            countries: new Set(items.map(item => item.countryKeyId)).size,
            additions: count(Schema.TbSmsQuoteDraftChangeStatus.NEW),
            increases: count(Schema.TbSmsQuoteDraftChangeStatus.INCREASE),
            decreases: count(Schema.TbSmsQuoteDraftChangeStatus.DECREASE),
            scheduled: items.filter(item => item.effectiveTime && new Date(item.effectiveTime).getTime() > now).length
        }
    }

    /**查询报价草稿。*/
    public async findDraft(keyId: number, manager?: EntityManager): Promise<Schema.TbSmsQuoteDraft> {
        const repository = (manager ?? this.draftRepository.manager).getRepository(Schema.TbSmsQuoteDraft)
        const draft = await this.database.builder(repository, qb => {
            qb.where('t.keyId = :keyId', { keyId })
            if (isNotEmpty(manager)) {
                qb.setLock('pessimistic_write')
            }
            return qb.getOne()
        })
        if (!draft) {
            throw new NotFoundException('报价草稿不存在')
        }
        return draft
    }

    /**查询报价草稿批次。*/
    public async getActiveDraftBatch(
        draftBatchId: string,
        manager?: EntityManager,
        notFoundMessage = '没有可用的报价草稿'
    ): Promise<Schema.TbSmsQuoteDraft[]> {
        const repository = (manager ?? this.draftRepository.manager).getRepository(Schema.TbSmsQuoteDraft)
        const list = await this.database.builder(repository, qb => {
            // 软删除的草稿不参与预览和发布。
            qb.where('t.draftBatchId = :draftBatchId', { draftBatchId })
                .andWhere('t.status = :status', { status: Schema.TbSmsQuoteDraftStatus.ENABLE })
                .orderBy('t.countryKeyId', 'ASC')
            if (isNotEmpty(manager)) {
                qb.setLock('pessimistic_write')
            }
            return qb.getMany()
        })
        if (list.length === 0) {
            throw new NotFoundException(notFoundMessage)
        }
        return list
    }

    /**获取同一客户、同一应用的报价发布锁，防止并发发布产生重叠有效报价。*/
    public async acquireQuotePublishLock(queryRunner: QueryRunner, userKeyId: number, appKeyId: number): Promise<boolean> {
        const lockName = `sms:quote:${userKeyId}:${appKeyId}`
        const [result] = (await queryRunner.query('SELECT GET_LOCK(?, ?) AS acquired', [lockName, 5])) as Array<{
            acquired: number | string | null
        }>
        return Number(result?.acquired) === 1
    }

    /**释放报价发布锁。*/
    public async releaseQuotePublishLock(queryRunner: QueryRunner, userKeyId: number, appKeyId: number): Promise<void> {
        const lockName = `sms:quote:${userKeyId}:${appKeyId}`
        await queryRunner.query('SELECT RELEASE_LOCK(?) AS released', [lockName])
    }

    /**按生效、失效时间实时计算报价状态；deleted 为手动作废，不随时间变化。*/
    public resolveQuoteStatus(
        quote: Pick<Schema.TbSmsQuote, 'status' | 'effectiveTime' | 'expiryTime'>,
        now: Date
    ): Schema.TbSmsQuoteStatus {
        if (quote.status === Schema.TbSmsQuoteStatus.DELETED) {
            return Schema.TbSmsQuoteStatus.DELETED
        }
        if (isNotEmpty(quote.expiryTime) && new Date(quote.expiryTime).getTime() <= now.getTime()) {
            return Schema.TbSmsQuoteStatus.EXPIRED
        }
        if (new Date(quote.effectiveTime).getTime() <= now.getTime()) {
            return Schema.TbSmsQuoteStatus.EFFECTIVE
        }
        return Schema.TbSmsQuoteStatus.PENDING
    }

    /**按实时状态追加查询条件，不依赖库内状态是否已经刷新。*/
    public whereQuoteStatuses(qb: SelectQueryBuilder<Schema.TbSmsQuote>, statuses: Schema.TbSmsQuoteStatus[], now: Date): void {
        const deleted = Schema.TbSmsQuoteStatus.DELETED
        qb.andWhere(
            new Brackets(scope => {
                for (const status of new Set(statuses)) {
                    if (status === Schema.TbSmsQuoteStatus.DELETED) {
                        scope.orWhere('t.status = :deleted', { deleted })
                    } else if (status === Schema.TbSmsQuoteStatus.EXPIRED) {
                        scope.orWhere('(t.status <> :deleted AND t.expiryTime IS NOT NULL AND t.expiryTime <= :now)', { deleted, now })
                    } else if (status === Schema.TbSmsQuoteStatus.EFFECTIVE) {
                        scope.orWhere(
                            '(t.status <> :deleted AND t.effectiveTime <= :now AND (t.expiryTime IS NULL OR t.expiryTime > :now))',
                            { deleted, now }
                        )
                    } else {
                        scope.orWhere(
                            '(t.status <> :deleted AND t.effectiveTime > :now AND (t.expiryTime IS NULL OR t.expiryTime > :now))',
                            { deleted, now }
                        )
                    }
                }
            })
        )
    }
}
