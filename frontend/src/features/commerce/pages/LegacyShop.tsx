import { useState } from 'react';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ProductArt } from '../../../shared/ui/ProductArt';
import { date, exportCSV, money } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import { useSession } from '../../auth/session';
import '../../finance/styles/finance.css';

export function ShopPage() {
  const { data, toast } = useStore();
  const { can, user } = useSession();
  const visibleOrders = data.orders.filter((o) => can('manage_orders') || o.name === user.name);
  const [sizes, setSizes] = useState<Record<string, string>>({}),
    [tab, setTab] = useState('Shop');
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE PIECE OF YOUR COMMUNITY"
        title="Wear your Skyline"
        description="Thoughtfully made. Proudly worn. Something to take the memories with you."
        action={
          <Button
            variant="secondary"
            icon={tab === 'Shop' ? 'Package' : 'ShoppingBag'}
            onClick={() => setTab(tab === 'Shop' ? 'Orders' : 'Shop')}
          >
            {tab === 'Shop' ? `View orders (${visibleOrders.length})` : 'Back to shop'}
          </Button>
        }
      />
      {tab === 'Shop' ? (
        <>
          <section className="shop-banner dark-card">
            <div>
              <div className="hero-eyebrow">THE CAMPUS COLLECTION · 2026</div>
              <h2>Belonging looks good on you.</h2>
              <p>Every purchase supports our next great community moment.</p>
              <span>
                <Icon name="BadgeCheck" size={17} />A little member discount, on every piece.
              </span>
            </div>
            <div className="shop-banner-art">
              <Icon name="Shirt" size={100} />
              <span>skyline.</span>
            </div>
          </section>
          <div className="product-grid">
            {data.products.map((p) => {
              const size = sizes[p.id];
              const remaining = Object.values(p.stock).reduce((s, n) => s + n, 0);
              return (
                <article className="product-card" key={p.id}>
                  <ProductArt type={p.type} color={p.color} />
                  <div className="product-card-content">
                    <div className="product-tag">
                      <span>{p.type}</span>
                      <Badge tone={remaining < 10 ? 'gold' : 'green'}>{remaining} in stock</Badge>
                    </div>
                    <h2>{p.name}</h2>
                    <div className="product-price">
                      <strong>{money(p.memberPrice)}</strong>
                      <span>member price</span>
                      <del>{money(p.price)}</del>
                    </div>
                    <div className="size-heading">
                      {p.type === 'Tote bag' ? 'A fit for everything' : 'Find your fit'}
                      {size && (
                        <span>
                          {p.stock[size]} left in {size}
                        </span>
                      )}
                    </div>
                    <div className="size-chips">
                      {Object.entries(p.stock).map(([s, count]) => (
                        <button
                          key={s}
                          className={size === s ? 'selected' : ''}
                          aria-pressed={size === s}
                          disabled={!count}
                          aria-label={`Size ${s}${count ? '' : ', sold out'}`}
                          onClick={() => setSizes({ ...sizes, [p.id]: s })}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {size ? (
                      <LinkButton
                        to={`/app/checkout?product=${p.id}&size=${encodeURIComponent(size)}`}
                        icon="ShoppingBag"
                      >
                        Make it yours
                      </LinkButton>
                    ) : (
                      <Button
                        variant="secondary"
                        className="full-width"
                        icon="ShoppingBag"
                        onClick={() => toast('Pick your size above to continue to checkout.')}
                      >
                        Select your size
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="shop-benefits">
            {[
              ['Leaf', 'A little lighter on the planet', 'Thoughtful fabrics. Reusable packaging.'],
              ['MapPin', 'Easy campus pickup', 'Collect from the Student Union office.'],
              ['Heart', 'Every order gives back', 'Supporting events for your community.'],
            ].map(([icon, title, text]) => (
              <div key={title}>
                <Icon name={icon} size={23} />
                <span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <section className="card table-card">
          <div className="table-toolbar">
            <h2>Your store orders</h2>
            <Button
              variant="secondary"
              icon="Download"
              onClick={() =>
                exportCSV('skyline-orders.csv', [
                  ['Order', 'Name', 'Product', 'Size', 'Amount', 'Date'],
                  ...visibleOrders.map((o) => [
                    o.id,
                    o.name,
                    data.products.find((p) => p.id === o.productId)?.name || '',
                    o.size,
                    o.amount,
                    o.date,
                  ]),
                ])
              }
            >
              Export orders
            </Button>
          </div>
          {visibleOrders.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th>Size</th>
                    <th className="numeric">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.name}</td>
                      <td>{data.products.find((p) => p.id === o.productId)?.name}</td>
                      <td>{o.size}</td>
                      <td className="numeric">{money(o.amount)}</td>
                      <td>
                        <Badge tone="green">Ready for pickup</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Good things are in store"
              description="Orders appear here as soon as someone checks out."
              action={
                <Button icon="ShoppingBag" onClick={() => setTab('Shop')}>
                  Explore the collection
                </Button>
              }
            />
          )}
        </section>
      )}
    </>
  );
}
