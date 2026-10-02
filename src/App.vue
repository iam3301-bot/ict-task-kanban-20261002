<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CATEGORIES, STATUSES, createTask, loadTasks, saveTasks, updateTask } from './board.js'

const columns = [
  { id: 'todo', name: '待办', note: '从这里开始', symbol: '○' },
  { id: 'doing', name: '进行中', note: '专注当下', symbol: '◐' },
  { id: 'done', name: '完成', note: '每一步都算数', symbol: '●' },
]
const tasks = ref([])
const category = ref('全部')
const query = ref('')
const modal = ref(null)
const titleInput = ref(null)
const dialog = ref(null)
const error = ref('')
const toast = ref('')
const blocked = ref(false)
const draggingId = ref(null)
const overColumn = ref(null)
const form = ref({ title: '', description: '', category: '工作', status: 'todo' })
let toastTimer
let previouslyFocused

try { tasks.value = loadTasks(window.localStorage) }
catch (reason) { error.value = reason.message; blocked.value = true }

const visibleTasks = computed(() => tasks.value.filter(task =>
  (category.value === '全部' || task.category === category.value) &&
  (!query.value.trim() || `${task.title} ${task.description}`.toLowerCase().includes(query.value.trim().toLowerCase()))
))
const completed = computed(() => tasks.value.filter(task => task.status === 'done').length)
const progress = computed(() => tasks.value.length ? Math.round(completed.value / tasks.value.length * 100) : 0)
const countFor = value => value === '全部' ? tasks.value.length : tasks.value.filter(task => task.category === value).length
const cardsFor = status => visibleTasks.value.filter(task => task.status === status)

function announce(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3500)
}

function commit(next, message) {
  if (blocked.value) return false
  try {
    tasks.value = saveTasks(window.localStorage, next)
    error.value = ''
    announce(message)
    return true
  } catch (reason) { error.value = reason.message; return false }
}

async function openEditor(task, status = 'todo') {
  previouslyFocused = document.activeElement
  form.value = task ? { title: task.title, description: task.description, category: task.category, status: task.status } :
    { title: '', description: '', category: category.value === '全部' ? '工作' : category.value, status }
  modal.value = { type: 'edit', id: task?.id || null }
  error.value = ''
  await nextTick()
  titleInput.value?.focus()
}

async function openDelete(task) {
  previouslyFocused = document.activeElement
  modal.value = { type: 'delete', id: task.id, title: task.title }
  await nextTick()
  dialog.value?.querySelector('button')?.focus()
}

function closeModal() {
  modal.value = null
  nextTick(() => previouslyFocused?.focus())
}

function submitTask() {
  try {
    const next = modal.value.id ? updateTask(tasks.value, modal.value.id, form.value) : [...tasks.value, createTask(form.value)]
    if (commit(next, modal.value.id ? '任务已更新并保存' : '任务已创建并保存')) closeModal()
  } catch (reason) { error.value = reason.message }
}

function deleteTask() {
  if (commit(tasks.value.filter(task => task.id !== modal.value.id), '任务已删除')) closeModal()
}

function moveTask(id, status) {
  const task = tasks.value.find(item => item.id === id)
  if (!task || !STATUSES.includes(status) || task.status === status) return
  try { commit(updateTask(tasks.value, id, { ...task, status }), `已移至${columns.find(column => column.id === status).name}`) }
  catch (reason) { error.value = reason.message }
}

function startDrag(event, task) {
  if (blocked.value) { event.preventDefault(); return }
  draggingId.value = task.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', task.id)
}

function dropTask(event, status) {
  event.preventDefault()
  // Only move cards dragged from this board, never arbitrary dropped text.
  const id = event.dataTransfer.getData('text/plain')
  if (id && id === draggingId.value) moveTask(id, status)
  endDrag()
}

function endDrag() { draggingId.value = null; overColumn.value = null }

