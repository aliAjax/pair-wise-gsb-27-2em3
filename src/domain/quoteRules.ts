/**
 * 报价服务明细规则（纯领域层）。
 *
 * 只包含费用计算、校验和版本生命周期，不依赖 Vue、localStorage 或任何第三方库，
 * 页面层与存取层都通过这里的函数操作报价数据。
 */

/** 保价费率：申报金额的千分之三 */
export const INSURED_RATE = 0.003;
/** 单票保价费上限（元），超过该上限的报价不允许确认 */
export const INSURED_CAP = 8000;
/** 代收货款服务费（元/票） */
export const COD_FEE = 30;
/** 送货上门服务费（元/票） */
export const DELIVERY_FEE = 30;

export type ServiceKind = "INSURED" | "COD" | "DELIVERY";

/** 客服在报价单上勾选的服务 */
export interface ServiceSelection {
  insured: boolean;
  /** 保价申报金额（元），仅 insured 为 true 时参与计费 */
  declaredAmount: number;
  cod: boolean;
  delivery: boolean;
}

/** 报价单里的一条服务明细 */
export interface QuoteLine {
  kind: ServiceKind;
  label: string;
  /** 计费依据，例如“申报金额 ¥1,000,000.00 × 3‰” */
  basis: string;
  /** 金额（元），精确到分 */
  amount: number;
}

export type VersionStatus = "PENDING" | "CONFIRMED" | "SUPERSEDED" | "WITHDRAWN";

