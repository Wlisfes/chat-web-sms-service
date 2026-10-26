import { Injectable, Logger } from '@nestjs/common'
import { RabbitmqService } from '@wlisfes/chat-web-base-schema/rabbitmq'
import { fetchResolver, v4 } from '@wlisfes/chat-web-base-schema/utils'
import * as constants from '@/modules/dispatch/dispatch.constants'

@Injectable()
export class DispatchService {
    private readonly logger = new Logger(DispatchService.name)
    constructor(private readonly rabbitmqService: RabbitmqService) {}

    public async fetchBaseMessageSubmit() {
        const payload: constants.MessageSubmitPayload = {
            logId: v4(),
            userKeyId: 10241010,
            userName: '青萍科技股份有限公司',
            appKeyId: 1002009,
            appId: 'NwlP460poQnWw1F9',
            type: 'MRKT',
            countryKeyId: 1077,
            mcc: '460',
            toNumber: `8613800138000`.replace(/^\+/, ''),
            content: `豫章故郡，洪都新府。星分翼轸，地接衡庐。`,
            contentLength: 20,
            encoding: 'GSM7',
            segments: 1,
            submitTime: new Date().toISOString(),
            price: 108200
        }
        await this.rabbitmqService.publish(constants.SMS_EXCHANGE, constants.SMS_SUBMIT_ROUTING_KEY, payload, {
            messageId: payload.logId
        })
        this.logger.log(`短信已提交：logId=${payload.logId}`)
        return fetchResolver({ message: 'success', payload })
    }
}
