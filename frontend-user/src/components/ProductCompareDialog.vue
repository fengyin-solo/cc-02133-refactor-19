<template>
  <el-dialog
    v-model="dialogVisible"
    title="产品方案批量对照"
    width="80%"
    top="6vh"
    class="product-compare-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-titles">
          <h3>产品方案批量对照</h3>
          <p>逐条核对各方案能力，核对完成后按方案交接给咨询顾问</p>
        </div>
        <div class="header-summary">
          <el-tag type="info" effect="plain">
            已选 {{ selectedProducts.length }} 个方案
          </el-tag>
          <el-tag :type="allCapabilitiesChecked ? 'success' : 'warning'" effect="plain">
            能力核对 {{ checkedCapabilityCount }}/{{ totalCapabilityCount }}
          </el-tag>
          <el-tag :type="pendingHandoffCount === 0 ? 'success' : 'danger'" effect="plain">
            {{ pendingHandoffCount === 0 ? '已全部交接' : `待交接 ${pendingHandoffCount} 个` }}
          </el-tag>
        </div>
      </div>
    </template>

    <div
      class="compare-table"
      :style="{ '--compare-cols': selectedProducts.length }"
    >
      <!-- 表头 -->
      <div class="compare-row compare-row--head">
        <div class="compare-cell compare-cell--label">对照项</div>
        <div
          v-for="product in selectedProducts"
          :key="product.id"
          class="compare-cell"
        >
          <div class="plan-head">
            <el-icon :size="20" class="plan-icon">
              <component :is="product.icon" />
            </el-icon>
            <div class="plan-name">
              <strong>{{ product.shortTitle }}</strong>
              <span>{{ product.title }}</span>
            </div>
          </div>
          <el-progress
            :percentage="getCheckedProgress(product.id)"
            :stroke-width="6"
            :show-text="false"
          />
          <span class="plan-progress-text">
            已核对 {{ getCheckedCount(product.id) }}/{{ getTotalCapabilityCount(product.id) }} 项能力
          </span>
        </div>
      </div>

      <!-- 方案简介 -->
      <div class="compare-row">
        <div class="compare-cell compare-cell--label">方案简介</div>
        <div
          v-for="product in selectedProducts"
          :key="`${product.id}-desc`"
          class="compare-cell desc-cell"
        >
          {{ product.description }}
        </div>
      </div>

      <!-- 能力逐条核对 -->
      <div
        v-for="(capability, index) in capabilityRows"
        :key="capability.key"
        class="compare-row"
      >
        <div class="compare-cell compare-cell--label">
          <span class="capability-index">能力 {{ index + 1 }}</span>
        </div>
        <div
          v-for="product in selectedProducts"
          :key="`${product.id}-${capability.key}`"
          class="compare-cell capability-cell"
        >
          <template v-if="capability.map[product.id]">
            <el-checkbox
              :model-value="isCapabilityChecked(product.id, capability.map[product.id].title)"
              @update:model-value="(checked) => toggleCapability(product.id, capability.map[product.id].title, checked)"
            >
              <strong>{{ capability.map[product.id].title }}</strong>
            </el-checkbox>
            <p>{{ capability.map[product.id].desc }}</p>
          </template>
          <span v-else class="capability-empty">—</span>
        </div>
      </div>

      <!-- 咨询交接 -->
      <div class="compare-row compare-row--handoff">
        <div class="compare-cell compare-cell--label">咨询交接</div>
        <div
          v-for="product in selectedProducts"
          :key="`${product.id}-handoff`"
          class="compare-cell handoff-cell"
        >
          <el-tag
            v-if="isHandoff(product.id)"
            type="success"
            effect="light"
          >
            <el-icon class="el-icon--left"><CircleCheckFilled /></el-icon>
            已交接
          </el-tag>
          <el-tag v-else type="warning" effect="light">待交接</el-tag>
          <el-button
            :type="isHandoff(product.id) ? 'default' : 'primary'"
            size="small"
            plain
            @click="handoffProduct(product.id)"
          >
            <el-icon class="el-icon--left"><Service /></el-icon>
            {{ isHandoff(product.id) ? '再次咨询' : '咨询交接' }}
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span class="footer-tip">
          能力核对进度 {{ checkedCapabilityCount }}/{{ totalCapabilityCount }}，
          {{ pendingHandoffCount === 0
            ? '全部方案已完成咨询交接'
            : `还有 ${pendingHandoffCount} 个方案待交接` }}
        </span>
        <div class="footer-actions">
          <el-button @click="clearAll">
            <el-icon class="el-icon--left"><Delete /></el-icon>
            清空对照
          </el-button>
          <el-button @click="closeCompare">关闭</el-button>
          <el-button
            type="primary"
            :disabled="pendingHandoffCount === 0"
            @click="handoffAll"
          >
            <el-icon class="el-icon--left"><Promotion /></el-icon>
            整组咨询交接
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { useProductCompare } from '@/composables/useProductCompare'

