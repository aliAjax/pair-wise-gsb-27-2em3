// 增值服务明细规则:保价、代收货款、送货上门的计费与校验。
// 规则常量与计算都收在这里,页面和存取层不各自实现。

import { formatFen, formatYuan, yuanToFen } from "./money";

export const INSURANCE_RATE = 0.003; // 保价费率:申报金额的千分之三
export const INSURANCE_FEE_CAP_FEN = 8000 * 100; // 单票保费上限:8000 元,超过则不允许确认报价
export const COD_FEE_FEN = 30 * 100; // 代收货款手续费:30 元/票
export const DOOR_FEE_FEN = 30 * 100; // 送货上门费:30 元/票

export type ServiceCode = "FREIGHT" | "INSURE" | "COD" | "DOOR";

export interface ServiceSelection {
  insure: boolean; // 是否保价
  declaredValue: number; // 申报金额(元),仅保价时有效
  cod: boolean; // 是否代收货款
  door: boolean; // 是否送货上门
}

export interface QuoteLineItem {
  code: ServiceCode;
  name: string;
  amountFen: number;
  basis: string; // 计费说明,如 "申报金额 50,000.00 元 × 0.3%"
}

export const EMPTY_SELECTION: ServiceSelection = {
  insure: false,
  declaredValue: 0,
  cod: false,
  door: false
};

export function insuranceFeeFen(declaredValueYuan: number): number {
  return Math.round(yuanToFen(declaredValueYuan) * INSURANCE_RATE);
}

// 保费是否超过单票上限:超过时报价不允许确认
export function isInsuranceOverCap(declaredValueYuan: number): boolean {
  return insuranceFeeFen(declaredValueYuan) > INSURANCE_FEE_CAP_FEN;
}

// 保费顶到上限时对应的申报金额,用于页面提示
export const MAX_DECLARED_VALUE_YUAN = INSURANCE_FEE_CAP_FEN / INSURANCE_RATE / 100;

// 按当前选择生成增值服务明细(不含基础运费)
export function buildServiceItems(selection: ServiceSelection): QuoteLineItem[] {
  const items: QuoteLineItem[] = [];
  if (selection.insure) {
    items.push({
      code: "INSURE",
      name: "保价",
      amountFen: insuranceFeeFen(selection.declaredValue),
      basis: `申报金额 ${formatYuan(selection.declaredValue)} 元 × 0.3%`
    });
  }
  if (selection.cod) {
    items.push({ code: "COD", name: "代收货款", amountFen: COD_FEE_FEN, basis: "按票固定 30 元" });
  }
  if (selection.door) {
    items.push({ code: "DOOR", name: "送货上门", amountFen: DOOR_FEE_FEN, basis: "按票固定 30 元" });
  }
  return items;
}

// 确认报价前必须通过全部校验;保存待确认版本不强制
export function validateSelection(selection: ServiceSelection): string[] {
  const errors: string[] = [];
  if (selection.cod && selection.door) {
    errors.push("代收货款与送货上门不能同时选择");
  }
  if (selection.insure) {
    if (!(selection.declaredValue > 0)) {
      errors.push("保价需填写大于 0 的申报金额");
    } else if (isInsuranceOverCap(selection.declaredValue)) {
      errors.push(
        `保费 ${formatFen(insuranceFeeFen(selection.declaredValue))} 元超过单票上限 8,000.00 元,` +
          "请降低申报金额或分票投保,处理前报价不能确认"
      );
    }
  }
  return errors;
}
