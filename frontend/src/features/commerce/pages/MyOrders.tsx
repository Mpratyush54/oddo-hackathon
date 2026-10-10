import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, exportInvoicePdf, money } from '../../../shared/utils/format';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { usePersonal } from '../../account/hooks/usePersonal';

const statusTone = (status?: string) =>
  status === 'Picked up'
    ? 'green'
    : status === 'Cancelled'
      ? 'neutral'
      : status === 'Ready for pickup'
        ? 'teal'
        : 'gold';

export function MyOrders() {
  const { data, orders, user } = usePersonal();
  return (
    <>
      <PageHeader
        eyebrow="MY ORDERS"
        title="Wear your community."
        description="Track pickup status and download your invoice."
        action={
          <LinkButton to="/app/merchandise" icon="ShoppingBag">
            Visit the shop
          </LinkButton>
        }
      />
      <section className="portal-panel">
        {orders.map((o) => {
          const productName =
            data.products.find((p) => p.id === o.productId)?.name || o.productId;
          const status = o.status || 'Placed';
          return (
            <div className="portal-row" key={o.id}>
              <span className="icon-tile">
                <Icon name="ShoppingBag" />
              </span>
              <div>
                <strong>{productName}</strong>
                <small>
                  {o.id} · Size {o.size} · {date(o.date)}
                </small>
                <div style={{ marginTop: 6 }}>
                  <Badge tone={statusTone(status)}>{status}</Badge>
                </div>
              </div>
              <div className="my-order-actions">
                <strong>{money(o.amount)}</strong>
                <Button
                  variant="secondary"
                  icon="Download"
                  onClick={() =>
                    exportInvoicePdf(`${o.id}-invoice.pdf`, {
                      title: 'Skyline merchandise invoice',
                      reference: o.id,
                      customer: o.name || user.name,
                      email: o.email || user.email,
                      lines: [
                        { label: 'Item', value: productName },
                        { label: 'Size', value: o.size },
                        { label: 'Status', value: status },
                        ...(o.promoCode ? [{ label: 'Promo', value: o.promoCode }] : []),
                        { label: 'Payment', value: 'Demo payment — no money charged' },
                      ],
                      total: money(o.amount),
                    })
                  }
                >
                  Invoice
                </Button>
              </div>
            </div>
          );
        })}
        {!orders.length && (
          <Empty
            title="A fresh wardrobe starts here"
            description="Your club shop orders will appear here after checkout."
            action={<LinkButton to="/app/merchandise">Explore merchandise</LinkButton>}
          />
        )}
      </section>
    </>
  );
}
