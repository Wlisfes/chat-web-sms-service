import { Module } from '@nestjs/common'
import { DispatchController } from '@/modules/dispatch/dispatch.controller'
import { DispatchService } from '@/modules/dispatch/dispatch.service'

@Module({
    controllers: [DispatchController],
    providers: [DispatchService]
})
export class DispatchModule {}
