<template>
  <div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
    <ClientOnly>
      <div class="h-48">
        <Line :data="chartData" :options="chartOptions" />
      </div>
      <template #fallback>
        <div class="h-48 animate-pulse rounded-lg bg-gray-800/60" />
      </template>
    </ClientOnly>

    <div v-if="hasComparison" class="mt-3 rounded-md border border-green-700/30 bg-green-900/20 px-3 py-2 text-xs text-green-200">
      Preco atual comparado ao {{ props.comparisonLabel || 'preco original' }}: voce economiza
      <span class="font-semibold">{{ formatCurrency(savingAmount) }}</span>
      ({{ savingPercent }}%).
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  type ChartData,
  type ChartDataset,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  type TooltipItem,
  Tooltip
} from 'chart.js'
import { Line } from 'vue-chartjs'

type PriceHistoryPoint = {
  label: string
  value: number
}

const props = defineProps<{
  points: PriceHistoryPoint[]
  comparisonPrice?: number
  comparisonLabel?: string
}>()

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0)
}

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.points.map((point) => point.label),
  datasets: (() => {
    const datasets: ChartDataset<'line'>[] = [{
      label: 'Preco',
      data: props.points.map((point) => Number(point.value || 0)),
      borderColor: '#66c0f4',
      backgroundColor: 'rgba(102, 192, 244, 0.2)',
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: '#66c0f4',
      pointBorderColor: '#0b1020',
      pointBorderWidth: 1.5,
      fill: true,
      tension: 0.25
    }
    ]

    if (hasComparison.value) {
      datasets.push({
        label: props.comparisonLabel || 'Preco original',
        data: props.points.map(() => Number(props.comparisonPrice || 0)),
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderDash: [6, 6],
        borderWidth: 1.8,
        pointRadius: 0,
        fill: false,
        tension: 0
      })
    }

    return datasets
  })()
}))

const latestPrice = computed(() => Number(props.points[props.points.length - 1]?.value || 0))
const hasComparison = computed(() => {
  const value = Number(props.comparisonPrice || 0)
  return Number.isFinite(value) && value > 0
})
const savingAmount = computed(() => {
  if (!hasComparison.value) {
    return 0
  }

  return Math.max(0, Number(props.comparisonPrice || 0) - latestPrice.value)
})

const savingPercent = computed(() => {
  if (!hasComparison.value || Number(props.comparisonPrice || 0) <= 0) {
    return 0
  }

  return Math.round((savingAmount.value / Number(props.comparisonPrice || 1)) * 100)
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context: TooltipItem<'line'>) => {
          if (context.datasetIndex === 1 && hasComparison.value) {
            return `${props.comparisonLabel || 'Preco original'}: ${formatCurrency(context.parsed.y ?? 0)}`
          }

          const prefix = context.dataIndex === props.points.length - 1 ? 'Preco atual' : 'Preco'
          return `${prefix}: ${formatCurrency(context.parsed.y ?? 0)}`
        }
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    intersect: false
  },
  scales: {
    y: {
      position: 'right' as const,
      ticks: {
        callback: (tickValue: number | string) => {
          const value = typeof tickValue === 'number' ? tickValue : Number(tickValue)
          return formatCurrency(value)
        },
        color: '#9ca3af'
      },
      grid: {
        color: 'rgba(156, 163, 175, 0.2)'
      }
    },
    x: {
      ticks: {
        color: '#9ca3af'
      },
      grid: {
        color: 'rgba(156, 163, 175, 0.08)'
      }
    }
  }
}))
</script>
