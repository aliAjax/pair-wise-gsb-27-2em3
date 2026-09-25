<script setup lang="ts">
import { computed, ref } from "vue";
import {
  effectiveVersion,
  emptySelection,
  pendingVersion,
  quoteState,
  validateSelection,
  type Quote,
  type ServiceSelection,
  type VersionStatus
} from "../domain/quoteRules.js";
import { useQuotes } from "../composables/useQuotes.js";
import ServiceEditor from "../components/ServiceEditor.vue";

const { quotes, addQuote, confirm, revise, updatePending, withdraw } = useQuotes();

const customer = ref("");
const route = ref("");
const draft = ref<ServiceSelection>(emptySelection());

const stateLabels: Record<string, string> = {
  PENDING: "待确认",
  CONFIRMED: "已确认",
  EMPTY: "无有效版本"
};

const versionStatusLabels: Record<VersionStatus, string> = {
  PENDING: "待确认",
  CONFIRMED: "已确认",
  SUPERSEDED: "已失效",
  WITHDRAWN: "已撤回"
};

const metrics = computed(() => [
  quotes.value.length,
  quotes.value.filter((quote) => effectiveVersion(quote)).length,
  quotes.value.filter((quote) => pendingVersion(quote)).length
]);

function formatYuan(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function historyOf(quote: Quote) {
  return quote.versions
    .filter((version) => version.status === "SUPERSEDED" || version.status === "WITHDRAWN")
    .sort((a, b) => b.versionNo - a.versionNo);
}

function pendingErrors(quote: Quote): string[] {
  const pending = pendingVersion(quote);
  return pending ? validateSelection(pending.selection) : [];
}

function submit() {
  addQuote(customer.value.trim(), route.value.trim(), draft.value);
  customer.value = "";
  route.value = "";
  draft.value = emptySelection();
}

function confirmPending(quote: Quote) {
  const pending = pendingVersion(quote);
  if (pending) confirm(quote.id, pending.id);
}

function withdrawPendingVersion(quote: Quote) {
  const pending = pendingVersion(quote);
  if (pending) withdraw(quote.id, pending.id);
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">物流行业前端最小闭环</p>
          <h1>物流报价服务明细</h1>
          <p class="subtitle">
            保价、代收、送货上门从备注搬进报价明细：保价按申报金额千分之三计费、单票上限 8000 元；
            代收与送货上门各 30 元且互斥。确认后费用冻结，客户增减项目时生成待确认版本，原报价继续有效。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">TypeScript</span>
          <span class="tag">规则 / 存取 / 页面分层</span>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>报价单数</span>
          <strong>{{ metrics[0] }}</strong>
        </article>
        <article class="metric">
          <span>已确认</span>
          <strong>{{ metrics[1] }}</strong>
        </article>
        <article class="metric">
          <span>待确认版本</span>
          <strong>{{ metrics[2] }}</strong>
        </article>
      </section>

      <section class="workspace">
        <form class="panel" @submit.prevent="submit">
          <h2>新增报价</h2>
          <div class="form-grid">
            <label>
              客户名称
              <input v-model="customer" required placeholder="例如：海沃商贸" />
            </label>
            <label>
              运输线路
              <input v-model="route" required placeholder="例如：上海-南京" />
            </label>
            <fieldset class="services">
              <legend>服务明细</legend>
              <ServiceEditor v-model="draft" />
            </fieldset>
            <button type="submit">生成待确认报价</button>
          </div>
        </form>

        <section class="list-panel">
          <div class="toolbar">
            <h2>报价列表</h2>
          </div>

          <div class="record-grid">
            <div v-if="quotes.length === 0" class="empty">暂无报价</div>
            <article v-for="quote in quotes" :key="quote.id" class="record">
              <div class="record-head">
                <p class="record-title">{{ quote.customer }} / {{ quote.route }}</p>
                <span class="status" :data-state="quoteState(quote)">{{ stateLabels[quoteState(quote)] }}</span>
              </div>

              <template v-if="effectiveVersion(quote)">
                <div class="version">
                  <p class="version-title">
                    有效版本 v{{ effectiveVersion(quote)!.versionNo }}
                    <small>确认于 {{ formatTime(effectiveVersion(quote)!.confirmedAt!) }}</small>
                  </p>
                  <div class="preview">
                    <div v-for="line in effectiveVersion(quote)!.lines" :key="line.kind" class="preview-row">
                      <span>{{ line.label }}<small>{{ line.basis }}</small></span>
                      <strong>{{ formatYuan(line.amount) }}</strong>
                    </div>
                    <div class="preview-row total">
                      <span>服务费合计</span>
                      <strong>{{ formatYuan(effectiveVersion(quote)!.totalFee) }}</strong>
                    </div>
                  </div>
                </div>
              </template>

              <div v-if="pendingVersion(quote)" class="version pending">
                <p class="version-title">待确认版本 v{{ pendingVersion(quote)!.versionNo }}（修改不影响有效版本）</p>
                <ServiceEditor
                  :model-value="pendingVersion(quote)!.selection"
                  @update:model-value="updatePending(quote.id, $event)"
                />
                <div class="actions">
                  <button type="button" :disabled="pendingErrors(quote).length > 0" @click="confirmPending(quote)">
                    确认版本
                  </button>
                  <button class="danger" type="button" @click="withdrawPendingVersion(quote)">撤下版本</button>
                </div>
              </div>

              <div v-else-if="effectiveVersion(quote)" class="actions">
                <button class="secondary" type="button" @click="revise(quote.id)">变更服务（生成待确认版本）</button>
              </div>

              <p v-if="quoteState(quote) === 'EMPTY'" class="note">该报价暂无有效版本，历史版本保留在下方。</p>

              <details v-if="historyOf(quote).length > 0" class="history">
                <summary>历史版本（{{ historyOf(quote).length }}）</summary>
                <div v-for="version in historyOf(quote)" :key="version.id" class="history-row">
                  <span>v{{ version.versionNo }} · {{ versionStatusLabels[version.status] }}</span>
                  <span>{{ formatYuan(version.totalFee) }}</span>
                </div>
              </details>
            </article>
          </div>
        </section>
      </section>
    </div>
  </main>
</template>
