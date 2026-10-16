import { Logger, Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { AuthorizationGuard, AuthorizationModule, GatewayPrincipalGuard, GatewayPrincipalModule } from '@wlisfes/chat-web-base-schema/auth'
import { HttpResponseModule } from '@wlisfes/chat-web-base-schema/interceptor'
import { forRootNacosRuntimeOptions, NacosModule } from '@wlisfes/chat-web-base-schema/nacos'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from '@/database/database.module'
import { FeignModule } from '@/feign/feign.module'
import { SmsAppModule } from '@/modules/app/app.module'
import { SmsQuoteModule } from '@/modules/quote/quote.module'

/**
 * SMS 服务根模块。
 * 负责客户短信应用与短信报价；客户数据通过 CRM Feign 查询，并通过 /feign/sms 为内部服务提供短信数据。
 */
@Module({
    imports: [
        HttpResponseModule,
        ConfigModule.forRoot({ isGlobal: true }),
        NacosModule.forRoot(forRootNacosRuntimeOptions(process.env)),
        DatabaseModule,
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
