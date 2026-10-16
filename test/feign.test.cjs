const test = require('node:test')
const assert = require('node:assert/strict')
const { FeignService } = require('../dist/feign/feign.service')

test('SMS Feign 按客户主键统计短信应用数量', async () => {
    const calls = []
    const repository = {
        async count(options) {
            calls.push(options)
            return 3
        }
    }
    const service = new FeignService(repository)
    assert.deepEqual(await service.httpBaseSmsAppCountResolver('Bearer service-token', { userKeyId: 5181000 }), {
        userKeyId: 5181000,
        total: 3
    })
    assert.deepEqual(calls, [{ where: { userKeyId: 5181000 } }])
})
