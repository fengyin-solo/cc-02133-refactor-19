<template>
  <el-dialog
    :model-value="compareVisible"
    title="方案能力对照"
    width="960px"
    top="6vh"
    class="compare-dialog"
    @close="handleClose"
  >
    <el-steps :active="activeStep" align-center class="compare-steps">
      <el-step title="整组对照" description="确认本次对照方案" />
      <el-step title="逐条核对能力" description="核对每个方案的核心能力" />
      <el-step title="咨询交接" description="交接给顾问继续跟进" />
    </el-steps>

    <!-- 步骤一：整组概览 -->
    <div v-show="activeStep === 0" class="step-pane">
      <el-alert
        v-if="groupProducts.length < 2"
        type="info"
        :closable="false"
        show-icon
        title="当前仅选择了 1 个方案，可继续了解详情；选择 2-3 个方案对照效果更佳"
        class="step-tip"
      />
      <div class="overview-grid" :class="`col-${groupProducts.length}`">
        <div v-for="product in groupProducts" :key="product.id" class="overview-card">
          <div class="overview-card__banner" :style="{ background: product.gradient }">
            <el-icon :size="30"><component :is="product.icon" /></el-icon>
            <span>{{ product.shortTitle }}</span>
          </div>
          <div class="overview-card__body">
            <p class="overview-card__desc">{{ product.description }}</p>
            <ul class="overview-card__features">
              <li v-for="feature in product.features" :key="feature.title">
                <el-icon><Check /></el-icon>
                {{ feature.title }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 步骤二：逐条核对能力 -->
    <div v-show="activeStep === 1" class="step-pane">
      <div class="check-summary">
        <el-progress
          :percentage="capabilityProgress"
          :stroke-width="10"
          :text-inside="true"
          striped
          striped-flow
        />
        <span class="check-summary__text">
          已核对 {{ checkedCount }}/{{ totalCapabilityCount }} 项能力
        </span>
      </div>

      <el-table :data="capabilityRows" border class="capability-table">
        <el-table-column label="能力项" min-width="160">
          <template #default="{ row }">
            <span class="cap-name">{{ row.capability }}</span>
            <p class="cap-desc">{{ row.desc }}</p>
          </template>
        </el-table-column>
        <el-table-column
          v-for="product in groupProducts"
          :key="product.id"
          :label="product.shortTitle"
          align="center"
          min-width="170"
        >
          <template #default="{ row }">
            <template v-if="row.values[product.id]">
              <el-checkbox
                :model-value="isCapabilityChecked(product.id, row.capability)"
                @change="toggleCapability(product.id, row.capability)"
              >
                已核对
              </el-checkbox>
              <p class="cell-desc">{{ row.values[product.id] }}</p>
            </template>
            <el-icon v-else class="cap-missing"><Minus /></el-icon>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 步骤三：咨询交接 -->
    <div v-show="activeStep === 2" class="step-pane">
      <el-result
        v-if="handedOver"
        icon="success"
        title="对照清单已交接"
        sub-title="咨询顾问将根据您核对的能力清单继续跟进"
      >
        <template #extra>
          <el-button type="primary" @click="goContact">前往在线留言</el-button>
          <el-button @click="handleClose">继续浏览</el-button>
        </template>
      </el-result>

      <div v-else class="handoff">
        <h3 class="handoff__title">交接给咨询顾问</h3>
        <p class="handoff__desc">
          顾问将收到本次整组对照清单与您的核对进度，跳转后可直接补充联系方式并提交咨询。
        </p>
        <div class="handoff__group">
          <el-tag
            v-for="product in groupProducts"
            :key="product.id"
            type="primary"
            size="large"
            class="handoff__tag"
          >
            <el-icon style="margin-right:4px"><component :is="product.icon" /></el-icon>
            {{ product.shortTitle }}
          </el-tag>
        </div>
        <el-descriptions :column="1" border class="handoff__meta">
          <el-descriptions-item label="对照方案数">{{ groupProducts.length }} 个</el-descriptions-item>
          <el-descriptions-item label="能力核对进度">
            {{ checkedCount }}/{{ totalCapabilityCount }} 项
          </el-descriptions-item>
          <el-descriptions-item label="交接内容">
            {{ handoffSummary }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ activeStep === 2 ? '关闭' : '取消' }}</el-button>
        <el-button v-if="activeStep > 0" @click="activeStep--">上一步</el-button>
        <el-button
          v-if="activeStep === 0"
          type="primary"
          @click="activeStep = 1"
        >
          开始逐条核对
        </el-button>
        <template v-if="activeStep === 1">
          <el-button
            type="primary"
            plain
            @click="confirmAllChecked"
          >
            全部核对
          </el-button>
          <el-button type="primary" @click="activeStep = 2">
            去咨询交接
            <el-icon class="el-icon--right"><ArrowRight /></el-icon>
          </el-button>
        </template>
        <el-button
          v-if="activeStep === 2 && !handedOver"
          type="primary"
          @click="handleHandoff"
        >
          <el-icon class="el-icon--left"><Promotion /></el-icon>
          确认交接并去咨询
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProductCompare } from '@/composables/useProductCompare'

