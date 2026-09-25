// 页面与领域/存取层之间的状态胶水:所有变更先走领域函数,再统一持久化。

import { defineStore } from "pinia";
import { ref } from "vue";
import {
  confirmVersion,
  createQuote,
  reviseSelection,
  withdrawPending,
  type Quote,
  type QuoteInput
} from "../domain/quote";
import type { ServiceSelection } from "../domain/serviceItems";
import { loadQuotes, saveQuotes } from "../storage/quoteStorage";

export const useQuoteStore = defineStore("quotes", () => {
  const quotes = ref<Quote[]>(loadQuotes());

  function persist() {
    saveQuotes(quotes.value);
  }

  function addQuote(input: QuoteInput, selection: ServiceSelection) {
    quotes.value = [createQuote(input, selection), ...quotes.value];
    persist();
  }

  function revise(quoteId: string, selection: ServiceSelection) {
    quotes.value = quotes.value.map((quote) =>
      quote.id === quoteId ? reviseSelection(quote, selection) : quote
    );
    persist();
  }

  // 确认失败时返回原因列表,成功返回空数组
  function confirm(quoteId: string, versionNo: number): string[] {
    const quote = quotes.value.find((item) => item.id === quoteId);
    if (!quote) {
      return ["报价单不存在"];
    }
    const result = confirmVersion(quote, versionNo);
    if (result.errors.length) {
      return result.errors;
    }
    quotes.value = quotes.value.map((item) => (item.id === quoteId ? result.quote : item));
    persist();
    return [];
  }

  function withdraw(quoteId: string) {
    quotes.value = quotes.value.map((quote) =>
      quote.id === quoteId ? withdrawPending(quote) : quote
    );
    persist();
  }

  function remove(quoteId: string) {
    quotes.value = quotes.value.filter((quote) => quote.id !== quoteId);
    persist();
  }

  return { quotes, addQuote, revise, confirm, withdraw, remove };
});
