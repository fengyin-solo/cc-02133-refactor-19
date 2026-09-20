import { ref, computed, watch } from 'vue'

/**
 * 批量选择共用流程
 *
 * 收拢“空选择 / 重复方案 / 超过上限 / 非法方案”的重复状态处理，
 * 选择状态统一持久化，切换标签或路由后仍保持稳定。
 *
 * @param {Object} options
 * @param {() => string[]} options.getAllowedIds 合法方案ID集合
 * @param {(id: string) => string} [options.getLabel] 方案名称，用于提示文案
 * @param {number} [options.min] 发起批量操作的最小数量
 * @param {number} [options.max] 允许选择的最大数量
 * @param {string} [options.storageKey] 持久化 key，为空则不持久化
 * @param {string} [options.entityName] 方案实体名称，如“产品方案”
 * @param {(notification: { type: string, message: string }) => void} [options.notify] 提示回调
 */
export function createBatchSelection(options) {
  const {
    getAllowedIds,
    getLabel = (id) => id,
    min = 2,
    max = 3,
    storageKey = '',
    entityName = '方案',
    notify = null
  } = options

  const readPersistedIds = () => {
    if (!storageKey) return []
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }

  const selectedIds = ref(readPersistedIds())

  const allowedIdSet = computed(() => new Set(getAllowedIds()))
  const selectedCount = computed(() => selectedIds.value.length)
  const hasSelection = computed(() => selectedIds.value.length > 0)

  // 启动时清理会话中残留的非法/重复ID，保证切换标签后批量状态稳定
  if (selectedIds.value.length > 0) {
    const validIds = new Set(allowedIdSet.value)
    selectedIds.value = [...new Set(selectedIds.value.filter((id) => validIds.has(id)))]
  }

  const sendNotice = (type, message) => {
    if (notify && message) notify({ type, message })
  }

  const persist = () => {
    if (!storageKey) return
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(selectedIds.value))
    } catch {
      // 会话存储不可用时仅保持内存状态
    }
  }

  watch(selectedIds, persist, { deep: true })

  const isSelected = (id) => selectedIds.value.includes(String(id))

  /**
   * 将单个ID、对象或数组统一规整为ID数组
   */
  const normalizeIds = (raw) => {
    if (raw === undefined || raw === null || raw === '') return []
    const list = Array.isArray(raw) ? raw : [raw]
    return list
      .map((item) => {
        if (item === null || item === undefined) return ''
        if (typeof item === 'object') return String(item.id ?? '')
        return String(item)
      })
      .filter(Boolean)
  }

  /**
   * 一次提交整组选择（替换语义），重复与超限项明确忽略并返回核对结果
   */
  const applySelections = (raw, { silent = false } = {}) => {
    const candidates = normalizeIds(raw)
    const allowed = allowedIdSet.value

    if (candidates.length === 0) {
      const message = `请先选择需要对照的${entityName}`
      if (!silent) sendNotice('warning', message)
      return {
        ok: false,
        ids: [...selectedIds.value],
        accepted: [],
        rejected: [],
        ignored: [],
        reasons: { empty: true, duplicate: [], invalid: [], overLimit: [] },
        message
      }
    }

    const accepted = []
    const seen = new Set()
    const duplicate = []
    const invalid = []
    const overLimit = []

    candidates.forEach((id) => {
      if (!allowed.has(id)) {
        invalid.push(id)
        return
      }
      if (seen.has(id)) {
        duplicate.push(id)
        return
      }
      if (accepted.length >= max) {
        overLimit.push(id)
        return
      }
      seen.add(id)
      accepted.push(id)
    })

    const ignored = [...duplicate, ...invalid, ...overLimit]
    const messages = []

    if (invalid.length > 0) {
      messages.push(`已忽略不可对照的${entityName}：${invalid.map(getLabel).join('、')}`)
    }
    if (duplicate.length > 0) {
      messages.push(`重复选择已忽略：${[...new Set(duplicate)].map(getLabel).join('、')}`)
    }
    if (overLimit.length > 0) {
      messages.push(`最多对照${max}个${entityName}，已忽略：${[...new Set(overLimit)].map(getLabel).join('、')}`)
    }

    selectedIds.value = accepted

    if (!silent && messages.length > 0) {
      sendNotice('warning', messages.join('；'))
    }

    return {
      ok: accepted.length > 0,
      ids: accepted,
      accepted,
      rejected: ignored,
      ignored,
      reasons: { empty: false, duplicate, invalid, overLimit },
      message: messages.join('；')
    }
  }

  const add = (id, { silent = false } = {}) => {
    const normalized = String(id)

    if (!allowedIdSet.value.has(normalized)) {
      if (!silent) sendNotice('warning', `${getLabel(normalized)}暂不支持对照，已忽略`)
      return false
    }
    if (isSelected(normalized)) {
      if (!silent) sendNotice('info', `${getLabel(normalized)}已在对照清单中，无需重复选择`)
      return false
    }
    if (selectedIds.value.length >= max) {
      if (!silent) sendNotice('warning', `最多只能对照${max}个${entityName}，请先移除其他方案`)
      return false
    }

    selectedIds.value = [...selectedIds.value, normalized]
    return true
  }

  const remove = (id) => {
    const normalized = String(id)
    if (!isSelected(normalized)) return false
    selectedIds.value = selectedIds.value.filter((item) => item !== normalized)
    return true
  }

  const toggle = (id, force) => {
    const shouldAdd = typeof force === 'boolean' ? force : !isSelected(id)
    return shouldAdd ? add(id) : remove(id)
  }

  const clear = ({ silent = true } = {}) => {
    if (selectedIds.value.length === 0) return
    selectedIds.value = []
    if (!silent) sendNotice('info', `已清空${entityName}对照清单`)
  }

  /**
   * 发起整组对照：先收拢空选择/下限校验，通过后由调用方打开对照视图
   */
  const submit = (raw) => {
    const useCurrent = raw === undefined
    let ids = selectedIds.value

    if (!useCurrent) {
      const result = applySelections(raw)
      ids = result.ids
      if (!result.ok) return { ok: false, ids }
    }

    if (ids.length === 0) {
      sendNotice('warning', `请先选择需要对照的${entityName}`)
      return { ok: false, ids: [] }
    }
    if (ids.length < min) {
      sendNotice('warning', `至少选择${min}个${entityName}才能发起对照，当前已选${ids.length}个`)
      return { ok: false, ids: [...ids] }
    }

    return { ok: true, ids: [...ids] }
  }

  return {
    selectedIds,
    selectedCount,
    hasSelection,
    isSelected,
    normalizeIds,
    applySelections,
    add,
    remove,
    toggle,
    clear,
    submit
  }
}