const {
  compareDialogVisible,
  selectedProducts,
  isCapabilityChecked,
  toggleCapability,
  getCheckedCount,
  getTotalCapabilityCount,
  totalCapabilityCount,
  checkedCapabilityCount,
  isHandoff,
  handoffProduct,
  handoffAll,
  pendingHandoffCount,
  closeCompare,
  clearAll
} = useProductCompare()

const dialogVisible = computed({
  get: () => compareDialogVisible.value,
  set: (value) => {
    compareDialogVisible.value = value
  }
})

const allCapabilitiesChecked = computed(
  () =>
    totalCapabilityCount.value > 0 &&
    checkedCapabilityCount.value === totalCapabilityCount.value
)

// 以各方案能力在列表中的序号对齐为对照行
const capabilityRows = computed(() => {
  const maxCount = Math.max(
    0,
    ...selectedProducts.value.map((product) => product.features.length)
  )

  return Array.from({ length: maxCount }, (_, index) => {
    const map = {}
    selectedProducts.value.forEach((product) => {
      if (product.features[index]) {
        map[product.id] = product.features[index]
      }
    })
    return { key: `capability-${index}`, map }
  })
})

const getCheckedProgress = (productId) => {
  const total = getTotalCapabilityCount(productId)
  if (total === 0) return 0
  return Math.round((getCheckedCount(productId) / total) * 100)
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: $spacing-md;
  padding-right: $spacing-lg;

  h3 {
    margin: 0 0 4px;
    font-size: $font-size-lg;
    color: $text-primary;
  }

  p {
    margin: 0;
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

.header-summary {
  display: flex;
  gap: $spacing-xs;
  flex-shrink: 0;
}

.compare-table {
  border: 1px solid $border-light;
  border-radius: $radius-md;
  overflow-x: auto;
}

.compare-row {
  display: grid;
  grid-template-columns: 120px repeat(var(--compare-cols, 3), minmax(220px, 1fr));
  min-width: 760px;
  border-bottom: 1px solid $border-light;

  &:last-child {
    border-bottom: none;
  }
}

.compare-row--head {
  background: #fafbfc;
}

.compare-cell {
  padding: $spacing-sm $spacing-md;
  border-right: 1px solid $border-light;
  font-size: $font-size-sm;
  color: $text-regular;
  min-width: 0;

  &:last-child {
    border-right: none;
  }
}

.compare-cell--label {
  display: flex;
  align-items: center;
  background: #fafbfc;
  font-weight: 600;
  color: $text-primary;
}

.plan-head {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-xs;
}

.plan-icon {
  color: $primary-color;
  flex-shrink: 0;
}

.plan-name {
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: $font-size-base;
    color: $text-primary;
  }

  span {
    font-size: $font-size-xs;
    color: $text-secondary;
  }
}

.plan-progress-text {
  display: block;
  margin-top: 4px;
  font-size: $font-size-xs;
  color: $text-secondary;
}

.desc-cell {
  line-height: $line-height-base;
}

.capability-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  :deep(.el-checkbox) {
    align-items: flex-start;
    height: auto;

    .el-checkbox__label {
      white-space: normal;
      line-height: 1.5;
    }
  }

  p {
    margin: 0 0 0 24px;
    font-size: $font-size-xs;
    color: $text-secondary;
    line-height: $line-height-base;
  }
}

.capability-empty {
  color: $text-placeholder;
}

.compare-row--handoff {
  background: #fcfcfd;
}

.handoff-cell {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  flex-wrap: wrap;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-md;
  flex-wrap: wrap;
}

.footer-tip {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.footer-actions {
  display: flex;
  gap: $spacing-xs;
}

@media (max-width: $breakpoint-md) {
  .dialog-header {
    flex-direction: column;
  }

  .header-summary {
    flex-wrap: wrap;
  }

  .compare-cell {
    padding: $spacing-xs;
  }

  .footer-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
