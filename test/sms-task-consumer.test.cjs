const test = require('node:test')
const assert = require('node:assert/strict')
const { SmsTaskConsumer } = require('../dist/modules/task/task.consumer')

function createConsumer({ task, affected = 1 } = {}) {
    const calls = []
    const repository = {
        async findOne() {
            calls.push(['find'])
            return task
        },
        async update(where, values) {
            calls.push(['update', where, values])
            return { affected }
        }
    }
    const queue = {
        async republish(value) {
            calls.push(['republish', value.keyId])
        }
    }
    return { consumer: new SmsTaskConsumer(repository, {}, queue), calls }
}

test('版本不一致的到点消息直接确认丢掉', async () => {
    const { consumer, calls } = createConsumer({ task: { keyId: 1, version: 2, status: 'pending', planTime: null } })
    assert.equal(await consumer.fetchFire({ taskKeyId: 1, version: 1 }), 'ack')
    assert.deepEqual(
        calls.map(item => item[0]),
        ['find']
    )
})

test('未到发送时间时按剩余时间重新入队', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000)
    const { consumer, calls } = createConsumer({ task: { keyId: 8, version: 1, status: 'pending', planTime: future } })
    assert.equal(await consumer.fetchFire({ taskKeyId: 8, version: 1 }), 'ack')
    assert.deepEqual(
        calls.map(item => item[0]),
        ['find', 'republish']
    )
})

test('已到点的待发送任务改为发送中', async () => {
    const { consumer, calls } = createConsumer({ task: { keyId: 9, version: 3, status: 'pending', planTime: null } })
    assert.equal(await consumer.fetchFire({ taskKeyId: 9, version: 3 }), 'ack')
    assert.equal(calls[1][0], 'update')
    assert.equal(calls[1][2].status, 'sending')
})

test('消息格式错误时拒绝', async () => {
    const { consumer } = createConsumer()
    assert.equal(await consumer.fetchFire({ taskKeyId: 0, version: 1 }), 'reject')
})
