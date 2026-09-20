<template>
  <Transition name="compare-bar">
    <div v-if="selectedProducts.length > 0" class="compare-bar">
      <div class="compare-bar__inner">
        <div class="compare-bar__selected">
          <span class="compare-bar__label">
            已选 {{ selectedProducts.length }}/{{ COMPARE_LIMIT }} 个方案
          </span>
          <div class="compare-bar__tags">
            <el-tag
              v-for="product in selectedProducts"
              :key="product.id"
              closable
              type="primary"
              effect="light"
              @close="removeSelected(product.id)"
            >
              <el-icon class="tag-icon"><component :is="product.icon" /></el-icon>
              {{ product.shortTitle }}
            </el-tag>
          </div>
        </div>
        <div class="compare-bar__actions">
          <el-button text @click="handleClear">
            清空
          </el-button>
          <el-button type="primary" size="large" @click="handleSubmit">
            <el-icon class="el-icon--left"><ScaleToOriginal /></el-icon>
            整组对照
          </el-button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { useProductCompare } from '@/composables/useProductCompare'

const {
  COMPARE_LIMIT,
  selectedProducts,
  removeSelected,
  clearSelection,
  submitCompare
} = useProductCompare()

// 整组提交：空/重复/超限提示由共用流程统一给出
const handleSubmit = () => {
  if (selectedProducts.value.length === 0) {
    ElMessage.warning('请先勾选需要对照的方案')
    return
  }
  submitCompare()
}

const handleClear = () => {
  clearSelection()
  ElMessage.info('已清空对照选择')
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.compare-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  padding: $spacing-md $spacing-lg;
  background: rgba(26, 26, 46, 0.96);
  backdrop-filter: blur(8px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.18);

  &__inner {
    max-width: $container-width;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-lg;
  }

  &__selected {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex: 1;
    min-width: 0;
  }

  &__label {
    color: rgba(255, 255, 255, 0.85);
    font-size: $font-size-sm;
    white-space: nowrap;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;

    :deep(.el-tag) {
      display: inline-flex;
      align-items: center;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-shrink: 0;
  }

  .tag-icon {
    margin-right: 4px;
  }

  :deep(.el-button.is-text) {
    color: rgba(255, 255, 255, 0.65);

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.08);
    }
  }
}

.compare-bar-enter-active,
.compare-bar-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.compare-bar-enter-from,
.compare-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: $breakpoint-md) {
  .compare-bar__inner {
    flex-direction: column;
    align-items: stretch;
    gap: $spacing-sm;
  }

  .compare-bar__actions {
    justify-content: flex-end;
  }
}
</style>
