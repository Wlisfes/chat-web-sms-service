import { Body, Get, Post } from '@nestjs/common'
import { AffectedResponseDataDto, ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { CurrentPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { SmsTaskService } from '@/modules/task/task.service'
import * as SmsTaskDto from '@/modules/task/dto/task.dto'

@ApifoxController('短信服务-短信任务', 'task', { bearerAuth: true })
export class SmsTaskController {
    constructor(private readonly smsTaskService: SmsTaskService) {}

    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '获取短信任务静态枚举' },
        response: { type: SmsTaskDto.SmsTaskEnumsResponseDto, description: '短信任务静态枚举' }
    })
    public async httpBaseSmsTaskEnums(): Promise<SmsTaskDto.SmsTaskEnumsResponseDto> {
        return this.smsTaskService.httpBaseSmsTaskEnums()
    }

    @ApiServiceDecorator(Post('create'), {
        operation: { summary: '新增短信任务' },
        request: { source: 'body', type: SmsTaskDto.CreateSmsTaskDto },
        response: { type: SmsTaskDto.SmsTaskResponseDto, description: '新增后的短信任务' }
    })
    public async httpBaseSmsCreateTask(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsTaskDto.CreateSmsTaskDto
    ): Promise<SmsTaskDto.SmsTaskResponseDto> {
        return this.smsTaskService.httpBaseSmsCreateTask(principal, body)
    }

    @ApiServiceDecorator(Post('update'), {
        operation: { summary: '更新短信任务' },
        request: { source: 'body', type: SmsTaskDto.UpdateSmsTaskDto },
        response: { type: SmsTaskDto.SmsTaskResponseDto, description: '更新后的短信任务' }
    })
    public async httpBaseSmsUpdateTask(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsTaskDto.UpdateSmsTaskDto
    ): Promise<SmsTaskDto.SmsTaskResponseDto> {
        return this.smsTaskService.httpBaseSmsUpdateTask(principal, body)
    }

    @ApiServiceDecorator(Post('resolve'), {
        operation: { summary: '查询短信任务详情' },
        request: { source: 'body', type: SmsTaskDto.SmsTaskKeyDto },
        response: { type: SmsTaskDto.SmsTaskResponseDto, description: '短信任务详情' }
    })
    public async httpBaseSmsTaskResolver(@Body() body: SmsTaskDto.SmsTaskKeyDto): Promise<SmsTaskDto.SmsTaskResponseDto> {
        return this.smsTaskService.httpBaseSmsTaskResolver(body)
    }

    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '分页查询短信任务' },
        request: { source: 'body', type: SmsTaskDto.ListSmsTaskDto },
        response: { type: SmsTaskDto.SmsTaskPageResponseDto, description: '短信任务分页数据' }
    })
    public async httpBaseSmsColumnTask(@Body() body: SmsTaskDto.ListSmsTaskDto) {
        return this.smsTaskService.httpBaseSmsColumnTask(body)
    }

    @ApiServiceDecorator(Post('delete'), {
        operation: { summary: '删除待发送短信任务' },
        request: { source: 'body', type: SmsTaskDto.DeleteSmsTaskDto },
        response: { type: AffectedResponseDataDto, description: '删除结果' }
    })
    public async httpBaseSmsDeleteTask(@Body() body: SmsTaskDto.DeleteSmsTaskDto): Promise<AffectedResponseDataDto> {
        return this.smsTaskService.httpBaseSmsDeleteTask(body)
    }
}
