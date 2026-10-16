import { Injectable, NotFoundException } from '@nestjs/common'
import * as Schema from '@wlisfes/chat-web-base-schema'

import {
    InjectRepository,
    Brackets,
    DataBaseService,
    EntityManager,
    QueryRunner,
    Repository,
    SelectQueryBuilder
} from '@wlisfes/chat-web-base-schema/database'
import { isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
@Injectable()
export class SmsQuoteUtilsService {
    constructor(
        @InjectRepository(Schema.TbSmsQuoteDraft) private readonly draftRepository: Repository<Schema.TbSmsQuoteDraft>,
        private readonly database: DataBaseService
    ) {}

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
            qb.where('t.draftBatchId = :draftBatchId', { draftBatchId }).orderBy('t.countryKeyId', 'ASC')
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
                            {
                                deleted,
                                now
                            }
                        )
                    } else {
                        scope.orWhere(
                            '(t.status <> :deleted AND t.effectiveTime > :now AND (t.expiryTime IS NULL OR t.expiryTime > :now))',
                            {
                                deleted,
                                now
                            }
                        )
                    }
                }
            })
        )
    }
}
