/**
 * 报价单存取层。
 *
 * 只负责 Quote 数组的读写，不包含任何计费规则；
 * 浏览器环境使用 localStorage 实现，测试环境使用内存实现。
 */
import type { Quote } from "../domain/quoteRules.js";

export interface QuoteRepository {
  list(): Quote[];
  saveAll(quotes: Quote[]): void;
}

export function createMemoryRepository(initial: Quote[] = []): QuoteRepository {
  let data = initial;
  return {
    list: () => data,
    saveAll: (quotes) => {
      data = quotes;
    }
  };
}

export function createLocalStorageRepository(key: string): QuoteRepository {
  return {
    list() {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as unknown;
        return Array.isArray(parsed) ? (parsed as Quote[]) : [];
      } catch {
        return [];
      }
    },
    saveAll(quotes) {
      localStorage.setItem(key, JSON.stringify(quotes));
    }
  };
}
