import { Module } from '@nestjs/common'
import { SmsAppModule } from '@/modules/app/app.module'
import { SmsTemplateController } from '@/modules/template/template.controller'
import { SmsTemplateService } from '@/modules/template/template.service'
import { SmsTemplateUtilsService } from '@/modules/template/template.utils.service'

/** 客户短信模板模块；模板归属当前登录客户，类型跟随短信应用。 */
@Module({
    imports: [SmsAppModule],
    controllers: [SmsTemplateController],
    providers: [SmsTemplateService, SmsTemplateUtilsService],
    exports: [SmsTemplateUtilsService]
})
export class SmsTemplateModule {}
