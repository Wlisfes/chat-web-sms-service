const test = require('node:test')
const assert = require('node:assert/strict')
const { shouldEnqueueTask, taskEnqueueDelayMs } = require('../dist/modules/task/task.queue.service')

const now = new Date('2026-11-03T12:00:00')

test('空的计划时间立即入队且延迟为 0', () => {
    assert.equal(shouldEnqueueTask(null, now), true)
    assert.equal(taskEnqueueDelayMs(null, now), 0)
})

test('不足 3 小时的任务入队，超过或等于 3 小时不入队', () => {
    const within = new Date(now.getTime() + 3 * 60 * 60 * 1000 - 1)
    const boundary = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    assert.equal(shouldEnqueueTask(within, now), true)
    assert.equal(shouldEnqueueTask(boundary, now), false)
    assert.equal(taskEnqueueDelayMs(within, now), 3 * 60 * 60 * 1000 - 1)
})

test('已经早于当前时间的任务按立即发送入队', () => {
    const past = new Date(now.getTime() - 1000)
    assert.equal(shouldEnqueueTask(past, now), true)
    assert.equal(taskEnqueueDelayMs(past, now), 0)
})
