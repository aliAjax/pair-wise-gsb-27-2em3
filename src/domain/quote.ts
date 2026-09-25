// 报价单与版本生命周期。
// 核心约定:
// - 每个版本在生成时就把服务选择和费用明细物化,确认后不再变化;
// - 确认后客户增减项目,只能生成新的待确认版本,原已确认版本继续有效;
// - 撤下待确认版本只是把状态改为"已撤下",版本记录和报价单都保留。

import { baseFreightItem } from "./freight";
import {
  buildServiceItems,
  validateSelection,
  type QuoteLineItem,
  type ServiceSelection
} from "./serviceItems";

export type VersionStatus = "待确认" | "已确认" | "已撤下" | "已替换";

export interface QuoteVersion {
  versionNo: number;
  status: VersionStatus;
  selection: ServiceSelection; // 该版本冻结的服务选择
  items: QuoteLineItem[]; // 该版本冻结的费用明细(含基础运费)
  totalFen: number;
  createdAt: string;
  confirmedAt: string | null;
  closedAt: string | null; // 撤下或被新版本替换的时间
}

export interface QuoteInput {
  customer: string;
  route: string;
  weightKg: number;
  serviceType: string;
  notes: string;
}

export interface Quote extends QuoteInput {
  id: string;
  createdAt: string;
  versions: QuoteVersion[];
}

function buildItems(input: Pick<QuoteInput, "serviceType" | "weightKg">, selection: ServiceSelection): QuoteLineItem[] {
  return [baseFreightItem(input.serviceType, input.weightKg), ...buildServiceItems(selection)];
}

function sumFen(items: QuoteLineItem[]): number {
  return items.reduce((acc, item) => acc + item.amountFen, 0);
}

function makeVersion(
  versionNo: number,
  input: Pick<QuoteInput, "serviceType" | "weightKg">,
  selection: ServiceSelection,
  now: string
): QuoteVersion {
  const items = buildItems(input, selection);
  return {
    versionNo,
    status: "待确认",
    selection: { ...selection },
    items,
    totalFen: sumFen(items),
    createdAt: now,
    confirmedAt: null,
    closedAt: null
  };
}

// 新建报价单:首版为待确认,保存不强制校验,确认时才拦截
export function createQuote(
  input: QuoteInput,
  selection: ServiceSelection,
  now = new Date().toISOString()
): Quote {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    versions: [makeVersion(1, input, selection, now)]
  };
}

export function latestVersion(quote: Quote): QuoteVersion | null {
  return quote.versions.length ? quote.versions[quote.versions.length - 1] : null;
}

// 当前生效版本:最新一个已确认版本;没有则报价尚未生效
export function effectiveVersion(quote: Quote): QuoteVersion | null {
  return (
    quote.versions.reduce<QuoteVersion | null>(
      (found, version) => (version.status === "已确认" ? version : found),
      null
    ) ?? null
  );
}

export function pendingVersion(quote: Quote): QuoteVersion | null {
  return quote.versions.find((version) => version.status === "待确认") ?? null;
}

// 确认待确认版本:规则校验不通过则原样返回并给出原因;
// 通过后该版本生效,之前的已确认版本转为"已替换"留档
export function confirmVersion(
  quote: Quote,
  versionNo: number,
  now = new Date().toISOString()
): { quote: Quote; errors: string[] } {
  const target = quote.versions.find((version) => version.versionNo === versionNo);
  if (!target || target.status !== "待确认") {
    return { quote, errors: ["该版本不是待确认状态,不能确认"] };
  }
  const errors = validateSelection(target.selection);
  if (errors.length) {
    return { quote, errors };
  }
  const versions = quote.versions.map((version) => {
    if (version.versionNo === versionNo) {
      return { ...version, status: "已确认" as const, confirmedAt: now };
    }
    if (version.status === "已确认") {
      return { ...version, status: "已替换" as const, closedAt: now };
    }
    return version;
  });
  return { quote: { ...quote, versions }, errors: [] };
}

// 客户增减项目:已有待确认版本则就地更新,否则生成新的待确认版本;
// 已确认版本保持不动,在新版本确认前继续有效
export function reviseSelection(
  quote: Quote,
  selection: ServiceSelection,
  now = new Date().toISOString()
): Quote {
  const pending = pendingVersion(quote);
  if (pending) {
    const updated = makeVersion(pending.versionNo, quote, selection, now);
    return {
      ...quote,
      versions: quote.versions.map((version) => (version.versionNo === pending.versionNo ? updated : version))
    };
  }
  const nextNo = Math.max(0, ...quote.versions.map((version) => version.versionNo)) + 1;
  return { ...quote, versions: [...quote.versions, makeVersion(nextNo, quote, selection, now)] };
}

// 撤下待确认版本:版本标记为"已撤下"并保留,原已确认版本继续有效
export function withdrawPending(quote: Quote, now = new Date().toISOString()): Quote {
  const pending = pendingVersion(quote);
  if (!pending) {
    return quote;
  }
  return {
    ...quote,
    versions: quote.versions.map((version) =>
      version.versionNo === pending.versionNo
        ? { ...version, status: "已撤下" as const, closedAt: now }
        : version
    )
  };
}
