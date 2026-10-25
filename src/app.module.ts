import { AuthorizationGuard, AuthorizationModule, GatewayPrincipalGuard, GatewayPrincipalModule } from '@wlisfes/chat-web-base-schema/auth'
import { forRootNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { HttpResponseModule } from '@wlisfes/chat-web-base-schema/interceptor'
import { RabbitmqModule } from '@wlisfes/chat-web-base-schema/rabbitmq'
import { SMS_RABBITMQ_VHOST } from '@/modules/dispatch/dispatch.constants'
import { setupSmsTopology } from '@/modules/dispatch/dispatch.topology'
import { SmsQuoteModule } from '@/modules/quote/quote.module'
import { DatabaseModule } from '@/database/database.module'
import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { AppController } from '@/app.controller'
import { AppService } from '@/app.service'
import { FeignModule } from '@/feign/feign.module'
import { SmsAppModule } from '@/modules/app/app.module'

@Module({
    imports: [
        HttpResponseModule,
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot(forRootNacosRuntimeOptions(process.env)),
        DatabaseModule,
        RabbitmqModule.forRoot({ vhost: SMS_RABBITMQ_VHOST, setup: setupSmsTopology }),
        GatewayPrincipalModule,
        AuthorizationModule,
        SmsAppModule,
        SmsQuoteModule,
        FeignModule
    ],
    controllers: [AppController],
    providers: [
        Logger,
        AppService,
        { provide: APP_GUARD, useExisting: GatewayPrincipalGuard },
        { provide: APP_GUARD, useExisting: AuthorizationGuard }
    ]
})
export class AppModule {}
