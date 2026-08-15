export function downloadPackingListCsv(batchCode, items) {
  const header = ['Item', 'Quantity', 'Weight', 'Unit', 'Notes']
  const rows = items.map((i) => [i.item_name, i.quantity, i.weight ?? '', i.weight_unit, i.notes ?? ''])

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
