const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatBrl = (value: number): string => brl.format(Number.isFinite(value) ? value : 0)
