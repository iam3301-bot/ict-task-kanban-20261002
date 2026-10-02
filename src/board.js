export const STORAGE_KEY = 'clear-task-board:v1'
export const STATUSES = ['todo', 'doing', 'done']
export const CATEGORIES = ['工作', '学习', '生活', '其他']

export function validateTask(task) {
  const title = String(task.title ?? '').trim()
  const description = String(task.description ?? '').trim()
  if (!title) throw new Error('请填写任务标题。')
  if (title.length > 80) throw new Error('标题最多 80 个字。')
  if (description.length > 1000) throw new Error('描述最多 1000 个字。')
  if (!CATEGORIES.includes(task.category)) throw new Error('请选择有效的分类。')
  if (!STATUSES.includes(task.status)) throw new Error('请选择有效的状态。')
  return { title, description, category: task.category, status: task.status }
}

export function loadTasks(storage) {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return []
  let data
  try { data = JSON.parse(raw) } catch { throw new Error('本地记录无法读取，原始数据仍保留。请先导出浏览器中的数据后再处理。') }
  if (!Array.isArray(data)) throw new Error('本地记录格式不正确，原始数据仍保留。')
  const ids = new Set()
  return data.map(task => {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id)) {
      throw new Error('本地记录包含无效或重复的任务编号，原始数据仍保留。')
    }
    ids.add(task.id)
    return { id: task.id, ...validateTask(task), createdAt: task.createdAt || '', updatedAt: task.updatedAt || '' }
  })
}

// Persist first, so a blocked or full storage never produces a false “saved” state.
export function saveTasks(storage, tasks) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(tasks)) }
  catch { throw new Error('保存失败：浏览器存储不可用或空间不足。当前记录未被修改。') }
  return tasks
}

export function createTask(fields, id = crypto.randomUUID(), now = new Date().toISOString()) {
  return { id, ...validateTask(fields), createdAt: now, updatedAt: now }
}

export function updateTask(tasks, id, fields) {
  if (!tasks.some(task => task.id === id)) throw new Error('任务不存在，请刷新后再试。')
  const valid = validateTask(fields)
  return tasks.map(task => task.id === id ? { ...task, ...valid, updatedAt: new Date().toISOString() } : task)
}
