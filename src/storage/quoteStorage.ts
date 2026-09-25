// 报价单存取:localStorage 读写与首次进入的种子数据。
// 只负责持久化,不含任何计费规则。

import {
  confirmVersion,
  createQuote,
  reviseSelection,
  withdrawPending,
  type Quote
} from "../domain/quote";

const STORAGE_KEY = "hxwlfront-13-quotes";

export function loadQuotes(): Quote[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return seedQuotes();
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Quote[]) : [];
  } catch {
    return [];
  }
}

export function saveQuotes(quotes: Quote[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
}

// 种子数据覆盖三种典型状态:已确认+待确认修订、保费超限待确认、撤下后原报价继续有效
function seedQuotes(): Quote[] {
  const day = 86400000;
  const now = Date.now();
  const at = (offsetMs: number) => new Date(now - offsetMs).toISOString();

  let first = createQuote(
    { customer: "海沃商贸", route: "上海-南京", weightKg: 180, serviceType: "标准达", notes: "月结客户,发票随账单" },
    { insure: true, declaredValue: 50000, cod: false, door: true },
    at(3 * day)
  );
  first = confirmVersion(first, 1, at(3 * day - 3600000)).quote;
  first = reviseSelection(
    first,
    { insure: true, declaredValue: 80000, cod: true, door: false },
    at(6 * 3600000)
  );

  const second = createQuote(
    { customer: "云仓食品", route: "杭州-合肥", weightKg: 95, serviceType: "冷链", notes: "客户申报货值较高,待其确认是否分票" },
    { insure: true, declaredValue: 3000000, cod: false, door: true },
    at(2 * day)
  );

  let third = createQuote(
    { customer: "远方汽配", route: "广州-深圳", weightKg: 60, serviceType: "次日达", notes: "收货方自提点自提" },
    { insure: false, declaredValue: 0, cod: false, door: false },
    at(5 * day)
  );
  third = confirmVersion(third, 1, at(5 * day - 7200000)).quote;
  third = reviseSelection(third, { insure: false, declaredValue: 0, cod: true, door: false }, at(2 * day));
  third = withdrawPending(third, at(1 * day));

  return [first, second, third];
}
