const STYLES = {
  submitted: 'text-steel',
  pending: 'text-steel',
  received: 'text-amber',
  in_transit: 'text-amber',
  shipped: 'text-amber',
  arrived_port: 'text-cargo',
  clearing: 'text-cargo',
  delivered: 'text-cargo',
}

const LABELS = {
  submitted: 'Submitted',
  pending: 'Pending',
  received: 'Received',
  in_transit: 'In transit',
  shipped: 'Shipped',
  arrived_port: 'Arrived at port',
  clearing: 'Clearing',
  delivered: 'Delivered',
}

export default function StatusStamp({ status }) {
  return <span className={`stamp ${STYLES[status] || 'text-steel'}`}>{LABELS[status] || status}</span>
}
