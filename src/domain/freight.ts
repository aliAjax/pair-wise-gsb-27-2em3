// 基础运费试算:按服务类型的每公斤单价计算,作为报价明细的第一行。

import { yuanToFen } from "./money";
import type { QuoteLineItem } from "./serviceItems";

export const SERVICE_TYPES = ["标准达", "次日达", "冷链"] as const;

const FREIGHT_RATE_YUAN_PER_KG: Record<string, number> = {
  标准达: 4,
  次日达: 6,
  冷链: 8
};

export function baseFreightItem(serviceType: string, weightKg: number): QuoteLineItem {
  const rate = FREIGHT_RATE_YUAN_PER_KG[serviceType] ?? 0;
  return {
    code: "FREIGHT",
    name: "基础运费",
    amountFen: yuanToFen(rate * weightKg),
    basis: `${serviceType} · ${weightKg} kg × ${rate} 元/kg`
  };
}
