<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import QuoteCard from "./components/QuoteCard.vue";
import ServiceItemsFieldset from "./components/ServiceItemsFieldset.vue";
import { SERVICE_TYPES } from "./domain/freight";
import {
  effectiveVersion,
  latestVersion,
  pendingVersion,
  type Quote,
  type QuoteInput,
  type VersionStatus
} from "./domain/quote";
import { EMPTY_SELECTION, type ServiceSelection } from "./domain/serviceItems";
import { useQuoteStore } from "./stores/quoteStore";

const store = useQuoteStore();

const SERVICE_FILTERS = ["全部服务", ...SERVICE_TYPES];
const VERSION_STATUSES: VersionStatus[] = ["待确认", "已确认", "已撤下", "已替换"];

function blankForm(): QuoteInput {
  return { customer: "", route: "", weightKg: 0, serviceType: "", notes: "" };
}

const form = reactive<QuoteInput>(blankForm());
const selection = ref<ServiceSelection>({ ...EMPTY_SELECTION });
const editingId = ref<string | null>(null);
const filter = ref<(typeof SERVICE_FILTERS)[number]>(SERVICE_FILTERS[0]);

const editingQuote = computed(() => store.quotes.find((quote) => quote.id === editingId.value) ?? null);

const filteredQuotes = computed(() => {
  if (filter.value === SERVICE_FILTERS[0]) return store.quotes;
  return store.quotes.filter((quote) => quote.serviceType === filter.value);
});

const metrics = computed(() => [
  store.quotes.length,
  store.quotes.filter((quote) => effectiveVersion(quote)).length,
  store.quotes.filter((quote) => pendingVersion(quote)).length
]);

const chartRows = computed(() =>
  VERSION_STATUSES.map((status) => ({
    status,
    value: store.quotes
      .flatMap((quote) => quote.versions)
      .filter((version) => version.status === status).length
  }))
);
const maxChart = computed(() => Math.max(1, ...chartRows.value.map((row) => row.value)));

function startRevise(quote: Quote) {
  editingId.value = quote.id;
  form.customer = quote.customer;
  form.route = quote.route;
  form.weightKg = quote.weightKg;
  form.serviceType = quote.serviceType;
  form.notes = quote.notes;
  const source = pendingVersion(quote) ?? effectiveVersion(quote) ?? latestVersion(quote);
  selection.value = source ? { ...source.selection } : { ...EMPTY_SELECTION };
}

function resetEditor() {
  editingId.value = null;
  Object.assign(form, blankForm());
  selection.value = { ...EMPTY_SELECTION };
}

function submit() {
  if (editingId.value) {
    // 已确认报价的增减项目:只生成/更新待确认版本,原报价继续有效
    store.revise(editingId.value, selection.value);
  } else {
    store.addQuote({ ...form }, selection.value);
  }
  resetEditor();
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">物流行业前端最小闭环</p>
          <h1>物流费用试算器</h1>
          <p class="subtitle">
            保价、代收货款、送货上门不再写在备注里,而是报价单上的费用明细:
            确认后费用固定,增减项目生成待确认版本,原报价继续有效。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">Vite</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Pinia</span>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>报价单数</span>
          <strong>{{ metrics[0] }}</strong>
        </article>
        <article class="metric">
          <span>已生效报价</span>
          <strong>{{ metrics[1] }}</strong>
        </article>
        <article class="metric">
          <span>待确认版本</span>
          <strong>{{ metrics[2] }}</strong>
        </article>
      </section>

      <section class="workspace">
        <form class="panel" @submit.prevent="submit">
          <h2>{{ editingQuote ? `调整服务明细 · ${editingQuote.customer}` : "新增报价" }}</h2>
          <p v-if="editingQuote" class="mode-tip">
            正在生成新的待确认版本,原已确认版本在新版本确认前继续有效。
          </p>
          <div class="form-grid">
            <label>
              客户名称
              <input v-model="form.customer" type="text" required :disabled="!!editingQuote" />
            </label>
            <label>
              运输线路
              <input v-model="form.route" type="text" required :disabled="!!editingQuote" />
            </label>
            <label>
              重量kg
              <input v-model.number="form.weightKg" type="number" min="0" step="0.1" required :disabled="!!editingQuote" />
            </label>
            <label>
              服务类型
              <select v-model="form.serviceType" required :disabled="!!editingQuote">
                <option value="">请选择</option>
                <option v-for="type in SERVICE_TYPES" :key="type">{{ type }}</option>
              </select>
            </label>

            <ServiceItemsFieldset v-model="selection" />

            <label>
              备注
              <textarea v-model="form.notes" placeholder="填写处理说明或现场备注" :disabled="!!editingQuote" />
            </label>
            <button type="submit">{{ editingQuote ? "生成待确认版本" : "保存报价(待确认)" }}</button>
            <button v-if="editingQuote" class="secondary" type="button" @click="resetEditor">取消调整</button>
          </div>
        </form>

        <section class="list-panel">
          <div class="toolbar">
            <h2>报价列表</h2>
            <select v-model="filter">
              <option v-for="item in SERVICE_FILTERS" :key="item">{{ item }}</option>
            </select>
          </div>

          <div class="record-grid">
            <div v-if="filteredQuotes.length === 0" class="empty">暂无匹配数据</div>
            <QuoteCard v-for="quote in filteredQuotes" :key="quote.id" :quote="quote" @revise="startRevise" />
          </div>

          <div class="mini-chart">
            <div v-for="row in chartRows" :key="row.status" class="bar">
              <span>{{ row.status }}版本</span>
              <div class="bar-track"><div class="bar-fill" :style="{ width: `${(row.value / maxChart) * 100}%` }" /></div>
              <strong>{{ row.value }}</strong>
            </div>
          </div>
        </section>
      </section>
    </div>
  </main>
</template>