export interface QuoteVersion {
  id: string;
  versionNo: number;
  status: VersionStatus;
  selection: ServiceSelection;
  /** 确认时冻结的明细；待确认版本中为实时试算结果 */
  lines: QuoteLine[];
  totalFee: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface Quote {
  id: string;
  customer: string;
  route: string;
  createdAt: string;
  versions: QuoteVersion[];
}

/** 报价单整体状态：有待确认版本优先展示，其次看是否存在已确认的有效版本 */
export type QuoteState = "PENDING" | "CONFIRMED" | "EMPTY";

export function emptySelection(): ServiceSelection {
  return { insured: false, declaredAmount: 0, cod: false, delivery: false };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** 保价费：申报金额 × 3‰，精确到分 */
export function insuredFee(declaredAmount: number): number {
  return round2(declaredAmount * INSURED_RATE);
}

/**
 * 校验服务选择，返回错误信息列表（空数组表示可以确认）。
 * 规则：代收与送货上门互斥；保价费超过单票上限时不允许确认。
 */
export function validateSelection(selection: ServiceSelection): string[] {
  const errors: string[] = [];
  if (selection.cod && selection.delivery) {
    errors.push("代收货款与送货上门不能同时选择");
  }
  if (selection.insured) {
    if (!Number.isFinite(selection.declaredAmount) || selection.declaredAmount <= 0) {
      errors.push("请选择保价服务并填写大于 0 的申报金额");
    } else {
      const fee = insuredFee(selection.declaredAmount);
      if (fee > INSURED_CAP) {
        errors.push(`保价费 ${fee.toFixed(2)} 元超过单票上限 ${INSURED_CAP} 元，请降低申报金额后再确认`);
      }
    }
  }
  return errors;
}

/** 根据服务选择实时计算明细（不校验，校验见 validateSelection） */
export function buildLines(selection: ServiceSelection): QuoteLine[] {
  const lines: QuoteLine[] = [];
  if (selection.insured && Number.isFinite(selection.declaredAmount) && selection.declaredAmount > 0) {
    lines.push({
      kind: "INSURED",
      label: "保价费",
      basis: `申报金额 ¥${selection.declaredAmount.toFixed(2)} × 3‰`,
      amount: insuredFee(selection.declaredAmount)
    });
  }
  if (selection.cod) {
    lines.push({ kind: "COD", label: "代收货款", basis: "固定服务费", amount: COD_FEE });
  }
  if (selection.delivery) {
    lines.push({ kind: "DELIVERY", label: "送货上门", basis: "固定服务费", amount: DELIVERY_FEE });
  }
  return lines;
}

export function totalOf(lines: QuoteLine[]): number {
  return round2(lines.reduce((sum, line) => sum + line.amount, 0));
}

/** 新建报价单，初始为待确认的第 1 版 */
export function createQuote(input: {
  id: string;
  versionId: string;
  customer: string;
  route: string;
  selection: ServiceSelection;
  now: string;
}): Quote {
  const lines = buildLines(input.selection);
  return {
    id: input.id,
    customer: input.customer,
    route: input.route,
    createdAt: input.now,
    versions: [
      {
        id: input.versionId,
        versionNo: 1,
        status: "PENDING",
        selection: { ...input.selection },
        lines,
        totalFee: totalOf(lines),
        createdAt: input.now,
        confirmedAt: null
      }
    ]
  };
}

export function effectiveVersion(quote: Quote): QuoteVersion | null {
  return quote.versions.find((version) => version.status === "CONFIRMED") ?? null;
}

export function pendingVersion(quote: Quote): QuoteVersion | null {
  return quote.versions.find((version) => version.status === "PENDING") ?? null;
}

export function quoteState(quote: Quote): QuoteState {
  if (pendingVersion(quote)) return "PENDING";
  if (effectiveVersion(quote)) return "CONFIRMED";
  return "EMPTY";
}

/**
 * 确认待确认版本：校验通过后冻结明细与费用，版本转为已确认；
 * 之前的有效版本转为已失效。校验失败时返回原报价和错误列表。
 */
export function confirmVersion(
  quote: Quote,
  versionId: string,
  now: string
): { quote: Quote; errors: string[] } {
  const target = quote.versions.find((version) => version.id === versionId);
  if (!target || target.status !== "PENDING") {
    return { quote, errors: ["仅待确认版本可以确认"] };
  }
  const errors = validateSelection(target.selection);
  if (errors.length > 0) {
    return { quote, errors };
  }
  const lines = buildLines(target.selection);
  const versions = quote.versions.map((version) => {
    if (version.id === versionId) {
      return { ...version, status: "CONFIRMED" as const, lines, totalFee: totalOf(lines), confirmedAt: now };
    }
    if (version.status === "CONFIRMED") {
      return { ...version, status: "SUPERSEDED" as const };
    }
    return version;
  });
  return { quote: { ...quote, versions }, errors: [] };
}

/**
 * 客户增减服务项目：基于当前有效版本生成一个待确认版本。
 * 原报价继续有效；已存在待确认版本或未确认过的空报价不允许重复发起。
 */
export function startRevision(
  quote: Quote,
  input: { versionId: string; now: string }
): Quote | null {
  if (pendingVersion(quote)) return null;
  const base = effectiveVersion(quote);
  if (!base) return null;
  const lines = buildLines(base.selection);
  const version: QuoteVersion = {
    id: input.versionId,
    versionNo: Math.max(...quote.versions.map((item) => item.versionNo)) + 1,
    status: "PENDING",
    selection: { ...base.selection },
    lines,
    totalFee: totalOf(lines),
    createdAt: input.now,
    confirmedAt: null
  };
  return { ...quote, versions: [...quote.versions, version] };
}

/** 修改待确认版本的服务选择，明细实时重算，不影响已确认版本 */
export function updatePendingSelection(quote: Quote, selection: ServiceSelection): Quote {
  const target = pendingVersion(quote);
  if (!target) return quote;
  const lines = buildLines(selection);
  const versions = quote.versions.map((version) =>
    version.id === target.id
      ? { ...version, selection: { ...selection }, lines, totalFee: totalOf(lines) }
      : version
  );
  return { ...quote, versions };
}

/**
 * 撤下未确认版本：版本标记为已撤回并保留在记录中，
 * 原已确认版本不受影响、继续有效。
 */
export function withdrawPending(quote: Quote, versionId: string): Quote {
  const versions = quote.versions.map((version) =>
    version.id === versionId && version.status === "PENDING"
      ? { ...version, status: "WITHDRAWN" as const }
      : version
  );
  return { ...quote, versions };
}
