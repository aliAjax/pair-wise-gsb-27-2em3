# 物流报价服务明细

- 行业：物流
- 技术栈：Vue3、Vite、TypeScript
- 启动：`npm install && npm run dev`
- 构建：`npm run build`
- 规则自检：`npm test`（编译 `src/domain`、`src/storage` 与 `tests` 后直接运行，不依赖测试框架）

保价、代收、送货上门不再写在备注里，而是报价单上的服务明细：

- 保价按申报金额千分之三计费，单票上限 8000 元，超过上限的报价不允许确认；
- 代收货款、送货上门各 30 元/票，两者互斥；
- 确认后服务与费用冻结；客户增减项目时生成待确认版本，原报价继续有效；
- 撤下未确认版本时，原记录（含历史版本）完整保留。

## 分层

- `src/domain/quoteRules.ts`：明细规则与版本生命周期（纯函数，无框架依赖）；
- `src/storage/quoteRepository.ts`：存取（localStorage / 内存两种实现）；
- `src/composables/useQuotes.ts`：页面与存取之间的胶水；
- `src/pages`、`src/components`：页面。

数据默认保存在浏览器 localStorage 中，方便后续扩展接口、权限、图表或地图能力。
