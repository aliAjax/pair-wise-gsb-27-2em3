// 金额工具:内部一律用"分"计算,避免浮点误差;页面输入输出用"元"。

export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100);
}

export function formatFen(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatYuan(yuan: number): string {
  return formatFen(yuanToFen(yuan));
}
