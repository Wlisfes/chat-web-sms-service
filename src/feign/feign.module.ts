import { Module } from '@nestjs/common'
import { FeignController } from '@/feign/feign.controller'
import { FeignService } from '@/feign/feign.service'
import { SmsTaskModule } from '@/modules/task/task.module'

@Module({
    imports: [SmsTaskModule],
    controllers: [FeignController],
    providers: [FeignService]
})
export class FeignModule {}
