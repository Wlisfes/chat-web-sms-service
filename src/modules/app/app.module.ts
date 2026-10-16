import { Module } from '@nestjs/common'
import { FeignClientCrmManager, FeignModule } from '@wlisfes/chat-web-base-schema/feign'
import { SmsAppController } from '@/modules/app/app.controller'
import { SmsAppService } from '@/modules/app/app.service'
import { SmsAppUtilsService } from '@/modules/app/app.utils.service'

/** 客户短信应用模块；客户与客户配置通过 CRM Feign 查询。 */
@Module({
    imports: [FeignModule.register([FeignClientCrmManager])],
    controllers: [SmsAppController],
    providers: [SmsAppService, SmsAppUtilsService],
    exports: [SmsAppUtilsService]
})
export class SmsAppModule {}
