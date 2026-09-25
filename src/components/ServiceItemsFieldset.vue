<script setup lang="ts">
import { computed } from "vue";
import { formatFen, formatYuan } from "../domain/money";
import {
  buildServiceItems,
  validateSelection,
  MAX_DECLARED_VALUE_YUAN,
  type ServiceSelection
} from "../domain/serviceItems";

const props = defineProps<{ modelValue: ServiceSelection }>();
const emit = defineEmits<{ "update:modelValue": [value: ServiceSelection] }>();

function update(patch: Partial<ServiceSelection>) {
  const next = { ...props.modelValue, ...patch };
  // 代收货款与送货上门互斥:勾选其一时自动取消另一个
  if (patch.cod) next.door = false;
  if (patch.door) next.cod = false;
  emit("update:modelValue", next);
}

function onDeclaredInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  update({ declaredValue: Number.isFinite(value) ? value : 0 });
}

const previewItems = computed(() => buildServiceItems(props.modelValue));
const previewTotalFen = computed(() =>
  previewItems.value.reduce((acc, item) => acc + item.amountFen, 0)
);
const errors = computed(() => validateSelection(props.modelValue));
</script>

<template>
  <fieldset class="service-fieldset">
    <legend>增值服务明细</legend>

    <label class="check-row">
      <input
        type="checkbox"
        :checked="modelValue.insure"
        @change="update({ insure: ($event.target as HTMLInputElement).checked })"
      />
      保价(申报金额的 0.3%,单票保费上限 8,000 元)
    </label>
    <label v-if="modelValue.insure" class="declared-row">
      申报金额(元)
      <input
        type="number"
        min="0"
        step="0.01"
        :value="modelValue.declaredValue || ''"
        placeholder="填写申报金额"
        @input="onDeclaredInput"
      />
      <span class="hint">申报金额超过约 {{ formatYuan(MAX_DECLARED_VALUE_YUAN) }} 元时保费将超上限,报价无法确认</span>
    </label>

    <label class="check-row">
      <input
        type="checkbox"
        :checked="modelValue.cod"
        @change="update({ cod: ($event.target as HTMLInputElement).checked })"
      />
      代收货款(30 元/票)
    </label>
    <label class="check-row">
      <input
        type="checkbox"
        :checked="modelValue.door"
        @change="update({ door: ($event.target as HTMLInputElement).checked })"
      />
      送货上门(30 元/票,与代收二选一)
    </label>

    <div v-if="previewItems.length" class="service-preview">
      <p v-for="item in previewItems" :key="item.code" class="preview-line">
        <span>{{ item.name }} · {{ item.basis }}</span>
        <strong>{{ formatFen(item.amountFen) }} 元</strong>
      </p>
      <p class="preview-line total">
        <span>服务费小计</span>
        <strong>{{ formatFen(previewTotalFen) }} 元</strong>
      </p>
    </div>
    <p v-else class="hint">未选择增值服务</p>

    <ul v-if="errors.length" class="error-list">
      <li v-for="error in errors" :key="error">{{ error }}</li>
    </ul>
  </fieldset>
</template>
