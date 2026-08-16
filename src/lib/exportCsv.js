export function downloadPackingListCsv(batchCode, items) {
  const header = ['Quantity', 'Weight (kg)', 'CBM', 'Price/CBM', 'Amount ($)', 'Notes']
  const rows = items.map((i) => [i.quantity, i.weight ?? '', i.cbm ?? '', i.price_per_cbm ?? '', i.amount ?? '', i.notes ?? ''])

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${batchCode}-packing-list.csv`
  link.click()
  URL.revokeObjectURL(url)
}
