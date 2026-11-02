import { Body, Get, Post } from '@nestjs/common'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { DispatchService } from '@/modules/dispatch/dispatch.service'
import * as DispatchDto from '@/modules/dispatch/dto/dispatch.dto'

@ApifoxController('短信服务-消息队列', 'dispatch', { bearerAuth: true })
export class DispatchController {
    constructor(private readonly dispatchService: DispatchService) {}

    @ApiServiceDecorator(Post('submit/commit'), {
        operation: { summary: '真实提交短信' },
        request: { source: 'body', type: DispatchDto.SubmitCommitDto },
        response: { type: DispatchDto.SubmitResponseDto, description: '已进入提交队列的短信' }
    })
    public async fetchBaseSubmitCommit(@Body() body: DispatchDto.SubmitCommitDto) {
        return await this.dispatchService.fetchBaseSubmitCommit(body)
    }

    @ApiServiceDecorator(Get('submit/simulate'), {
        operation: { summary: '提交模拟短信' },
        response: { type: DispatchDto.SubmitResponseDto, description: '已进入提交队列的模拟短信' }
    })
    public async fetchBaseSubmitSimulate() {
        return await this.dispatchService.fetchBaseSubmitSimulate()
    }
}
