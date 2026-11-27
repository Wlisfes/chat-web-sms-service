import { Body, Get, Post } from '@nestjs/common'
import { AffectedResponseDataDto, ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { CurrentPrincipal, type AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { SmsTemplateService } from '@/modules/template/template.service'
import * as SmsTemplateDto from '@/modules/template/dto/template.dto'

@ApifoxController('短信服务-短信模板', 'template', { bearerAuth: true })
export class SmsTemplateController {
    constructor(private readonly smsTemplateService: SmsTemplateService) {}

    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '获取短信模板静态枚举' },
        response: { type: SmsTemplateDto.SmsTemplateEnumsResponseDto, description: '短信模板静态枚举' }
    })
    public async httpBaseSmsTemplateEnums(): Promise<SmsTemplateDto.SmsTemplateEnumsResponseDto> {
        return this.smsTemplateService.httpBaseSmsTemplateEnums()
    }

    @ApiServiceDecorator(Post('mine/create'), {
        operation: { summary: '当前登录客户新增短信模板' },
        request: { source: 'body', type: SmsTemplateDto.CreateMineSmsTemplateDto },
        response: { type: SmsTemplateDto.SmsTemplateResponseDto, description: '新增后的短信模板，状态为待审核' }
    })
    public async httpBaseSmsCreateMineTemplate(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsTemplateDto.CreateMineSmsTemplateDto
    ): Promise<SmsTemplateDto.SmsTemplateResponseDto> {
        return this.smsTemplateService.httpBaseSmsCreateMineTemplate(principal, body)
    }

    @ApiServiceDecorator(Post('mine/update'), {
        operation: { summary: '当前登录客户更新自己的短信模板' },
        request: { source: 'body', type: SmsTemplateDto.UpdateMineSmsTemplateDto },
        response: { type: SmsTemplateDto.SmsTemplateResponseDto, description: '更新后的短信模板，重新进入待审核' }
    })
    public async httpBaseSmsUpdateMineTemplate(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsTemplateDto.UpdateMineSmsTemplateDto
    ): Promise<SmsTemplateDto.SmsTemplateResponseDto> {
        return this.smsTemplateService.httpBaseSmsUpdateMineTemplate(principal, body)
    }

    @ApiServiceDecorator(Post('mine/column'), {
        operation: { summary: '当前登录客户分页查询自己的短信模板' },
        request: { source: 'body', type: SmsTemplateDto.ListMineSmsTemplateDto },
        response: { type: SmsTemplateDto.SmsTemplatePageResponseDto, description: '当前客户的短信模板分页数据' }
    })
    public async httpBaseSmsColumnMineTemplate(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsTemplateDto.ListMineSmsTemplateDto
    ) {
        return this.smsTemplateService.httpBaseSmsColumnMineTemplate(principal, body)
    }

    @ApiServiceDecorator(Post('mine/select'), {
        operation: { summary: '当前登录客户查询已通过审核的短信模板' },
        request: { source: 'body', type: SmsTemplateDto.SelectMineSmsTemplateDto },
        response: { type: SmsTemplateDto.SmsTemplateResponseDto, isArray: true, description: '可用于发送的短信模板' }
    })
    public async httpBaseSmsSelectMineTemplate(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsTemplateDto.SelectMineSmsTemplateDto
    ): Promise<SmsTemplateDto.SmsTemplateResponseDto[]> {
        return this.smsTemplateService.httpBaseSmsSelectMineTemplate(principal, body)
    }

    @ApiServiceDecorator(Post('mine/delete'), {
        operation: { summary: '当前登录客户删除自己的短信模板' },
        request: { source: 'body', type: SmsTemplateDto.DeleteMineSmsTemplateDto },
        response: { type: AffectedResponseDataDto, description: '删除结果' }
    })
    public async httpBaseSmsDeleteMineTemplate(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsTemplateDto.DeleteMineSmsTemplateDto
    ): Promise<AffectedResponseDataDto> {
        return this.smsTemplateService.httpBaseSmsDeleteMineTemplate(principal, body)
    }
}
