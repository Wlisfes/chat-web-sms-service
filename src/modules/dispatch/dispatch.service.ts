import { Injectable, Logger } from '@nestjs/common'
import { Faker, en, zh_CN } from '@faker-js/faker'
import { RabbitmqService } from '@wlisfes/chat-web-base-schema/rabbitmq'
import { fetchResolver, encodingResolve, snowflakeResolve, segmentsResolve } from '@wlisfes/chat-web-base-schema/utils'
import * as constants from '@/modules/dispatch/dispatch.constants'

@Injectable()
export class DispatchService {
    private readonly logger = new Logger(DispatchService.name)
    private readonly faker = new Faker({ locale: [zh_CN, en] })

    constructor(private readonly rabbitmqService: RabbitmqService) {}

    public async fetchBaseMessageSubmit() {
        const message = this.createFakeMessage()
        const payload: constants.MessageSubmitPayload = {
            msgId: snowflakeResolve(),
            userKeyId: 10241010,
            userName: '青萍科技股份有限公司',
            appKeyId: 1002009,
            appId: 'NwlP460poQnWw1F9',
            type: 'MRKT',
            countryKeyId: 1077,
            mcc: '460',
            toNumber: message.toNumber,
            content: message.content,
            contentLength: message.contentLength,
            encoding: message.encoding,
            segments: message.segments,
            submitTime: new Date().toISOString(),
            price: 108200
        }
        await this.rabbitmqService.publish(constants.SMS_EXCHANGE, constants.SMS_SUBMIT_ROUTING_KEY, payload, {
            messageId: payload.msgId
        })
        this.logger.log(`短信已提交：msgId=${payload.msgId}`)
        return fetchResolver({ message: 'success', payload })
    }

    /** 用 faker 生成接收号码和内容；编码按内容判断，字符数和计费条数随之计算。 */
    private createFakeMessage(): Pick<constants.MessageSubmitPayload, 'toNumber' | 'content' | 'contentLength' | 'encoding' | 'segments'> {
        const toNumber = `86${this.faker.helpers.fromRegExp('1[3-9][0-9]{9}')}`
        const content = this.fakeContent()
        const encoding = encodingResolve(content)
        const contentLength = Array.from(content).length
        return { toNumber, content, contentLength, encoding, segments: segmentsResolve(contentLength, encoding) }
    }

    /** 纯英文数字走 GSM7，中文等内容走 UCS2，编码由内容反推。 */
    private fakeContent(): string {
        if (this.faker.datatype.boolean()) {
            return this.faker.lorem.sentence({ min: 5, max: 40 })
        }
        return `Hello ${this.faker.person.fullName()}! ${this.faker.lorem.sentence({ min: 5, max: 40 })}`
    }
}
