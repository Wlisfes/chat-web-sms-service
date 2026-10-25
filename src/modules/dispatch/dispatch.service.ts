import { randomUUID } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { RabbitmqService } from '@wlisfes/chat-web-base-schema/rabbitmq'
import { fetchResolver } from '@wlisfes/chat-web-base-schema/utils'
import * as constants from '@/modules/dispatch/dispatch.constants'

@Injectable()
export class DispatchService {
    constructor(
        private readonly logger: Logger,
        private readonly rabbitmqService: RabbitmqService
    ) {}

    public async fetchBaseMessageSubmit() {
        const payload = {
            messageId: randomUUID(),
            appId: 'NwlP460poQnWw1F9',
            type: 'MRKT',
            countryKeyId: '1077',
            toNumber: `8613800138000`.replace(/^\+/, ''),
            content: `豫章故郡，洪都新府。星分翼轸，地接衡庐。`,
            submittedAt: new Date().toISOString()
        }
        await this.rabbitmqService.publish(constants.SMS_EXCHANGE, constants.SMS_SUBMIT_ROUTING_KEY, payload, {
            messageId: payload.messageId
        })
        this.logger.log(`短信已提交：messageId=${payload.messageId}`)
        return fetchResolver({ message: 'success', payload })
    }
}
