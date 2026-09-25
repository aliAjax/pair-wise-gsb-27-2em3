/**
 * 领域规则与存取层的自检验证（不引入测试框架，编译后直接用 node 运行）。
 */
import {
  COD_FEE,
  DELIVERY_FEE,
  INSURED_CAP,
  buildLines,
  confirmVersion,
  createQuote,
  effectiveVersion,
  insuredFee,
  pendingVersion,
  quoteState,
  startRevision,
  totalOf,
  updatePendingSelection,
  validateSelection,
  withdrawPending,
  type Quote,
  type ServiceSelection
} from "../src/domain/quoteRules.js";
import { createMemoryRepository } from "../src/storage/quoteRepository.js";

let failures = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL - ${name}`);
    console.error(error);
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`断言失败：${message}`);
}

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`断言失败：${message}，期望 ${String(expected)}，实际 ${String(actual)}`);
  }
}

const T0 = "2026-09-25T08:00:00.000Z";
const T1 = "2026-09-25T09:00:00.000Z";
const T2 = "2026-09-25T10:00:00.000Z";

function makeQuote(selection: ServiceSelection, id = "q1"): Quote {
  return createQuote({
    id,
    versionId: `${id}-v1`,
    customer: "测试客户",
    route: "上海-北京",
    selection,
    now: T0
  });
}

test("保价费按申报金额千分之三收取并精确到分", () => {
  equal(insuredFee(100000), 300, "10 万申报金额应收 300 元");
  equal(insuredFee(123456), 370.37, "370.368 应四舍五入到 370.37");
  const lines = buildLines({ insured: true, declaredAmount: 100000, cod: false, delivery: false });
  equal(lines.length, 1, "只选保价时应只有一条明细");
  equal(lines[0].amount, 300, "保价明细金额");
  equal(totalOf(lines), 300, "合计");
});

test("代收与送货上门各收 30 元", () => {
  equal(COD_FEE, 30, "代收 30 元");
  equal(DELIVERY_FEE, 30, "送货上门 30 元");
  const codOnly = buildLines({ insured: false, declaredAmount: 0, cod: true, delivery: false });
  equal(totalOf(codOnly), 30, "只选代收合计 30 元");
  const deliveryOnly = buildLines({ insured: false, declaredAmount: 0, cod: false, delivery: true });
  equal(totalOf(deliveryOnly), 30, "只选送货上门合计 30 元");
});

test("代收与送货上门不能同时选择", () => {
  const selection = { insured: false, declaredAmount: 0, cod: true, delivery: true };
  const errors = validateSelection(selection);
  assert(errors.some((item) => item.includes("不能同时选择")), "应提示互斥");
  const quote = makeQuote(selection);
  const result = confirmVersion(quote, "q1-v1", T1);
  assert(result.errors.length > 0, "互斥时不允许确认");
  equal(quoteState(result.quote), "PENDING", "确认被拒后版本仍是待确认");
});

test("保价费超过单票上限 8000 元时不允许确认", () => {
  const selection = { insured: true, declaredAmount: 3000000, cod: false, delivery: false };
  equal(insuredFee(3000000), 9000, "300 万申报金额保费 9000 元");
  const errors = validateSelection(selection);
  assert(errors.some((item) => item.includes(`${INSURED_CAP}`)), "应提示超过上限");
  const quote = makeQuote(selection);
  const result = confirmVersion(quote, "q1-v1", T1);
  assert(result.errors.length > 0, "超限时不允许确认");
  assert(!effectiveVersion(result.quote), "确认被拒后不存在有效版本");
});

test("保价费恰好等于上限 8000 元时可以确认", () => {
  const declaredAmount = 8000 / 0.003; // 约 266.67 万，费用恰好 8000
  equal(insuredFee(declaredAmount), INSURED_CAP, "费用应恰好等于上限");
  const quote = makeQuote({ insured: true, declaredAmount, cod: false, delivery: false });
  const result = confirmVersion(quote, "q1-v1", T1);
  equal(result.errors.length, 0, "边界值应允许确认");
  equal(effectiveVersion(result.quote)?.totalFee, INSURED_CAP, "确认后合计 8000 元");
});

test("确认后服务与费用冻结，变更生成待确认版本且原报价继续有效", () => {
  let quote = makeQuote({ insured: true, declaredAmount: 100000, cod: true, delivery: false });
  quote = confirmVersion(quote, "q1-v1", T1).quote;
  equal(quoteState(quote), "CONFIRMED", "确认后状态");
  equal(effectiveVersion(quote)?.totalFee, 330, "确认时合计 300 + 30");

  const revised = startRevision(quote, { versionId: "q1-v2", now: T2 });
  assert(revised !== null, "已确认报价可以发起变更");
  quote = revised;
  equal(quoteState(quote), "PENDING", "变更后存在待确认版本");
  equal(effectiveVersion(quote)?.versionNo, 1, "原版本仍是有效版本");
  equal(effectiveVersion(quote)?.totalFee, 330, "原报价费用不变");

  quote = updatePendingSelection(quote, { insured: true, declaredAmount: 200000, cod: false, delivery: true });
  equal(pendingVersion(quote)?.totalFee, 630, "待确认版本实时重算 600 + 30");
  equal(effectiveVersion(quote)?.totalFee, 330, "修改待确认版本不影响已确认费用");
});

test("确认新版本后旧版本转为已失效", () => {
  let quote = makeQuote({ insured: false, declaredAmount: 0, cod: true, delivery: false });
  quote = confirmVersion(quote, "q1-v1", T1).quote;
  quote = startRevision(quote, { versionId: "q1-v2", now: T2 })!;
  quote = updatePendingSelection(quote, { insured: false, declaredAmount: 0, cod: false, delivery: true });
  const result = confirmVersion(quote, "q1-v2", T2);
  equal(result.errors.length, 0, "新版本可确认");
  quote = result.quote;
  equal(effectiveVersion(quote)?.versionNo, 2, "第 2 版生效");
  const v1 = quote.versions.find((version) => version.versionNo === 1);
  equal(v1?.status, "SUPERSEDED", "旧版本已失效且保留在记录中");
});

test("撤下未确认版本时原记录保留、原报价继续有效", () => {
  let quote = makeQuote({ insured: true, declaredAmount: 100000, cod: false, delivery: false });
  quote = confirmVersion(quote, "q1-v1", T1).quote;
  quote = startRevision(quote, { versionId: "q1-v2", now: T2 })!;
  quote = updatePendingSelection(quote, { insured: true, declaredAmount: 500000, cod: false, delivery: false });

  quote = withdrawPending(quote, "q1-v2");
  equal(quoteState(quote), "CONFIRMED", "撤下后回到已确认状态");
  equal(effectiveVersion(quote)?.totalFee, 300, "原报价费用不变");
  const withdrawn = quote.versions.find((version) => version.versionNo === 2);
  equal(withdrawn?.status, "WITHDRAWN", "被撤版本标记为已撤回并保留");
  equal(quote.versions.length, 2, "记录完整保留两个版本");
});

test("已存在待确认版本时不允许重复发起变更", () => {
  let quote = makeQuote({ insured: false, declaredAmount: 0, cod: true, delivery: false });
  quote = confirmVersion(quote, "q1-v1", T1).quote;
  quote = startRevision(quote, { versionId: "q1-v2", now: T2 })!;
  const again = startRevision(quote, { versionId: "q1-v3", now: T2 });
  equal(again, null, "已有待确认版本时再次变更应被拒绝");
});

test("存取层：内存仓库读写往返一致", () => {
  const repository = createMemoryRepository();
  const quote = makeQuote({ insured: true, declaredAmount: 100000, cod: true, delivery: false });
  repository.saveAll([quote]);
  const loaded = repository.list();
  equal(loaded.length, 1, "应读回一条报价");
  equal(loaded[0].versions[0].totalFee, 330, "读回的明细合计一致");
});

if (failures > 0) {
  throw new Error(`${failures} 个用例失败`);
}
console.log("全部用例通过");
