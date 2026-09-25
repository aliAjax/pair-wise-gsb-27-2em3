/**
 * 页面与存取层之间的胶水：把领域规则返回的不可变数据落到响应式状态并持久化。
 */
import { ref } from "vue";
import {
  confirmVersion,
  createQuote,
  startRevision,
  updatePendingSelection,
  withdrawPending,
  type Quote,
  type ServiceSelection
} from "../domain/quoteRules.js";
import { createLocalStorageRepository, type QuoteRepository } from "../storage/quoteRepository.js";

const STORAGE_KEY = "hxwlfront-13-quotes";

function newId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/** 首次打开时的演示数据：一张已确认、一张已确认且带待确认版本 */
function seedQuotes(): Quote[] {
  const t1 = new Date(Date.now() - 2 * 86400000).toISOString();
  const t2 = new Date(Date.now() - 86400000).toISOString();
  const first = createQuote({
    id: "seed-quote-1",
    versionId: "seed-quote-1-v1",
    customer: "海沃商贸",
    route: "上海-南京",
    selection: { insured: true, declaredAmount: 500000, cod: true, delivery: false },
    now: t1
  });
  const confirmedFirst = confirmVersion(first, "seed-quote-1-v1", t1).quote;

  let second = createQuote({
    id: "seed-quote-2",
    versionId: "seed-quote-2-v1",
    customer: "云仓食品",
    route: "杭州-合肥",
    selection: { insured: true, declaredAmount: 200000, cod: false, delivery: true },
    now: t2
  });
  second = confirmVersion(second, "seed-quote-2-v1", t2).quote;
  const revised = startRevision(second, { versionId: "seed-quote-2-v2", now: now() });
  if (revised) {
    second = updatePendingSelection(revised, {
      insured: true,
      declaredAmount: 350000,
      cod: false,
      delivery: true
    });
  }
  return [second, confirmedFirst];
}

export function useQuotes(repository: QuoteRepository = createLocalStorageRepository(STORAGE_KEY)) {
  const stored = repository.list();
  const quotes = ref<Quote[]>(stored.length > 0 ? stored : seedQuotes());

  function persist(next: Quote[]) {
    quotes.value = next;
    repository.saveAll(next);
  }

  function replaceQuote(next: Quote) {
    persist(quotes.value.map((quote) => (quote.id === next.id ? next : quote)));
  }

  function addQuote(customer: string, route: string, selection: ServiceSelection): void {
    const quote = createQuote({
      id: newId(),
      versionId: newId(),
      customer,
      route,
      selection,
      now: now()
    });
    persist([quote, ...quotes.value]);
  }

  /** 确认待确认版本，返回校验错误（空数组表示成功） */
  function confirm(quoteId: string, versionId: string): string[] {
    const quote = quotes.value.find((item) => item.id === quoteId);
    if (!quote) return ["报价单不存在"];
    const result = confirmVersion(quote, versionId, now());
    if (result.errors.length === 0) {
      replaceQuote(result.quote);
    }
    return result.errors;
  }

  /** 客户增减项目：生成待确认版本，原报价继续有效 */
  function revise(quoteId: string): void {
    const quote = quotes.value.find((item) => item.id === quoteId);
    if (!quote) return;
    const next = startRevision(quote, { versionId: newId(), now: now() });
    if (next) replaceQuote(next);
  }

  function updatePending(quoteId: string, selection: ServiceSelection): void {
    const quote = quotes.value.find((item) => item.id === quoteId);
    if (!quote) return;
    replaceQuote(updatePendingSelection(quote, selection));
  }

  /** 撤下未确认版本，原记录保留 */
  function withdraw(quoteId: string, versionId: string): void {
    const quote = quotes.value.find((item) => item.id === quoteId);
    if (!quote) return;
    replaceQuote(withdrawPending(quote, versionId));
  }

  return { quotes, addQuote, confirm, revise, updatePending, withdraw };
}
