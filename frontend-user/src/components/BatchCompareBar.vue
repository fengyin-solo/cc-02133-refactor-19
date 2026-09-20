<template>
  <div class="batch-compare-bar">
    <div class="bar-inner">
      <!-- 选择入口 -->
      <el-popover
        v-model:visible="popoverVisible"
        placement="top-start"
        :width="320"
        trigger="click"
        popper-class="batch-compare-popover"
      >
        <template #reference>
          <el-button plain>
            <el-icon class="el-icon--left"><Checked /></el-icon>
            批量选择方案
            <el-badge
              :value="selectedCount"
              :hidden="selectedCount === 0"
              :max="compareMax"
              class="count-badge"
            />
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
        </template>

        <div class="compare-picker">
          <div class="picker-header">
            <span>选择需要对照的方案</span>
            <span class="picker-limit">
              最多 {{ compareMax }} 个 · 已选 {{ draftIds.length }} 个
            </span>
          </div>

          <div class="picker-options" role="group" aria-label="选择需要对照的产品方案">
            <div
              v-for="product in comparableProducts"
              :key="product.id"
              class="picker-option"
              :class="{
                'is-disabled': isDraftDisabled(product.id),
                'is-checked': draftIds.includes(product.id)
              }"
              @click="handleDisabledOption(product.id)"
            >
              <el-checkbox
                v-model="draftChecks[product.id]"
                :disabled="isDraftDisabled(product.id)"
                class="row-checkbox"
              >
                <span class="option-name">{{ product.shortTitle }}</span>
                <span class="option-title">{{ product.title }}</span>
              </el-checkbox>
            </div>
          </div>

          <div class="picker-footer">
            <el-button
              text
              size="small"
              :disabled="draftIds.length === 0"
              @click="draftIds = []"
            >
              清空
            </el-button>
            <div class="picker-actions">
              <el-button
                size="small"
                :disabled="draftIds.length !== comparableProducts.length"
                @click="submitAllDrafts"
              >
                三个方案整组对照
              </el-button>
              <el-button
                type="primary"
                size="small"
                @click="submitDrafts"
              >
                整组提交
              </el-button>
            </div>
          </div>
        </div>
      </el-popover>

      <!-- 已选方案 -->
      <div class="selected-area">
        <template v-if="selectedCount > 0">
          <el-tag
            v-for="id in selectedIds"
            :key="id"
            closable
            disable-transitions
            class="selected-tag"
            @close.stop="remove(id)"
          >
            {{ getProductById(id)?.shortTitle || id }}
          </el-tag>
        </template>
        <span v-else class="empty-tip">
          尚未选择方案，可同时对照 {{ compareMin }}-{{ compareMax }} 个核心产品
          <el-tooltip content="仅智慧仓储、运输管理、配送调度三个核心方案支持批量对照" placement="top">
            <el-icon class="tip-icon"><InfoFilled /></el-icon>
          </el-tooltip>
        </span>
      </div>

      <!-- 操作区 -->
      <div class="bar-actions">
        <el-button
          text
          :disabled="selectedCount === 0"
          @click="clearAll"
        >
          <el-icon class="el-icon--left"><Delete /></el-icon>
          清空
        </el-button>
        <el-button
          type="primary"
          @click="openCompare()"
        >
          <el-icon class="el-icon--left"><ScaleToOriginal /></el-icon>
          开始对照（{{ selectedCount }}/{{ compareMax }}）
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getProductById } from '@/data/products'
import { useProductCompare } from '@/composables/useProductCompare'

const {
  comparableProducts,
  compareMin,
  compareMax,
  selectedIds,
  selectedCount,
  remove,
  clearAll,
  openCompare,
  applySelections
} = useProductCompare()

const popoverVisible = ref(false)
const draftIds = ref([])

// el-checkbox 直接绑定布尔状态，写回时复用同一套上限处理
const draftChecks = {}
comparableProducts.forEach((product) => {
  draftChecks[product.id] = computed({
    get: () => draftIds.value.includes(product.id),
    set: (checked) => {
      if (checked) {
        if (draftIds.value.length < compareMax && !draftIds.value.includes(product.id)) {
          draftIds.value = [...draftIds.value, product.id]
        }
      } else {
        draftIds.value = draftIds.value.filter((id) => id !== product.id)
      }
    }
  })
})

const syncDraft = () => {
  draftIds.value = [...selectedIds.value]
}

// popover 打开时同步草稿，保证切换标签/页面后批量状态仍稳定
watch(popoverVisible, (visible) => {
  if (visible) syncDraft()
})

const isDraftDisabled = (id) =>
  draftIds.value.length >= compareMax && !draftIds.value.includes(id)

const handleDisabledOption = (id) => {
  // checkbox 禁用时仍由行点击补充超限说明，启用状态下点击事件交给 checkbox 处理
  if (isDraftDisabled(id)) {
    ElMessage.warning(`最多只能对照${compareMax}个产品方案，请先取消已选方案`)
  }
}

const submitDrafts = () => {
  const result = applySelections(draftIds.value)
  if (!result.ok) return
  const submitResult = openCompare()
  if (submitResult?.ok) {
    popoverVisible.value = false
  }
}

const submitAllDrafts = () => {
  draftIds.value = comparableProducts.map((product) => product.id)
  submitDrafts()
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.batch-compare-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  padding: $spacing-sm $spacing-md;
  pointer-events: none;

  .bar-inner {
    pointer-events: auto;
  }
}

.bar-inner {
  max-width: $container-width;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-sm $spacing-md;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid $border-light;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
}

.count-badge {
  margin-left: 4px;
}

.selected-area {
  flex: 1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-xs;
  min-height: 32px;
}

.selected-tag {
  font-weight: 500;
}

.empty-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: $font-size-sm;
  color: $text-secondary;
}

.tip-icon {
  color: $text-placeholder;
  cursor: help;
}

.bar-actions {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  flex-shrink: 0;
}
</style>

<style lang="scss">
.batch-compare-popover {
  --el-popover-padding: 0;

  .compare-picker {
    font-size: 14px;
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e4e7ed;
    font-weight: 600;
    color: #303133;
  }

  .picker-limit {
    font-size: 12px;
    font-weight: 400;
    color: #909399;
  }

  .picker-options {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    max-height: 280px;
    overflow-y: auto;
  }

  .picker-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 8px 16px;
    cursor: pointer;
    transition: background 0.2s;

    :deep(.row-checkbox) {
      align-items: flex-start;
      height: auto;

      .el-checkbox__label {
        white-space: normal;
        line-height: 1.5;
      }
    }
    &:hover {
      background: #f5f7fa;
    }

    &.is-checked {
      background: rgba(24, 144, 255, 0.06);
    }

    &.is-disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }

  .option-name {
    font-weight: 500;
    color: #303133;
  }

  .option-title {
    display: block;
    margin-top: 2px;
    padding-left: 0;
    font-size: 12px;
    color: #909399;
  }

  .picker-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-top: 1px solid #e4e7ed;
  }

  .picker-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
