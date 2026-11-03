import { Module } from '@nestjs/common'
import { FeignClientCrmManager, FeignModule } from '@wlisfes/chat-web-base-schema/feign'
import { SmsAppModule } from '@/modules/app/app.module'
import { SmsTaskController } from '@/modules/task/task.controller'
import { SmsTaskService } from '@/modules/task/task.service'
import { SmsTaskUtilsService } from '@/modules/task/task.utils.service'

/** 短信任务模块；客户快照通过 CRM Feign 查询，应用快照读取本库短信应用。 */
@Module({
    imports: [FeignModule.register([FeignClientCrmManager]), SmsAppModule],
    controllers: [SmsTaskController],
    providers: [SmsTaskService, SmsTaskUtilsService],
    exports: [SmsTaskUtilsService]
})
export class SmsTaskModule {}
