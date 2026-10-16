import { Get, Header } from '@nestjs/common'
import { Public } from '@wlisfes/chat-web-base-schema/auth'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { SmsLivenessResponseDto } from '@/dto/sms-response.dto'
import { AppService } from '@/app.service'

@ApifoxController('SMS 服务')
export class AppController {
    constructor(private readonly appService: AppService) {}

    @ApiServiceDecorator(Get(), {
        operation: { summary: '获取 SMS 服务欢迎信息' },
        response: {
            type: String,
            example: 'Hello World!',
            contentType: 'text/plain',
            envelope: false,
            description: 'SMS 服务欢迎信息'
        },
        produces: ['text/plain']
    })
    @Public()
    @Header('Content-Type', 'text/plain; charset=utf-8')
    public async httpBaseSmsWelcome(): Promise<string> {
        return this.appService.httpBaseSmsWelcome()
    }

    @ApiServiceDecorator(Get('health/live'), {
        operation: { summary: 'SMS 服务存活检查' },
        response: { type: SmsLivenessResponseDto, envelope: false, description: '进程正常时返回 UP' }
    })
    @Public()
    @Header('Content-Type', 'application/json; charset=utf-8')
    public async httpBaseSmsLiveness(): Promise<SmsLivenessResponseDto> {
        return this.appService.httpBaseSmsLiveness()
    }
}
