<script setup lang="ts">
import { computed } from "vue";
import {
  COD_FEE,
  DELIVERY_FEE,
  INSURED_CAP,
  buildLines,
  totalOf,
  validateSelection,
  type ServiceSelection
} from "../domain/quoteRules.js";

const props = defineProps<{ modelValue: ServiceSelection }>();
const emit = defineEmits<{ "update:modelValue": [value: ServiceSelection] }>();

function patch(partial: Partial<ServiceSelection>) {
  emit("update:modelValue", { ...props.modelValue, ...partial });
}

const lines = computed(() => buildLines(props.modelValue));
const total = computed(() => totalOf(lines.value));
const errors = computed(() => validateSelection(props.modelValue));

function formatYuan(value: number): string {
  return `¥${value.toFixed(2)}`;
}
</script>

<template>
  <div class="service-editor">
    <label class="check">
      <input
        type="checkbox"
        :checked="modelValue.insured"
        @change="patch({ insured: ($event.target as HTMLInputElement).checked })"
      />
      <span>保价（申报金额 × 3‰，单票上限 {{ INSURED_CAP }} 元）</span>
    </label>
    <label v-if="modelValue.insured" class="declared">
      申报金额（元）
      <input
        type="number"
        min="0"
        step="0.01"
        :value="modelValue.declaredAmount"
        @input="patch({ declaredAmount: Number(($event.target as HTMLInputElement).value) })"
      />
    </label>
    <label class="check">
      <input
        type="checkbox"
        :checked="modelValue.cod"
        @change="patch({ cod: ($event.target as HTMLInputElement).checked })"
      />
      <span>代收货款（{{ COD_FEE }} 元/票）</span>
    </label>
    <label class="check">
      <input
        type="checkbox"
        :checked="modelValue.delivery"
        @change="patch({ delivery: ($event.target as HTMLInputElement).checked })"
      />
      <span>送货上门（{{ DELIVERY_FEE }} 元/票）</span>
    </label>

    <div v-if="lines.length > 0" class="preview">
      <div v-for="line in lines" :key="line.kind" class="preview-row">
        <span>{{ line.label }}<small>{{ line.basis }}</small></span>
        <strong>{{ formatYuan(line.amount) }}</strong>
      </div>
      <div class="preview-row total">
        <span>服务费合计</span>
        <strong>{{ formatYuan(total) }}</strong>
      </div>
    </div>
    <p v-else class="preview-empty">未选择服务，明细为空</p>

    <ul v-if="errors.length > 0" class="errors">
      <li v-for="error in errors" :key="error">{{ error }}</li>
    </ul>
  </div>
</template>
