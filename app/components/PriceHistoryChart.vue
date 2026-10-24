<template>
  <div class="rounded-xl border border-white/10 bg-gray-900/45 p-4 backdrop-blur-md">
    <ClientOnly>
      <div v-if="chartPoints.length > 1" class="h-48">
        <Line :data="chartData" :options="chartOptions" />
      </div>
      <p v-else class="flex h-48 items-center justify-center text-center text-sm text-gray-400">
        Ainda não há variações de preço registradas nos últimos 12 meses.
      </p>
      <template #fallback>
        <div class="h-48 animate-pulse rounded-lg bg-gray-800/60" />
      </template>
    </ClientOnly>

    <div class="mt-3 flex flex-wrap gap-2 text-xs">
      <span v-if="lowestInPeriod" class="rounded-md border border-sky-700/30 bg-sky-900/20 px-3 py-2 text-sky-200">
        Menor preço em 12 meses: <span class="font-semibold">{{ formatCurrency(lowestInPeriod.price) }}</span>
        ({{ formatDate(lowestInPeriod.timestamp) }}, {{ lowestInPeriod.shop }})
      </span>
      <span v-if="hasComparison" class="rounded-md border border-green-700/30 bg-green-900/20 px-3 py-2 text-green-200">
        Comparado ao preço original, você economiza
        <span class="font-semibold">{{ formatCurrency(savingAmount) }}</span>
        ({{ savingPercent }}%).
      </span>
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
import type { PriceHistoryPoint } from '~/composables/useGamesApi'

const props = defineProps<{
  history: PriceHistoryPoint[]
  currentPrice?: number
  regularPrice?: number
}>()

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0)
}

const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR')
}

// Extend the last known price to "today" so the step line reaches the present.
const chartPoints = computed<PriceHistoryPoint[]>(() => {
  const points = [...props.history]
  const last = points[points.length - 1]
  const current = Number(props.currentPrice || 0)
  if (last && current > 0) {
    points.push({ timestamp: new Date().toISOString(), price: current, shop: 'Hoje' })
  }

  return points
})

const lowestInPeriod = computed(() => {
  return props.history.reduce<PriceHistoryPoint | null>((lowest, point) => {
    return !lowest || point.price < lowest.price ? point : lowest
  }, null)
})

const hasComparison = computed(() => {
  const regular = Number(props.regularPrice || 0)
  return regular > 0 && Number(props.currentPrice || 0) < regular
})
const savingAmount = computed(() => Math.max(0, Number(props.regularPrice || 0) - Number(props.currentPrice || 0)))
const savingPercent = computed(() => {
  const regular = Number(props.regularPrice || 0)
  return regular > 0 ? Math.round((savingAmount.value / regular) * 100) : 0
})

const chartData = computed<ChartData<'line'>>(() => {
  const datasets: ChartDataset<'line'>[] = [{
    label: 'Menor preço',
    data: chartPoints.value.map((point) => point.price),
    borderColor: '#66c0f4',
    backgroundColor: 'rgba(102, 192, 244, 0.2)',
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 5,
    pointBackgroundColor: '#66c0f4',
    fill: true,
    stepped: 'before'
  }]

  if (Number(props.regularPrice || 0) > 0) {
    datasets.push({
      label: 'Preço original',
      data: chartPoints.value.map(() => Number(props.regularPrice)),
      borderColor: '#f59e0b',
      backgroundColor: 'transparent',
      borderDash: [6, 6],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false
    })
  }

  return {
    labels: chartPoints.value.map((point) => formatDate(point.timestamp)),
    datasets
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context: TooltipItem<'line'>) => {
          const value = formatCurrency(context.parsed.y ?? 0)
          if (context.datasetIndex === 1) {
            return `Preço original: ${value}`
          }

          const shop = chartPoints.value[context.dataIndex]?.shop
          return shop ? `${value} (${shop})` : value
        }
      }
    }
  },
  interaction: {
    mode: 'index' as const,
    intersect: false
  },
  scales: {
    y: {
      position: 'right' as const,
      beginAtZero: true,
      ticks: {
        callback: (tickValue: number | string) => formatCurrency(Number(tickValue)),
        color: '#9ca3af'
      },
      grid: {
        color: 'rgba(156, 163, 175, 0.2)'
      }
    },
    x: {
      ticks: {
        color: '#9ca3af',
        maxTicksLimit: 6
      },
      grid: {
        color: 'rgba(156, 163, 175, 0.08)'
      }
    }
  }
}))
</script>
