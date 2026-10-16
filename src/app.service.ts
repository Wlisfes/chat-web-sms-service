import { Injectable, Logger } from '@nestjs/common'
import { SmsLivenessResponseDto } from '@/dto/sms-response.dto'

@Injectable()
export class AppService {
    constructor(private readonly logger: Logger) {}

    /** SMS 服务欢迎信息。 */
    public async httpBaseSmsWelcome(): Promise<string> {
        // Logger 通过依赖注入获取；不要再传第二个上下文参数，避免上下文与消息混排。
        this.logger.log('正在获取欢迎信息')
        return 'Hello World!'
    }

    /** SMS 服务进程存活状态。 */
    public async httpBaseSmsLiveness(): Promise<SmsLivenessResponseDto> {
        return { status: 'UP' }
    }
}
