import { Module } from '@nestjs/common'
import { FeignClientCrmManager, FeignClientFinanceManager, FeignModule } from '@wlisfes/chat-web-base-schema/feign'
import { SmsAppModule } from '@/modules/app/app.module'
import { SmsQuoteController } from '@/modules/quote/quote.controller'
import { SmsQuoteService } from '@/modules/quote/quote.service'
import { SmsQuoteUtilsService } from '@/modules/quote/quote.utils.service'

/** 短信报价模块；客户归属 CRM，基础价格与汇率归属 Finance。 */
@Module({
    imports: [FeignModule.register([FeignClientCrmManager, FeignClientFinanceManager]), SmsAppModule],
    controllers: [SmsQuoteController],
    providers: [SmsQuoteService, SmsQuoteUtilsService]
})
export class SmsQuoteModule {}
