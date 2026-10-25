import { Get } from '@nestjs/common'
import { Public } from '@wlisfes/chat-web-base-schema/auth'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { DispatchService } from '@/modules/dispatch/dispatch.service'

@ApifoxController('消息队列', 'dispatch')
export class DispatchController {
    constructor(private readonly dispatchService: DispatchService) {}

    @Public()
    @ApiServiceDecorator(Get('submit'), {
        operation: { summary: '测试提交短信' },
        response: { description: '已进入提交队列的短信' }
    })
    public async fetchBaseMessageSubmit() {
        return await this.dispatchService.fetchBaseMessageSubmit()
    }
}
