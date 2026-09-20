import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { products as ALL_PRODUCTS, getProductById } from '@/data/products'

// 一次最多可对照的方案数量
export const COMPARE_LIMIT = 3

// 忽略原因
export const IgnoreReason = {
  EMPTY: 'empty',
  INVALID: 'invalid',
  DUPLICATE: 'duplicate',
  EXCEED_LIMIT: 'exceed_limit'
}

const REASON_TEXT = {
  [IgnoreReason.EMPTY]: '未选择任何方案，已忽略',
  [IgnoreReason.INVALID]: '存在无效方案，已忽略',
  [IgnoreReason.DUPLICATE]: '存在重复方案，已自动去重',
  [IgnoreReason.EXCEED_LIMIT]: `最多可对照 ${COMPARE_LIMIT} 个方案，超出部分已忽略`
}

const STORAGE_KEY = 'zhiyun-compare-ids'
const HANDOFF_STORAGE_KEY = 'zhiyun-compare-handoff'

/**
 * 共用的方案批量选择与对照流程
 * 模块级单例状态：切换标签/切换组件后批量状态保持稳定
 */
const selectedIds = ref([])
const compareVisible = ref(false)
// 本次「整组提交」真正进入对照的方案（仅打开对照弹窗时更新，避免核对过程被勾选变化打断）
const compareGroup = ref([])
// 逐条核对：已核对过的能力 key（productId + featureTitle）
const checkedCapabilities = ref({})
// 咨询交接标记：完成对照并交接后展示
const handedOver = ref(false)

const selectedProducts = computed(() =>
  selectedIds.value.map((id) => getProductById(id)).filter(Boolean)
)

const compareGroupProducts = computed(() =>
  compareGroup.value.map((id) => getProductById(id)).filter(Boolean)
)

// ---------- 持久化（刷新后仍保持批量状态） ----------
const loadFromStorage = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const ids = JSON.parse(raw)
      if (Array.isArray(ids)) {
        selectedIds.value = ids.filter((id) => getProductById(id))
      }
    }
  } catch (e) {
    // 存储不可用时静默降级为内存状态
  }
}

const saveToStorage = () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds.value))
  } catch (e) {
    // ignore
  }
}

loadFromStorage()

// ---------- 共用归一化流程：空选择 / 重复 / 超限统一在此处理 ----------
/**
 * 归一化一批待提交的方案 id
 * @param {string[]} ids 候选 id 列表
 * @returns {{ accepted: string[], ignored: {id: string|null, reason: string, label: string}[] }}
 */
export const normalizeSelection = (ids) => {
  const accepted = []
  const ignored = []

  const list = Array.isArray(ids) ? ids.filter((id) => id != null && id !== '') : []

  if (list.length === 0) {
    ignored.push({ id: null, reason: IgnoreReason.EMPTY, label: REASON_TEXT[IgnoreReason.EMPTY] })
    return { accepted, ignored }
  }

  list.forEach((id) => {
    if (!getProductById(id)) {
      ignored.push({ id, reason: IgnoreReason.INVALID, label: REASON_TEXT[IgnoreReason.INVALID] })
      return
    }
    if (accepted.includes(id)) {
      ignored.push({ id, reason: IgnoreReason.DUPLICATE, label: REASON_TEXT[IgnoreReason.DUPLICATE] })
      return
    }
    if (accepted.length >= COMPARE_LIMIT) {
      ignored.push({ id, reason: IgnoreReason.EXCEED_LIMIT, label: REASON_TEXT[IgnoreReason.EXCEED_LIMIT] })
      return
    }
    accepted.push(id)
  })

  return { accepted, ignored }
}

// 将忽略项按原因聚合成用户可读提示
export const buildIgnoreMessages = (ignored) => {
  const reasons = new Map()
  ignored.forEach((item) => {
    if (!reasons.has(item.reason)) reasons.set(item.reason, [])
    if (item.id) {
      const product = getProductById(item.id)
      reasons.get(item.reason).push(product ? product.shortTitle : item.id)
    }
  })

  const messages = []
  reasons.forEach((labels, reason) => {
    if (labels.length) {
      const names = labels.join('、')
      if (reason === IgnoreReason.DUPLICATE) {
        messages.push(`「${names}」与已选方案重复，已忽略`)
      } else if (reason === IgnoreReason.EXCEED_LIMIT) {
        messages.push(`「${names}」超过 ${COMPARE_LIMIT} 个的对照上限，已忽略`)
      } else if (reason === IgnoreReason.INVALID) {
        messages.push(`「${names}」不是有效方案，已忽略`)
      }
    } else {
      messages.push(REASON_TEXT[reason])
    }
  })
  return messages
}