const router = useRouter()

const {
  compareVisible,
  compareGroupProducts,
  checkedCount,
  totalCapabilityCount,
  checkedCapabilities,
  handedOver,
  closeCompare,
  isCapabilityChecked,
  toggleCapability,
  handoffToConsultant
} = useProductCompare()

const activeStep = ref(0)

// 每次整组提交后重新打开，均从第一步开始核对
watch(compareVisible, (visible) => {
  if (visible) activeStep.value = 0
})

const groupProducts = compareGroupProducts

// 以所有方案能力项的并集作为对照行
const capabilityRows = computed(() => {
  const rows = new Map()
  groupProducts.value.forEach((product) => {
    product.features.forEach((feature) => {
      if (!rows.has(feature.title)) {
        rows.set(feature.title, {
          capability: feature.title,
          desc: feature.desc,
          values: {}
        })
      }
      rows.get(feature.title).values[product.id] = feature.desc
    })
  })
  return Array.from(rows.values())
})

const capabilityProgress = computed(() => {
  if (totalCapabilityCount.value === 0) return 0
  return Math.round((checkedCount.value / totalCapabilityCount.value) * 100)
})

const handoffSummary = computed(() => {
  const names = groupProducts.value.map((p) => p.shortTitle).join('、')
  return `希望对照了解：${names}；已核对 ${checkedCount.value}/${totalCapabilityCount.value} 项能力。`
})

const confirmAllChecked = () => {
  groupProducts.value.forEach((product) => {
    product.features.forEach((feature) => {
      if (!isCapabilityChecked(product.id, feature.title)) {
        toggleCapability(product.id, feature.title)
      }
    })
  })
}

const handleHandoff = () => {
  const handoff = handoffToConsultant()
  if (handoff) {
    activeStep.value = 2
  }
}

const goContact = () => {
  closeCompare()
  router.push('/contact')
}

const handleClose = () => {
  activeStep.value = 0
  closeCompare()
}
</script>

<style lang="scss" scoped>
@use '@/assets/styles/variables.scss' as *;

.compare-steps {
  margin: $spacing-sm 0 $spacing-xl;
}

.step-pane {
  min-height: 320px;
}

.step-tip {
  margin-bottom: $spacing-md;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-md;

  &.col-1 {
    grid-template-columns: 1fr;
  }

  &.col-2 {
    grid-template-columns: repeat(2, 1fr);
  }
}

.overview-card {
  border: 1px solid $border-light;
  border-radius: $radius-lg;
  overflow: hidden;

  &__banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-xs;
    height: 72px;
    color: #fff;
    font-size: $font-size-lg;
    font-weight: 600;
  }

  &__body {
    padding: $spacing-md;
  }

  &__desc {
    font-size: $font-size-sm;
    color: $text-secondary;
    line-height: $line-height-base;
    margin-bottom: $spacing-sm;
  }

  &__features {
    list-style: none;
    margin: 0;
    padding: 0;

    li {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: $font-size-sm;
      color: $text-regular;
      margin-bottom: 6px;

      .el-icon {
        color: $success-color;
        flex-shrink: 0;
      }
    }
  }
}

.check-summary {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-bottom: $spacing-md;

  &__text {
    font-size: $font-size-sm;
    color: $text-secondary;
    white-space: nowrap;
  }
}

.capability-table {
  .cap-name {
    font-weight: 600;
    color: $text-primary;
  }

  .cap-desc {
    margin: 4px 0 0;
    font-size: $font-size-xs;
    color: $text-secondary;
  }

  .cell-desc {
    margin: 6px 0 0;
    font-size: $font-size-xs;
    color: $text-secondary;
    line-height: 1.5;
  }

  .cap-missing {
    color: $text-placeholder;
    font-size: 18px;
  }
}

.handoff {
  &__title {
    font-size: $font-size-xl;
    color: $text-primary;
    margin-bottom: $spacing-sm;
  }

  &__desc {
    font-size: $font-size-sm;
    color: $text-secondary;
    margin-bottom: $spacing-lg;
  }

  &__group {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
    margin-bottom: $spacing-lg;
  }

  &__tag {
    display: inline-flex;
    align-items: center;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-sm;
}

@media (max-width: $breakpoint-md) {
  .overview-grid,
  .overview-grid.col-2 {
    grid-template-columns: 1fr;
  }

  .check-summary {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
