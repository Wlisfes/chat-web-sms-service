import { ConfigService } from '@nestjs/config'
import { ApifoxController } from '@wlisfes/chat-web-base-schema/decorator'
import { FeignClientSmsManager } from '@wlisfes/chat-web-base-schema/feign'
import { FeignService } from '@/feign/feign.service'

/**
 * SMS 服务内部 Feign 接口控制器。
 *
 * 路由与凭据校验全部继承共享 SMS Feign 客户端，只通过网关 /feign/sms 对内部服务开放。
 */
@ApifoxController('内部 Feign 接口')
export class FeignController extends FeignClientSmsManager {
    constructor(feignService: FeignService, configService: ConfigService) {
        super(feignService, configService)
    }
}
