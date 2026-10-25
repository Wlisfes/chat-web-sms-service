import { Module } from '@nestjs/common'
import { DispatchService } from '@/modules/dispatch/dispatch.service'

@Module({
    providers: [DispatchService]
})
export class DispatchModule {}
