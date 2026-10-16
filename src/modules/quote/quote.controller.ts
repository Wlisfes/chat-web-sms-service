import { Body, Post } from '@nestjs/common'
import { CurrentPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import type { AuthPrincipal } from '@wlisfes/chat-web-base-schema/auth'
import { AffectedResponseDataDto, ApiServiceDecorator, ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { SmsQuoteService } from '@/modules/quote/quote.service'
import * as Schema from '@wlisfes/chat-web-base-schema'
import * as SmsQuoteDto from '@/modules/quote/dto/quote.dto'

@ApifoxController('短信服务-短信报价', 'quote', { bearerAuth: true })
export class SmsQuoteController {
    constructor(private readonly smsQuoteService: SmsQuoteService) {}

    @ApiServiceDecorator(Post('draft/init'), {
        operation: { summary: '初始化短信报价草稿批次' },
        request: { source: 'body', type: SmsQuoteDto.InitSmsQuoteDraftDto },
        response: { type: SmsQuoteDto.InitSmsQuoteDraftResponseDto, description: '草稿批次信息' }
    })
    public async httpBaseSmsInitQuoteDraft(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsQuoteDto.InitSmsQuoteDraftDto
    ): Promise<SmsQuoteDto.InitSmsQuoteDraftResponseDto> {
        return this.smsQuoteService.httpBaseSmsInitQuoteDraft(principal, body)
    }

    @ApiServiceDecorator(Post('draft/column'), {
        operation: { summary: '分页查询短信报价草稿' },
        request: { source: 'body', type: SmsQuoteDto.ListSmsQuoteDraftDto },
        response: { type: SmsQuoteDto.SmsQuoteDraftPageResponseDto, description: '报价草稿分页数据' }
    })
    public async httpBaseSmsColumnQuoteDraft(@Body() body: SmsQuoteDto.ListSmsQuoteDraftDto) {
        return this.smsQuoteService.httpBaseSmsColumnQuoteDraft(body)
    }

    @ApiServiceDecorator(Post('draft/update'), {
        operation: { summary: '更新短信报价草稿' },
        request: { source: 'body', type: SmsQuoteDto.UpdateSmsQuoteDraftDto },
        response: { type: Schema.TbSmsQuoteDraftDto, description: '更新后的报价草稿' }
    })
    public async httpBaseSmsUpdateQuoteDraft(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsQuoteDto.UpdateSmsQuoteDraftDto
    ): Promise<Schema.TbSmsQuoteDraftDto> {
        return this.smsQuoteService.httpBaseSmsUpdateQuoteDraft(principal, body)
    }

    @ApiServiceDecorator(Post('draft/delete'), {
        operation: { summary: '批量删除短信报价草稿' },
        request: { source: 'body', type: SmsQuoteDto.DeleteSmsQuoteDraftDto },
        response: { type: AffectedResponseDataDto, description: '删除结果' }
    })
    public async httpBaseSmsDeleteQuoteDraft(@Body() body: SmsQuoteDto.DeleteSmsQuoteDraftDto): Promise<AffectedResponseDataDto> {
        return this.smsQuoteService.httpBaseSmsDeleteQuoteDraft(body)
    }

    @ApiServiceDecorator(Post('preview'), {
        operation: { summary: '预览短信报价草稿批次' },
        request: { source: 'body', type: SmsQuoteDto.SmsQuoteDraftBatchDto },
        response: { type: SmsQuoteDto.SmsQuotePreviewResponseDto, description: '报价草稿批次预览' }
    })
    public async httpBaseSmsPreviewQuote(@Body() body: SmsQuoteDto.SmsQuoteDraftBatchDto): Promise<SmsQuoteDto.SmsQuotePreviewResponseDto> {
        return this.smsQuoteService.httpBaseSmsPreviewQuote(body)
    }

    @ApiServiceDecorator(Post('publish'), {
        operation: { summary: '发布短信报价草稿批次' },
        request: { source: 'body', type: SmsQuoteDto.SmsQuoteDraftBatchDto },
        response: { type: SmsQuoteDto.PublishSmsQuoteResponseDto, description: '报价发布结果' }
    })
    public async httpBaseSmsPublishQuote(
        @CurrentPrincipal() principal: AuthPrincipal,
        @Body() body: SmsQuoteDto.SmsQuoteDraftBatchDto
    ): Promise<SmsQuoteDto.PublishSmsQuoteResponseDto> {
        return this.smsQuoteService.httpBaseSmsPublishQuote(principal, body)
    }

    @ApiServiceDecorator(Post('column'), {
        operation: { summary: '分页查询正式短信报价' },
        request: { source: 'body', type: SmsQuoteDto.ListSmsQuoteDto },
        response: { type: SmsQuoteDto.SmsQuotePageResponseDto, description: '正式报价分页数据' }
    })
    public async httpBaseSmsColumnQuote(@Body() body: SmsQuoteDto.ListSmsQuoteDto) {
        return this.smsQuoteService.httpBaseSmsColumnQuote(body)
    }
}
