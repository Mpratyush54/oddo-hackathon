import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { date, money } from '../../../shared/utils/format';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { usePersonal } from '../../account/hooks/usePersonal';

export function MyOrders() {
  const { data, orders } = usePersonal();
  return (
    <>
      <PageHeader
        eyebrow="MY ORDERS"
        title="Wear your community."
        description="Your merchandise orders, all in one place."
        action={
          <LinkButton to="/app/merchandise" icon="ShoppingBag">
            Visit the shop
          </LinkButton>
        }
      />
      <section className="portal-panel">
        {orders.map((o) => (
          <div className="portal-row" key={o.id}>
            <span className="icon-tile">
              <Icon name="ShoppingBag" />
            </span>
            <div>
              <strong>
                {data.products.find((p) => p.id === o.productId)?.name || o.productId}
              </strong>
              <small>
                {o.id} · Size {o.size} · {date(o.date)}
              </small>
            </div>
            <strong>{money(o.amount)}</strong>
          </div>
        ))}
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
