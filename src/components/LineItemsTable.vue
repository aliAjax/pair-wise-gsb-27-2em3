<script setup lang="ts">
import { computed } from "vue";
import { formatFen } from "../domain/money";
import type { QuoteLineItem } from "../domain/serviceItems";

const props = defineProps<{ items: QuoteLineItem[] }>();

const totalFen = computed(() => props.items.reduce((acc, item) => acc + item.amountFen, 0));
</script>

<template>
  <table class="items-table">
    <thead>
      <tr>
        <th>明细</th>
        <th>计费说明</th>
        <th class="amount">金额(元)</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.code">
        <td>{{ item.name }}</td>
        <td>{{ item.basis }}</td>
        <td class="amount">{{ formatFen(item.amountFen) }}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2">合计</td>
        <td class="amount">{{ formatFen(totalFen) }}</td>
      </tr>
    </tfoot>
  </table>
</template>
