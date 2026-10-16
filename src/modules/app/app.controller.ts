import { Body, Get, Post } from '@nestjs/common'
import { CurrentPrincipal, RequirePermissions } from '@wlisfes/chat-web-base-schema/auth'
import type { AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { SMS_APP_SECRET_PERMISSION, SMS_APP_SECRET_RESET_PERMISSION } from '@/modules/app/app.constants'
import { SmsAppService } from '@/modules/app/app.service'
import * as SmsAppDto from '@/modules/app/dto/app.dto'

@ApifoxController('短信服务-短信应用', 'app', { bearerAuth: true })
export class SmsAppController {
    constructor(private readonly smsAppService: SmsAppService) {}

    @ApiServiceDecorator(Get('enums'), {
        operation: { summary: '获取客户短信应用静态枚举' },
        response: { type: SmsAppDto.SmsAppEnumsResponseDto, description: '短信应用静态枚举' }
    })
    public async httpBaseSmsAppEnums(): Promise<SmsAppDto.SmsAppEnumsResponseDto> {
        return this.smsAppService.httpBaseSmsAppEnums()
    }

    @ApiServiceDecorator(Post('create'), {
        operation: { summary: '新增客户短信应用' },
        request: { source: 'body', type: SmsAppDto.CreateSmsAppDto },
        response: { type: SmsAppDto.SmsAppResponseDto, description: '新增后的短信应用，不返回应用密钥' }
    })
    public async httpBaseSmsCreateApp(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsAppDto.CreateSmsAppDto
    ): Promise<SmsAppDto.SmsAppResponseDto> {
        return this.smsAppService.httpBaseSmsCreateApp(principal, body)
    }

    @ApiServiceDecorator(Post('update'), {
        operation: { summary: '更新客户短信应用' },
        request: { source: 'body', type: SmsAppDto.UpdateSmsAppDto },
        response: { type: SmsAppDto.SmsAppResponseDto, description: '更新后的短信应用，不返回应用密钥' }
    })
    public async httpBaseSmsUpdateApp(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsAppDto.UpdateSmsAppDto
    ): Promise<SmsAppDto.SmsAppResponseDto> {
        return this.smsAppService.httpBaseSmsUpdateApp(principal, body)
    }

    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '分页查询客户短信应用' },
        request: { source: 'body', type: SmsAppDto.ListSmsAppDto },
        response: { type: SmsAppDto.SmsAppPageResponseDto, description: '短信应用分页数据' }
    })
    public async httpBaseSmsColumnApp(@Body() body: SmsAppDto.ListSmsAppDto) {
        return this.smsAppService.httpBaseSmsColumnApp(body)
    }

    @ApiServiceDecorator(Post('select'), {
        operation: { summary: '获取客户短信应用下拉选项' },
        request: { source: 'body', type: SmsAppDto.SelectSmsAppDto },
        response: { type: SmsAppDto.SmsAppResponseDto, isArray: true, description: '客户短信应用列表' }
    })
    public async httpBaseSmsSelectApp(@Body() body: SmsAppDto.SelectSmsAppDto): Promise<SmsAppDto.SmsAppResponseDto[]> {
        return this.smsAppService.httpBaseSmsSelectApp(body)
    }

    @RequirePermissions(SMS_APP_SECRET_PERMISSION)
    @ApiServiceDecorator(Post('secret/resolve'), {
        operation: { summary: '查看客户短信应用密钥' },
        request: { source: 'body', type: SmsAppDto.SmsAppSecretDto },
        response: { type: SmsAppDto.SmsAppSecretResponseDto, description: '短信应用 ID 与密钥明文' }
    })
    public async httpBaseSmsAppSecretResolver(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsAppDto.SmsAppSecretDto
    ): Promise<SmsAppDto.SmsAppSecretResponseDto> {
        return this.smsAppService.httpBaseSmsAppSecretResolver(principal, body)
    }

    @RequirePermissions(SMS_APP_SECRET_RESET_PERMISSION)
    @ApiServiceDecorator(Post('secret/reset'), {
        operation: { summary: '重置客户短信应用密钥' },
        request: { source: 'body', type: SmsAppDto.SmsAppSecretDto },
        response: { type: SmsAppDto.SmsAppSecretResponseDto, description: '短信应用 ID 与重置后的密钥明文' }
    })
    public async httpBaseSmsResetAppSecret(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsAppDto.SmsAppSecretDto
    ): Promise<SmsAppDto.SmsAppSecretResponseDto> {
        return this.smsAppService.httpBaseSmsResetAppSecret(principal, body)
    }
}
