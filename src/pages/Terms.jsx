import { Link } from 'react-router-dom'
import BrandMark from '../components/BrandMark'

const TERMS = [
  'All goods sent to our international warehouse must bear the shipping name.',
  'All waybill number(s) or receipt number(s) must be sent to our Nigerian office line to enable us give you proper information.',
  'All goods must be registered on our website to enable us give necessary updates on daily received goods and enable us process your order.',
  'All delivery — sea shipping, air cargo, express cargo, express shipping — are to be monitored on our website.',
  'If any of your goods is not received within 72 hours, kindly contact customer service.',
  'Any goods without a name will be rejected.',
  'All packages have a tracking number and order number that will enable you to monitor your package.',
  'All packages/goods are reconfirmed on arrival by our customer service points. If there are any changes, you will be notified.',
  'All packages are to be reconfirmed at our service point or in the presence of our delivery personnel. If there is any damage or loss of contact, the customer service unit will immediately inform the delivery personnel.',
  'All complaints must be confirmed and observed in the presence of our staff. Anything contrary to this shall not be accepted.',
  'All goods are to be picked up by the receiver within 14 days of arrival notice — after 14 days, goods shall start attracting demurrage.',
  'Cost of freight, custom duties, and other charges shall be paid by the customer within 14 days of arrival.',
  'For goods seized or missing in transit, the company shall not be liable for such loss, due to the risky nature of this job.',
  'In case of any damage or loss, we will refund only 30% of the actual cost of the package/goods.',
  'Customer must provide full details of suppliers and payment details, such as: invoice, payment receipt, phone number, address, waybill number (for online orders).',
  'Goods more than 3 months in our warehouse are subject to auction without notification, for international shipping.',
  'Fragile items and copy goods (branded goods without original certificate or licence) are at the owner\u2019s risk.',
  'The management shall not be liable for goods taken for sample by customs or any government agency.',
  'The management shall not be liable for any goods seized by customs or any government agency.',
  'All goods are reconfirmed on arrival — confirmation includes number of packages, weight, and volume. If there are any changes in the details of your package, you will be notified.',
]

export default function Terms() {
  return (
    <div className="min-h-screen bg-paper px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="flex items-center gap-3 mb-10">
          <BrandMark size={40} />
          <div>
            <div className="font-mono text-xs tracking-[0.2em] text-amber uppercase">Shipment Tracking</div>
            <div className="font-display text-lg font-semibold text-ink leading-tight">Beta Logistics</div>
          </div>
        </Link>

        <h1 className="font-display text-2xl font-semibold text-ink mb-6">Terms &amp; Conditions</h1>

        <ol className="space-y-4">
          {TERMS.map((term, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink leading-relaxed">
              <span className="font-mono text-steel shrink-0">{i + 1}.</span>
              <span>{term}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
