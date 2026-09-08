const STYLES = {
  submitted: 'text-steel',
  pending: 'text-steel',
  received: 'text-info',
  in_transit: 'text-transit',
  shipped: 'text-transit',
  arrived_port: 'text-port',
  clearing: 'text-clearing',
  picked_up: 'text-pickup',
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
  picked_up: 'Pick up',
  delivered: 'Delivered',
}

export default function StatusStamp({ status }) {
  return <span className={`stamp ${STYLES[status] || 'text-steel'}`}>{LABELS[status] || status}</span>
}
