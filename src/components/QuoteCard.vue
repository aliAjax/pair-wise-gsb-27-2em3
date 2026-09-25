<script setup lang="ts">
import { computed, ref } from "vue";
import { formatFen } from "../domain/money";
import {
  effectiveVersion,
  pendingVersion,
  type Quote,
  type QuoteVersion
} from "../domain/quote";
import { validateSelection } from "../domain/serviceItems";
import { useQuoteStore } from "../stores/quoteStore";
import LineItemsTable from "./LineItemsTable.vue";

const props = defineProps<{ quote: Quote }>();
const emit = defineEmits<{ revise: [quote: Quote] }>();

const store = useQuoteStore();

const effective = computed(() => effectiveVersion(props.quote));
const pending = computed(() => pendingVersion(props.quote));
const history = computed(() =>
  props.quote.versions
    .filter((version) => version.status === "已撤下" || version.status === "已替换")
    .slice()
    .reverse()
);

// 待确认版本的实时校验结果:有问题时确认按钮禁用,满足"超限先别让报价确认"
const pendingErrors = computed(() =>
  pending.value ? validateSelection(pending.value.selection) : []
);
const confirmErrors = ref<string[]>([]);

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function versionTitle(version: QuoteVersion): string {
  return `V${version.versionNo} · ${version.status}`;
}

function confirmPending() {
  if (!pending.value) return;
  confirmErrors.value = store.confirm(props.quote.id, pending.value.versionNo);
}

function withdrawPending() {
  store.withdraw(props.quote.id);
}

function removeQuote() {
  if (window.confirm(`确定删除「${props.quote.customer}」的整张报价单吗?`)) {
    store.remove(props.quote.id);
  }
}
</script>

<template>
  <article class="record">
    <div class="record-head">
      <p class="record-title">{{ quote.customer }} / {{ quote.route }}</p>
      <span class="status" :class="{ idle: !effective }">
        {{ effective ? `生效中 · V${effective.versionNo}` : "未生效" }}
      </span>
    </div>

    <div class="details">
      <span>重量: {{ quote.weightKg }} kg</span>
      <span>服务类型: {{ quote.serviceType }}</span>
      <span>创建: {{ formatTime(quote.createdAt) }}</span>
      <span>版本数: {{ quote.versions.length }}</span>
    </div>
    <p class="note">{{ quote.notes || "暂无备注" }}</p>

    <section v-if="effective" class="version-block confirmed">
      <header class="version-head">
        <strong>{{ versionTitle(effective) }}(当前生效,费用已固定)</strong>
        <span class="hint">确认于 {{ formatTime(effective.confirmedAt) }}</span>
      </header>
      <LineItemsTable :items="effective.items" />
    </section>

    <section v-if="pending" class="version-block pending">
      <header class="version-head">
        <strong>{{ versionTitle(pending) }}(未生效)</strong>
        <span class="hint">更新于 {{ formatTime(pending.createdAt) }}</span>
      </header>
      <LineItemsTable :items="pending.items" />
      <ul v-if="pendingErrors.length" class="error-list">
        <li v-for="error in pendingErrors" :key="error">{{ error }}</li>
      </ul>
      <ul v-if="confirmErrors.length" class="error-list">
        <li v-for="error in confirmErrors" :key="error">{{ error }}</li>
      </ul>
      <div class="actions">
        <button type="button" :disabled="pendingErrors.length > 0" @click="confirmPending">
          确认该版本
        </button>
        <button class="secondary" type="button" @click="withdrawPending">撤下该版本</button>
      </div>
    </section>

    <details v-if="history.length" class="history">
      <summary>历史版本({{ history.length }}):撤下与被替换的版本都保留在此</summary>
      <div v-for="version in history" :key="version.versionNo" class="history-item">
        <p class="history-head">
          <strong>{{ versionTitle(version) }}</strong>
          <span class="hint">
            {{ version.status === "已撤下" ? "撤下于" : "替换于" }} {{ formatTime(version.closedAt) }}
            · 合计 {{ formatFen(version.totalFen) }} 元
          </span>
        </p>
        <LineItemsTable :items="version.items" />
      </div>
    </details>

    <div class="actions">
      <button type="button" @click="emit('revise', quote)">
        {{ pending ? "继续调整待确认版本" : "增减服务项目" }}
      </button>
      <button class="danger" type="button" @click="removeQuote">删除报价单</button>
    </div>
  </article>
</template>
