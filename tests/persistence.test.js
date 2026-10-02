import test from 'node:test'
import assert from 'node:assert/strict'
import { STORAGE_KEY, createTask, loadTasks, saveTasks, updateTask } from '../src/board.js'

function memoryStorage(initial) {
  const values = new Map(initial ? [[STORAGE_KEY, initial]] : [])
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) }
}

test('创建、编辑、两次状态流转、刷新恢复及删除形成完整持久化流程', () => {
  const storage = memoryStorage()
  const fields = { title: '  完成实践报告  ', description: '记录过程\n附验证证据', category: '学习', status: 'todo' }
  const first = createTask(fields, 'report', '2026-10-02T12:00:00Z')
  const unrelated = createTask({ ...fields, title: '另一项工作', category: '工作' }, 'work')
  let tasks = saveTasks(storage, [first, unrelated])
  tasks = saveTasks(storage, updateTask(tasks, 'report', { ...fields, title: '实践报告', status: 'doing' }))
  tasks = saveTasks(storage, updateTask(tasks, 'report', { ...fields, title: '实践报告', status: 'done' }))
  const reloaded = loadTasks(storage)
  assert.equal(reloaded[0].status, 'done')
  assert.equal(reloaded[0].title, '实践报告')
  assert.equal(reloaded[0].description, '记录过程\n附验证证据')
  assert.equal(reloaded[0].createdAt, first.createdAt)
  assert.deepEqual(reloaded[1], unrelated)
  saveTasks(storage, reloaded.filter(task => task.id !== 'report'))
  assert.deepEqual(loadTasks(storage), [unrelated])
})

test('持久化损坏记录与重复编号不会被读取过程覆盖', () => {
  const valid = createTask({ title: '任务', category: '工作', status: 'todo' }, 'same')
  for (const raw of ['{broken', '{}', JSON.stringify([valid, valid])]) {
    const storage = memoryStorage(raw)
    assert.throws(() => loadTasks(storage))
    assert.equal(storage.getItem(STORAGE_KEY), raw)
  }
})

test('浏览器存储空间不足时保留此前已保存的记录', () => {
  const first = createTask({ title: '已保存', category: '生活', status: 'todo' }, 'one')
  const raw = JSON.stringify([first])
  const storage = memoryStorage(raw)
  storage.setItem = () => { throw new Error('QuotaExceededError') }
  assert.throws(() => saveTasks(storage, []), /保存失败/)
  assert.equal(storage.getItem(STORAGE_KEY), raw)
})

test('无效输入和不存在的任务不能更新记录', () => {
  const fields = { title: '有效任务', category: '工作', status: 'todo' }
  for (const invalid of [{ title: '  ' }, { title: '字'.repeat(81) }, { description: '字'.repeat(1001) }, { category: 'invalid' }, { status: 'invalid' }]) {
    assert.throws(() => createTask({ ...fields, ...invalid }, 'test'))
  }
  assert.throws(() => updateTask([], 'missing', fields), /不存在/)
})
