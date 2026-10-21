import { Injectable } from '@nestjs/common'
import * as Schema from '@wlisfes/chat-web-base-schema'
import { In, InjectRepository, Repository } from '@wlisfes/chat-web-base-schema/database'
import * as FeignSchema from '@wlisfes/chat-web-base-schema/feign'

/** SMS 服务对内 Feign 接口实现；凭据由共享客户端在分发前校验。 */
@Injectable()
export class FeignService implements FeignSchema.FeignClientSmsImplementation {
    constructor(@InjectRepository(Schema.TbSmsApp) private readonly appRepository: Repository<Schema.TbSmsApp>) {}

    /**按客户主键统计短信应用数量**/
    public async httpBaseSmsAppCountResolver(
        _authorization: string,
        input: FeignSchema.SmsAppCountResolverInput
    ): Promise<FeignSchema.SmsAppCount> {
        const total = await this.appRepository.count({ where: { userKeyId: input.userKeyId } })
        return { userKeyId: input.userKeyId, total }
    }

    /**按短信应用主键批量获取摘要；只查询展示和选路需要的字段，不返回密钥和推送地址。**/
    public async httpBaseSmsColumnAppResolver(
        _authorization: string,
        input: FeignSchema.SmsColumnAppResolverInput
    ): Promise<FeignSchema.SmsAppSummary[]> {
        const keyIds = [...new Set(input.keyIds ?? [])]
        if (keyIds.length === 0) return []
        return this.appRepository.find({
            select: { keyId: true, userKeyId: true, appId: true, appName: true, appAlias: true, type: true, status: true },
            where: { keyId: In(keyIds) }
        })
    }
}
