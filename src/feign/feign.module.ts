import { Module } from '@nestjs/common'
import { FeignController } from '@/feign/feign.controller'
import { FeignService } from '@/feign/feign.service'

@Module({
    controllers: [FeignController],
    providers: [FeignService]
})
export class FeignModule {}
