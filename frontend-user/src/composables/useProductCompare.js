import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { comparableProducts, getProductById } from '@/data/products'
import { createBatchSelection } from '@/composables/useBatchSelection'

const COMPARE_MIN = 2
const COMPARE_MAX = 3
const STORAGE_KEYS = {
  selection: 'product-compare:selection',
  checked: 'product-compare:checked-capabilities',
  handoff: 'product-compare:handoffs'
}

const readStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// 模块级单例：产品页、批量操作条、对照弹窗共享同一份状态，切换标签后不丢失
const batchSelection = createBatchSelection({
  getAllowedIds: () => comparableProducts.map((product) => product.id),
  getLabel: (id) => getProductById(id)?.shortTitle || id,
  min: COMPARE_MIN,
  max: COMPARE_MAX,
  storageKey: STORAGE_KEYS.selection,
  entityName: '产品方案',
  notify: ({ type, message }) => {
    ElMessage({ type, message, grouping: true })
  }
})

const compareDialogVisible = ref(false)

const capabilityCheckedMap = ref(
  readStorage(STORAGE_KEYS.checked, {})
)
const handoffIds = ref(readStorage(STORAGE_KEYS.handoff, []))

watch(
  capabilityCheckedMap,
  (value) => {
    try {
      window.sessionStorage.setItem(STORAGE_KEYS.checked, JSON.stringify(value))
    } catch {
      // 会话存储不可用时仅保持内存状态
    }
  },
  { deep: true }
)

watch(handoffIds, (value) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEYS.handoff, JSON.stringify(value))
  } catch {
    // 会话存储不可用时仅保持内存状态
  }
}, { deep: true })

/**
 * 产品方案批量对照流程
 * 选择与提交复用 createBatchSelection 的空选/重复/超限处理；
 * 此处补充能力逐条核对与咨询交接状态。
 */
export function useProductCompare() {
  const selectedProducts = computed(() =>
    batchSelection.selectedIds.value
      .map((id) => getProductById(id))
      .filter(Boolean)
  )

  const isCapabilityChecked = (productId, capabilityTitle) =>
    Boolean(capabilityCheckedMap.value[productId]?.[capabilityTitle])

  const toggleCapability = (productId, capabilityTitle, force) => {
    const productChecks = {
      ...(capabilityCheckedMap.value[productId] || {})
    }
    const checked = typeof force === 'boolean'
      ? force
      : !productChecks[capabilityTitle]

    if (checked) {
      productChecks[capabilityTitle] = true
    } else {
      delete productChecks[capabilityTitle]
    }

    capabilityCheckedMap.value = {
      ...capabilityCheckedMap.value,
      [productId]: productChecks
    }
  }

  const getCheckedCount = (productId) => {
    const checks = capabilityCheckedMap.value[productId] || {}
    return Object.keys(checks).filter((key) => checks[key]).length
  }

  const getTotalCapabilityCount = (productId) =>
    getProductById(productId)?.features?.length || 0

  const isHandoff = (productId) => handoffIds.value.includes(productId)

  const totalCapabilityCount = computed(() =>
    selectedProducts.value.reduce(
      (sum, product) => sum + getTotalCapabilityCount(product.id),
      0
    )
  )

  const checkedCapabilityCount = computed(() =>
    selectedProducts.value.reduce((sum, product) => sum + getCheckedCount(product.id), 0)
  )

  const pendingHandoffCount = computed(() =>
    selectedProducts.value.filter((product) => !isHandoff(product.id)).length
  )

  const persistCheckedMap = () => {
    capabilityCheckedMap.value = { ...capabilityCheckedMap.value }
  }

  const markHandoff = (ids) => {
    const idList = (Array.isArray(ids) ? ids : [ids]).map(String)
    const merged = new Set([...handoffIds.value, ...idList])
    handoffIds.value = [...merged]
  }

  const goConsultation = (ids) => {
    const plans = ids.map(String).filter((id) => getProductById(id))
    if (plans.length === 0) return
    markHandoff(plans)
    router.push({
      path: '/contact',
      query: {
        source: 'product-compare',
        plans: plans.join(',')
      }
    })
  }

  const handoffProduct = (productId) => {
    markHandoff([productId])
    const product = getProductById(productId)
    compareDialogVisible.value = false
    ElMessage.success(`${product?.shortTitle || productId}已完成咨询交接，正在进入咨询页`)
    goConsultation([productId])
  }

  const handoffAll = () => {
    const ids = batchSelection.selectedIds.value
    if (ids.length === 0) {
      ElMessage.warning('请先选择需要对照的产品方案')
      return
    }
    markHandoff(ids)
    compareDialogVisible.value = false
    ElMessage.success('整组方案已完成咨询交接，正在进入咨询页')
    goConsultation(ids)
  }

  const openCompare = (raw) => {
    const result = batchSelection.submit(raw)
    if (!result.ok) return result
    compareDialogVisible.value = true
    persistCheckedMap()
    return result
  }

  const closeCompare = () => {
    compareDialogVisible.value = false
  }

  const clearAll = () => {
    const currentIds = [...batchSelection.selectedIds.value]
    batchSelection.clear({ silent: false })
    currentIds.forEach((id) => {
      delete capabilityCheckedMap.value[id]
    })
    handoffIds.value = handoffIds.value.filter((id) => !currentIds.includes(id))
    compareDialogVisible.value = false
  }

  return {
    // 选择规则
    comparableProducts,
    compareMin: COMPARE_MIN,
    compareMax: COMPARE_MAX,
    ...batchSelection,

    // 弹窗状态
    compareDialogVisible,
    selectedProducts,
    openCompare,
    closeCompare,

    // 能力核对
    isCapabilityChecked,
    toggleCapability,
    getCheckedCount,
    getTotalCapabilityCount,
    totalCapabilityCount,
    checkedCapabilityCount,

    // 咨询交接
    handoffIds,
    isHandoff,
    handoffProduct,
    handoffAll,
    pendingHandoffCount,

    // 清空整组流程状态
    clearAll
  }
}