// ---------- 选择操作 ----------
const isSelected = (productId) => selectedIds.value.includes(productId)

const toggleSelect = (productId) => {
  if (!getProductById(productId)) {
    ElMessage.warning('该方案无效，无法加入对照')
    return false
  }
  if (isSelected(productId)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== productId)
    saveToStorage()
    return false
  }
  if (selectedIds.value.length >= COMPARE_LIMIT) {
    ElMessage.warning(`最多只能选择 ${COMPARE_LIMIT} 个方案进行对照，已忽略本次选择`)
    return false
  }
  selectedIds.value = [...selectedIds.value, productId]
  saveToStorage()
  return true
}

const removeSelected = (productId) => {
  selectedIds.value = selectedIds.value.filter((id) => id !== productId)
  saveToStorage()
}

const clearSelection = () => {
  selectedIds.value = []
  checkedCapabilities.value = {}
  handedOver.value = false
  saveToStorage()
}

// ---------- 整组提交对照 ----------
/**
 * 一次提交整组方案进入对照
 * 空选择 / 重复 / 超限全部走 normalizeSelection 这一个共用流程
 */
const submitCompare = (ids = selectedIds.value) => {
  const { accepted, ignored } = normalizeSelection(ids)

  buildIgnoreMessages(ignored).forEach((msg) => ElMessage.warning(msg))

  if (accepted.length === 0) {
    // 全部被忽略（如空提交），不打开对照
    compareVisible.value = false
    return { ok: false, accepted, ignored }
  }

  // 以本次实际通过的一组为准，保持整组稳定
  selectedIds.value = [...accepted]
  saveToStorage()
  compareGroup.value = [...accepted]
  checkedCapabilities.value = {}
  handedOver.value = false
  compareVisible.value = true
  return { ok: true, accepted, ignored }
}

const closeCompare = () => {
  compareVisible.value = false
}

// ---------- 逐条核对能力 ----------
const capabilityKey = (productId, featureTitle) => `${productId}::${featureTitle}`

const isCapabilityChecked = (productId, featureTitle) =>
  !!checkedCapabilities.value[capabilityKey(productId, featureTitle)]

const toggleCapability = (productId, featureTitle) => {
  const key = capabilityKey(productId, featureTitle)
  const next = { ...checkedCapabilities.value }
  if (next[key]) {
    delete next[key]
  } else {
    next[key] = true
  }
  checkedCapabilities.value = next
}

const checkedCount = computed(() => Object.keys(checkedCapabilities.value).length)

const totalCapabilityCount = computed(() =>
  compareGroupProducts.value.reduce((sum, p) => sum + p.features.length, 0)
)

// ---------- 咨询交接 ----------
const handoffToConsultant = () => {
  const ids = [...compareGroup.value]
  if (ids.length === 0) {
    ElMessage.warning('没有可交接的对照方案')
    return null
  }
  const names = ids
    .map((id) => getProductById(id))
    .filter(Boolean)
    .map((p) => p.shortTitle)

  // 用咨询内容描述，ContactView 读取后预填
  const summary = `希望对照了解以下方案：${names.join('、')}（共 ${names.length} 个），请顾问协助逐条讲解能力与实施建议。`

  const handoff = {
    ids,
    names,
    summary,
    checkedCount: checkedCount.value,
    time: new Date().toISOString()
  }

  try {
    sessionStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(handoff))
  } catch (e) {
    // ignore
  }

  handedOver.value = true
  ElMessage.success('对照清单已交接给咨询顾问，正在为您跳转…')
  return handoff
}

export const consumeHandoff = () => {
  try {
    const raw = sessionStorage.getItem(HANDOFF_STORAGE_KEY)
    if (raw) {
      sessionStorage.removeItem(HANDOFF_STORAGE_KEY)
      return JSON.parse(raw)
    }
  } catch (e) {
    // ignore
  }
  return null
}

export function useProductCompare() {
  return {
    allProducts: ALL_PRODUCTS,
    COMPARE_LIMIT,
    selectedIds,
    selectedProducts,
    compareVisible,
    compareGroup,
    compareGroupProducts,
    checkedCapabilities,
    checkedCount,
    totalCapabilityCount,
    handedOver,
    isSelected,
    toggleSelect,
    removeSelected,
    clearSelection,
    submitCompare,
    closeCompare,
    isCapabilityChecked,
    toggleCapability,
    handoffToConsultant,
    getProductById
  }
}