function handleKeys(event) {
  if (!modal.value) return
  if (event.key === 'Escape') { event.preventDefault(); closeModal() }
  if (event.key !== 'Tab') return
  const controls = [...dialog.value.querySelectorAll('button, input, textarea, select')].filter(node => !node.disabled)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

function storageChanged(event) {
  if (event.key !== 'clear-task-board:v1' && event.key !== null) return
  try { tasks.value = loadTasks(window.localStorage); blocked.value = false; announce('已同步其他标签页的更改') }
  catch (reason) { error.value = reason.message; blocked.value = true }
}

onMounted(() => { window.addEventListener('keydown', handleKeys); window.addEventListener('storage', storageChanged) })
onBeforeUnmount(() => { clearTimeout(toastTimer); window.removeEventListener('keydown', handleKeys); window.removeEventListener('storage', storageChanged) })
</script>

<template>
  <div class="workspace">
    <aside class="sidebar">
      <a class="brand" href="./" aria-label="有序任务看板首页"><span class="brand-icon">▦</span><span>有序<small>TASK BOARD</small></span></a>
      <div class="sidebar-caption">个人工作空间</div>
      <div class="active-page"><span>▤</span> 我的任务看板 <span class="active-dot"></span></div>
      <div class="sidebar-caption category-caption">任务分类</div>
      <nav class="category-nav" aria-label="按分类筛选任务">
        <button v-for="item in ['全部', ...CATEGORIES]" :key="item" :class="{ selected: category === item }" :aria-pressed="category === item" @click="category = item">
          <span><i class="category-dot" :data-category="item"></i>{{ item === '全部' ? '全部任务' : item }}</span><b>{{ countFor(item) }}</b>
        </button>
      </nav>
      <div class="sidebar-bottom"><span class="device-icon">▣</span><div>数据保存在当前浏览器<small>无需登录 · 刷新后仍保留</small></div></div>
    </aside>

    <main>
      <header class="topbar"><span>工作空间 <span class="breadcrumb-slash">/</span> <strong>任务看板</strong></span><span class="local-indicator"><i></i>本地保存</span></header>
      <div class="main-content">
        <section class="page-heading"><div><p class="eyebrow">让想法有序，让行动发生</p><h1>我的任务看板<span>✦</span></h1><p class="intro">把任务放进看板，按自己的节奏一步步完成。</p></div><button class="primary-button new-task" :disabled="blocked" @click="openEditor(null)"><span>＋</span> 新建任务</button></section>

        <section class="overview" aria-label="任务进度">
          <div class="overview-item"><span class="stat-icon total-icon">▤</span><div><span>全部任务</span><strong>{{ tasks.length }}<small>项</small></strong></div></div>
          <div class="overview-item"><span class="stat-icon doing-icon">◐</span><div><span>正在推进</span><strong>{{ tasks.filter(task => task.status === 'doing').length }}<small>项</small></strong></div></div>
          <div class="overview-item"><span class="stat-icon done-icon">✓</span><div><span>已经完成</span><strong>{{ completed }}<small>项</small></strong></div></div>
          <div class="progress-item"><div><span>完成进度</span><strong>{{ progress }}%</strong></div><div class="progress-track" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="任务完成百分比"><span :style="{ width: `${progress}%` }"></span></div></div>
        </section>

        <div v-if="error && !modal" class="error-message" role="alert">{{ error }}</div>
        <section class="board-toolbar"><div><h2>{{ category === '全部' ? '全部任务' : `${category}任务` }}</h2><span>{{ visibleTasks.length }} 项</span></div><label class="search-box"><span aria-hidden="true">⌕</span><input v-model="query" type="search" placeholder="搜索标题或描述" aria-label="搜索任务标题或描述" /></label></section>
        <p class="board-hint">拖动卡片切换状态，也可以使用卡片底部的状态菜单。</p>

        <section class="board" aria-label="任务看板">
          <section v-for="column in columns" :key="column.id" class="board-column" :class="[column.id, { 'drag-over': overColumn === column.id }]" :aria-label="column.name" @dragover.prevent="draggingId && (overColumn = column.id)" @dragleave.self="overColumn = null" @drop="dropTask($event, column.id)">
            <header class="column-header"><div><span class="status-symbol">{{ column.symbol }}</span><h3>{{ column.name }}</h3><span class="column-count">{{ cardsFor(column.id).length }}</span></div><button class="icon-button" :disabled="blocked" :aria-label="`新建${column.name}任务`" @click="openEditor(null, column.id)">＋</button></header>
            <p class="column-note">{{ column.note }}</p>
            <div class="card-list">
              <article v-for="task in cardsFor(column.id)" :key="task.id" class="task-card" :class="{ dragging: draggingId === task.id }" :draggable="!blocked" @dragstart="startDrag($event, task)" @dragend="endDrag">
                <div class="card-top"><span class="category-badge" :data-category="task.category">{{ task.category }}</span><div class="card-actions"><button class="icon-button" :disabled="blocked" :aria-label="`编辑任务：${task.title}`" @click="openEditor(task)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 4 4 4M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15v5Z"/></svg></button><button class="icon-button delete-button" :disabled="blocked" :aria-label="`删除任务：${task.title}`" @click="openDelete(task)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg></button></div></div>
                <h4>{{ task.title }}</h4><p v-if="task.description" class="card-description">{{ task.description }}</p><p v-else class="card-description no-description">暂未添加描述</p>
                <footer class="card-footer"><span class="drag-handle" aria-hidden="true">⠿</span><label><span class="sr-only">任务状态：{{ task.title }}</span><select :value="task.status" :disabled="blocked" @change="moveTask(task.id, $event.target.value)"><option v-for="option in columns" :key="option.id" :value="option.id">{{ option.name }}</option></select></label></footer>
              </article>
              <div v-if="!cardsFor(column.id).length" class="empty-column"><span aria-hidden="true">{{ column.symbol }}</span><p>{{ query ? '没有符合搜索的任务' : '这里还没有任务' }}</p><small>{{ query ? '试试其他关键词' : '新建任务，或把卡片拖到这里' }}</small></div>
            </div>
            <button class="add-card" :disabled="blocked" @click="openEditor(null, column.id)">＋ 添加任务</button>
          </section>
        </section>
        <footer class="page-footer"><span>小步前进，也是一种进步。</span><span>有序 · 轻量任务管理</span></footer>
      </div>
    </main>
  </div>

  <div v-if="modal" class="modal-backdrop" @click.self="closeModal">
    <section ref="dialog" class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <header class="modal-header"><h2 id="dialog-title">{{ modal.type === 'delete' ? '删除任务' : modal.id ? '编辑任务' : '新建任务' }}</h2><button class="icon-button" aria-label="关闭弹窗" @click="closeModal">×</button></header>
      <template v-if="modal.type === 'delete'"><p class="delete-copy">确定删除「{{ modal.title }}」？删除后无法恢复。</p><div class="modal-buttons"><button class="secondary-button" @click="closeModal">取消</button><button class="danger-button" @click="deleteTask">确认删除</button></div></template>
      <form v-else @submit.prevent="submitTask">
        <label class="form-field">任务标题 <span class="required">*</span><input ref="titleInput" v-model="form.title" required maxlength="80" placeholder="例如：准备本周项目汇报" /><small>{{ form.title.length }} / 80</small></label>
        <label class="form-field">任务描述<textarea v-model="form.description" rows="4" maxlength="1000" placeholder="记录目标、步骤或需要注意的细节（可选）"></textarea><small>{{ form.description.length }} / 1000</small></label>
        <div class="form-row"><label class="form-field">分类<select v-model="form.category"><option v-for="item in CATEGORIES" :key="item">{{ item }}</option></select></label><label class="form-field">状态<select v-model="form.status"><option v-for="column in columns" :key="column.id" :value="column.id">{{ column.name }}</option></select></label></div>
        <p v-if="error" class="error-message" role="alert">{{ error }}</p>
        <div class="modal-buttons"><button type="button" class="secondary-button" @click="closeModal">取消</button><button class="primary-button" type="submit">{{ modal.id ? '保存修改' : '创建任务' }}</button></div>
      </form>
    </section>
  </div>
  <div class="toast-container" role="status" aria-live="polite"><div v-if="toast" class="toast">✓ {{ toast }}</div></div>
</template>
