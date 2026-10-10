import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Field } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Logo } from '../../../shared/ui/Logo';
import { Modal } from '../../../shared/ui/Modal';
import { ProductArt } from '../../../shared/ui/ProductArt';
import { SearchField } from '../../../shared/ui/SearchField';
import { date, exportCSV, exportInvoicePdf, money, moneyPdf, today } from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import type { OrderStatus, Product, Store } from '../../../shared/types/domain';
const orderStatuses: OrderStatus[] = ['Placed', 'Ready for pickup', 'Picked up', 'Cancelled'];
const orderStatusTone = (status?: string) =>
  status === 'Picked up'
    ? 'green'
    : status === 'Cancelled'
      ? 'neutral'
      : status === 'Ready for pickup'
        ? 'teal'
        : 'gold';
import { clubRequest } from '../../commerce/api/commerce.api';
import { useSession } from '../../auth/session';
import GarmentPreview from '../components/GarmentPreview';
import { Revealed } from '../../../shared/components/PageMotion';
import '../styles/shop.css';

type ServerReply = {
  patch: Partial<Store>;
  total?: number;
  orders?: Array<{ id: string }>;
  order?: { id: string };
  discount?: number;
  promoDiscount?: number;
  membershipFee?: number;
};
const stockPhotos: Record<string, string> = {
  Hoodie:
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=85',
  'T-shirt':
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85',
  'Tote bag':
    'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85',
};
function ProductPhoto({ product }: { product: Product & { image?: string } }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.id]);
  return failed ? (
    <ProductArt type={product.type} color={product.color} />
  ) : (
    <img
      className="shop-product-photo"
      src={product.image || stockPhotos[product.type] || stockPhotos.Hoodie}
      alt={`${product.type} product photograph — illustrative catalog image`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
const productNotes: Record<string, string> = {
  Hoodie: 'A soft campus staple for early lectures, late projects, and everything in between.',
  'T-shirt': 'The everyday essential. A simple way to take a little community wherever you go.',
  'Tote bag': 'Books, groceries, a brilliant idea. Make room for whatever your day brings.',
};
export function ShopPage({ publicView = false }: { publicView?: boolean }) {
  const { data, applyServerPatch, update, toast, organizations, selectedClub, selectClub } =
    useStore();
  const { user, signedIn, can } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState('All pieces'),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('featured');
  const [productId, setProductId] = useState(params.get('product') || ''),
    [size, setSize] = useState(''),
    [quantity, setQuantity] = useState(1),
    [color, setColor] = useState('teal'),
    [fit, setFit] = useState(false),
    [height, setHeight] = useState(''),
    [chest, setChest] = useState(''),
    [fitResult, setFitResult] = useState(''),
    [agree, setAgree] = useState(false);
  const canManageOrders = can('manage_orders');
  const canManageInventory = can('manage_inventory');
  const isOpsRole = !publicView && (canManageOrders || canManageInventory);
  const [staff, setStaff] = useState(isOpsRole);
  const [receipt, setReceipt] = useState<{
    refs: string[];
    name: string;
    amount: number;
    size: string;
    quantity: number;
  } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false),
    [joinMembership, setJoinMembership] = useState(false),
    [promoCode, setPromoCode] = useState(''),
    [promoDiscount, setPromoDiscount] = useState(0),
    [promoMessage, setPromoMessage] = useState(''),
    [inventory, setInventory] = useState(false),
    [inventoryProduct, setInventoryProduct] = useState(''),
    [inventorySize, setInventorySize] = useState(''),
    [delta, setDelta] = useState('1'),
    [inventoryReason, setInventoryReason] = useState('');
  useEffect(() => {
    if (isOpsRole) setStaff(true);
  }, [isOpsRole, selectedClub]);
  const organization = organizations.find((c) => c.id === selectedClub);
  const clubOrders = data.orders;
  const product = data.products.find((p) => p.id === productId);
  const member =
    signedIn &&
    data.members.some(
      (m) =>
        m.email.toLowerCase() === user.email.toLowerCase() &&
        (m.status === 'Active' || m.status === 'Expiring') &&
        m.expires >= today,
    );
  const unitPrice = product ? (member || joinMembership ? product.memberPrice : product.price) : 0;
  const checkoutTotal =
    Math.max(0, unitPrice * quantity - promoDiscount) + (!member && joinMembership ? 500 : 0);
  const filtered = data.products
    .filter(
      (p) =>
        (category === 'All pieces' || p.type === category) &&
        p.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'low'
        ? member
          ? a.memberPrice - b.memberPrice
          : a.price - b.price
        : sort === 'high'
          ? member
            ? b.memberPrice - a.memberPrice
            : b.price - a.price
          : 0,
    );
  useEffect(() => {
    const p = data.products.find((p) => p.id === productId);
    setSize(p ? Object.entries(p.stock).find(([, n]) => n > 0)?.[0] || '' : '');
    setColor(p?.color || 'teal');
    setQuantity(1);
    setAgree(false);
    setPreview(false);
    setJoinMembership(false);
    setPromoCode('');
    setPromoDiscount(0);
    setPromoMessage('');
    setError('');
  }, [productId, selectedClub]);
  useEffect(() => {
    const club = params.get('club');
    if (club && organizations.some((c) => c.id === club) && selectedClub !== club) selectClub(club);
    const id = params.get('product');
    if (id) setProductId(id);
  }, [params, organizations, selectedClub, selectClub]);
  const openProduct = (id: string) => {
    setProductId(id);
    setParams({ product: id }, { replace: true });
  };
  const closeProduct = () => {
    setProductId('');
    setParams({}, { replace: true });
  };
  useEffect(() => {
    setPromoDiscount(0);
    setPromoMessage('');
  }, [quantity, joinMembership, promoCode]);
  const quotePromo = async () => {
    if (!signedIn) {
      setPromoMessage('Sign in to apply a promo code.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const reply = await clubRequest<ServerReply>(selectedClub, '/promos/quote', {
        method: 'POST',
        snapshot: data,
        actor: user,
        body: {
          code: promoCode.trim(),
          productId,
          quantity,
          joinMembership,
          email: user.email,
        },
      });
      setPromoDiscount(reply.discount ?? reply.promoDiscount ?? 0);
      setPromoMessage(`Promo applied: save ${money(reply.discount ?? reply.promoDiscount ?? 0)}.`);
    } catch (error) {
      setPromoDiscount(0);
      setPromoMessage(error instanceof Error ? error.message : 'Could not apply this code.');
    } finally {
      setPending(false);
    }
  };
  const purchase = async () => {
    if (!signedIn) {
      const target = `${publicView ? '/shop' : '/app/merchandise'}?product=${encodeURIComponent(productId)}&club=${encodeURIComponent(selectedClub)}`;
      navigate(`/login?returnTo=${encodeURIComponent(target)}`);
      return;
    }
    if (
      !can('shop') ||
      !product ||
      !size ||
      quantity < 1 ||
      quantity > (product.stock[size] || 0) ||
      !agree ||
      pending
    )
      return;
    setPending(true);
    setError('');
    const targetClub = selectedClub;
    try {
      const reply = await clubRequest<ServerReply>(targetClub, '/orders', {
        method: 'POST',
        snapshot: data,
        actor: user,
        body: {
          productId,
          size,
          quantity,
          promoCode: promoCode.trim() || undefined,
          joinMembership: !member && joinMembership,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      applyServerPatch(targetClub, reply.patch);
      const refs =
        reply.orders?.map((o) => o.id) ||
        (reply.order
          ? [reply.order.id]
          : reply.patch.orders
              ?.filter((o) => o.productId === productId && o.name === user.name)
              .slice(0, quantity)
              .map((o) => o.id) || []);
      setReceipt({
        refs,
        name: product.name,
        amount: reply.total ?? checkoutTotal,
        size,
        quantity,
      });
      closeProduct();
      toast(
        joinMembership && !member
          ? 'Order and membership saved. Member prices now apply. No real payment taken.'
          : 'Order saved to the server. Inventory and ledger updated. No real payment taken.',
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Order could not be saved. Please try again.',
      );
    } finally {
      setPending(false);
    }
  };
  const adjustInventory = async () => {
    if (!can('manage_inventory')) return;
    setPending(true);
    setError('');
    const targetClub = selectedClub;
    try {
      const reply = await clubRequest<ServerReply>(targetClub, '/inventory', {
        method: 'POST',
        snapshot: data,
        actor: user,
        body: {
          productId: inventoryProduct,
          size: inventorySize,
          delta: Number(delta),
          reason: inventoryReason.trim(),
        },
      });
      applyServerPatch(targetClub, reply.patch);
      setInventory(false);
      toast('Inventory adjustment saved with an audit record.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Stock adjustment failed.');
    } finally {
      setPending(false);
    }
  };
  const showOps = staff && isOpsRole;
  const content = (
    <div className={`sky-shop ${showOps ? 'sky-shop-ops' : ''}`}>
      <div className="shop-breadcrumb">
        <Link to={publicView ? '/' : '/app'}>Skyline</Link>
        <Icon name="ChevronRight" size={13} />
        <span>{showOps ? 'Merchandise desk' : 'The campus collection'}</span>
      </div>
      {showOps ? (
        <header className="sky-shop-heading shop-ops-heading">
          <div>
            <span className="shop-overline">
              {canManageInventory ? 'INVENTORY & ORDERS' : 'CLUB ORDERS'}
            </span>
            <h1>{canManageInventory ? 'Merchandise desk' : 'Order desk'}</h1>
          </div>
          <p>
            {canManageInventory
              ? 'Adjust stock, track pickups, and keep the collection moving.'
              : 'Track merchandise orders and campus pickups. Inventory stays with the club admin.'}
          </p>
        </header>
      ) : (
        <>
          <header className="sky-shop-heading">
            <div>
              <span className="shop-overline">THE CAMPUS COLLECTION / 2026</span>
              <h1>
                A little more
                <br />
                <em>you. A little more us.</em>
              </h1>
            </div>
            <p>
              Thoughtful pieces for everyday campus life.
              <br />
              Wear your community. Support what comes next.
            </p>
          </header>
          <section className="sky-shop-hero">
            <div className="sky-shop-hero-copy">
              <Badge tone="gold">THE EVERYDAY EDIT</Badge>
              <h2>
                Belonging
                <br />
                looks good on you.
              </h2>
              <p>From the first coffee to the last study session. Meet your next campus staple.</p>
              <Button
                icon="ArrowUpRight"
                onClick={() => {
                  const p = data.products.find((p) => p.type === 'Hoodie') || data.products[0];
                  if (p) openProduct(p.id);
                }}
              >
                Explore the collection
              </Button>
              <span>{organization?.name} · Student-led, community-first</span>
            </div>
            <div className="sky-shop-hero-art">
              <ProductPhoto
                product={
                  data.products.find((p) => p.type === 'Hoodie') ||
                  data.products[0] || {
                    id: 'hero',
                    name: 'Hoodie',
                    type: 'Hoodie',
                    color: 'teal',
                    price: 0,
                    memberPrice: 0,
                    stock: {},
                  }
                }
              />
              <span className="shop-hero-stamp">
                MADE TO
                <br />
                <strong>BELONG.</strong>
              </span>
            </div>
          </section>
          <div className="shop-value-strip">
            <span>
              <Icon name="MapPin" size={17} />
              Easy campus pickup
            </span>
            <span>
              <Icon name="BadgeCheck" size={17} />
              Member prices, verified
            </span>
            <span>
              <Icon name="Heart" size={17} />
              Every order supports your club
            </span>
          </div>
        </>
      )}
      {isOpsRole && (
        <div className="shop-staff-toggle">
          <Button
            variant="secondary"
            icon={staff ? 'ShoppingBag' : canManageInventory ? 'Package' : 'Package'}
            onClick={() => setStaff(!staff)}
          >
            {staff
              ? 'Browse catalog'
              : canManageInventory
                ? 'Inventory & orders'
                : 'View club orders'}
          </Button>
        </div>
      )}
      {showOps ? (
        <>
          <div className="shop-management-actions">
            {canManageInventory && (
              <Button
                icon="Package"
                onClick={() => {
                  setInventory(true);
                  setError('');
                  setInventoryProduct(data.products[0]?.id || '');
                  setInventorySize(Object.keys(data.products[0]?.stock || {})[0] || '');
                }}
              >
                Adjust stock
              </Button>
            )}
            {canManageInventory && (
              <LinkButton to="/app/contributions" variant="secondary" icon="HeartHandshake">
                Promos & points
              </LinkButton>
            )}
            <Button
              variant="secondary"
              icon="Download"
              onClick={() =>
                exportCSV('skyline-orders.csv', [
                  ['Order', 'Name', 'Product', 'Size', 'Amount', 'Date'],
                  ...clubOrders.map((o) => [
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

          {canManageInventory && (
            <section className="card table-card shop-ops-card">
              <div className="table-toolbar">
                <h2>Stock levels</h2>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Type</th>
                      <th>Sizes in stock</th>
                      <th className="numeric">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => {
                      const total = Object.values(p.stock).reduce((s, n) => s + n, 0);
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.name}</strong>
                          </td>
                          <td>{p.type}</td>
                          <td>
                            {Object.entries(p.stock)
                              .map(([s, n]) => `${s}: ${n}`)
                              .join(' · ') || '—'}
                          </td>
                          <td className="numeric">
                            <Badge tone={total < 10 ? 'gold' : 'green'}>{total}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card table-card shop-ops-card">
            <div className="table-toolbar">
              <h2>Orders ({clubOrders.length})</h2>
            </div>
            {clubOrders.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Size</th>
                      <th className="numeric">Total</th>
                      <th>Date</th>
                      <th>Delivery status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...clubOrders]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((o) => {
                        const productName =
                          data.products.find((p) => p.id === o.productId)?.name || 'Merchandise';
                        const status = (o.status || 'Placed') as OrderStatus;
                        return (
                          <tr key={o.id}>
                            <td>{o.id}</td>
                            <td>{o.name}</td>
                            <td>{productName}</td>
                            <td>{o.size}</td>
                            <td className="numeric">{money(o.amount)}</td>
                            <td>{date(o.date, { day: 'numeric', month: 'short' })}</td>
                            <td>
                              <div className="shop-order-status-cell">
                                <Badge tone={orderStatusTone(status)}>{status}</Badge>
                                <select
                                  aria-label={`Update status for ${o.id}`}
                                  className="shop-order-status-select"
                                  value={status}
                                  onChange={(e) => {
                                    const next = e.target.value as OrderStatus;
                                    update((d) => ({
                                      ...d,
                                      orders: d.orders.map((row) =>
                                        row.id === o.id ? { ...row, status: next } : row,
                                      ),
                                    }));
                                    toast(`Order ${o.id} → ${next}`);
                                  }}
                                >
                                  {orderStatuses.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td>
                              <Button
                                variant="secondary"
                                icon="Download"
                                onClick={() =>
                                  exportInvoicePdf(`${o.id}-invoice.pdf`, {
                                    title: 'Skyline merchandise invoice',
                                    reference: o.id,
                                    customer: o.name,
                                    email: o.email,
                                    items: [
                                      {
                                        description: productName,
                                        detail: `Size: ${o.size}`,
                                        quantity: 1,
                                        amount: moneyPdf(o.amount),
                                      },
                                    ],
                                    lines: [
                                      { label: 'Status', value: status },
                                      ...(o.promoCode
                                        ? [{ label: 'Promo', value: o.promoCode }]
                                        : []),
                                    ],
                                    total: moneyPdf(o.amount),
                                    note: 'Demo payment - no money charged.',
                                  })
                                }
                              >
                                Invoice
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No orders yet"
                description="Club merchandise orders will show up here after checkout."
              />
            )}
          </section>
        </>
      ) : (
        <>
          <div className="sky-shop-toolbar">
            <div className="shop-category-tabs">
              {['All pieces', ...new Set(data.products.map((p) => p.type))].map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  className={category === c ? 'active' : ''}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div>
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Find your next favourite…"
              />
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="featured">Featured pieces</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            </div>
          </div>
          <div className="shop-collection-label">
            <span>{filtered.length} considered pieces</span>
            <span>
              {member
                ? 'Your member prices are applied'
                : 'Open to everyone · members save a little extra'}
            </span>
          </div>
          <div className="sky-shop-products">
            {filtered.map((p, i) => {
              const stock = Object.values(p.stock).reduce((s, n) => s + n, 0);
              return (
                <Revealed
                  key={p.id}
                  delay={Math.min(250, i * 70)}
                  pop
                  as="article"
                  className="sky-shop-product"
                >
                  <button
                    className="sky-shop-product-art"
                    aria-label={`Explore ${p.name}`}
                    onClick={() => openProduct(p.id)}
                  >
                    <ProductPhoto product={p} />
                    <span className="shop-product-top">
                      <span>{i === 0 ? 'THE CAMPUS FAVOURITE' : p.type.toUpperCase()}</span>
                      <Icon name="ArrowUpRight" size={20} />
                    </span>
                    <span className="shop-product-bottom">
                      QUICK LOOK <Icon name="Plus" size={14} />
                    </span>
                  </button>
                  <div className="sky-shop-product-info">
                    <div>
                      <small>
                        {p.type} · {stock > 0 ? `${stock} available` : 'Sold out'}
                      </small>
                      <h2>
                        <button onClick={() => openProduct(p.id)}>{p.name}</button>
                      </h2>
                      <p>{productNotes[p.type]}</p>
                    </div>
                    <strong>{money(member ? p.memberPrice : p.price)}</strong>
                  </div>
                  <div className="shop-product-member-price">
                    <span>
                      {member
                        ? `Membership saving ${money(p.price - p.memberPrice)} included`
                        : `Save ${money(p.price - p.memberPrice)} with membership`}
                    </span>
                    <button onClick={() => openProduct(p.id)}>
                      Choose your fit <Icon name="ArrowRight" size={14} />
                    </button>
                  </div>
                </Revealed>
              );
            })}
          </div>
          {!filtered.length && (
            <Empty
              title="No pieces match just yet"
              description="Try a different search or category."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setCategory('All pieces');
                  }}
                >
                  View all pieces
                </Button>
              }
            />
          )}
          <section className="shop-editorial-note">
            <span className="shop-overline">MORE THAN A PIECE OF CLOTHING</span>
            <h2>Take the memories with you.</h2>
            <p>
              Every purchase contributes to the club's next event, next idea, and next great
              semester. One little piece. A whole lot of community.
            </p>
            <Link to={signedIn ? '/app/my-card' : '/clubs'} className="text-link">
              {signedIn ? 'Explore your membership' : 'Find your community'}{' '}
              <Icon name="ArrowUpRight" size={17} />
            </Link>
          </section>
        </>
      )}
    </div>
  );
  return (
    <>
      {publicView ? (
        <div className="sky-public-shop">
          <nav className="sky-shop-public-nav">
            <Logo />
            <div>
              <Link to="/clubs">Discover clubs</Link>
              <label>
                <span className="sr-only">Choose a club shop</span>
                <select
                  aria-label="Choose a club shop"
                  value={selectedClub}
                  onChange={(e) => {
                    selectClub(e.target.value);
                    closeProduct();
                  }}
                >
                  {organizations.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <LinkButton to={signedIn ? '/app' : '/login'} variant="secondary" icon="UserRound">
                {signedIn ? 'My workspace' : 'Sign in'}
              </LinkButton>
            </div>
          </nav>
          {content}
          <footer className="sky-shop-footer">
            <Logo />
            <span>Your campus. Your people. Your collection.</span>
            <Link to="/">Back to Skyline →</Link>
          </footer>
        </div>
      ) : (
        content
      )}
      {product && !fit && (
        <Modal
          title="Your next everyday favourite"
          description={`${organization?.name} · Campus collection`}
          wide
          onClose={closeProduct}
        >
          <div className="shop-product-modal">
            <div className="shop-modal-preview">
              <div className="shop-preview-toggle" role="tablist" aria-label="Product preview mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!preview}
                  className={!preview ? 'active' : ''}
                  onClick={() => setPreview(false)}
                >
                  Product photo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={preview}
                  className={preview ? 'active' : ''}
                  onClick={() => setPreview(true)}
                >
                  Interactive preview
                </button>
              </div>
              <div className="shop-modal-media">
                {preview ? (
                  <GarmentPreview kind={product.type} color={color} onColorChange={setColor} />
                ) : (
                  <ProductPhoto product={product} />
                )}
              </div>
              <p>
                Catalog photography and preview colours are illustrative. Stocked colour:{' '}
                {product.color}.
              </p>
            </div>
            <div className="shop-modal-details">
              <span className="shop-overline">{product.type.toUpperCase()}</span>
              <h2>{product.name}</h2>
              <p>{productNotes[product.type]}</p>
              <div className="shop-modal-price">
                <strong>{money(unitPrice)}</strong>
                <span>
                  {member || joinMembership
                    ? 'Membership saving included'
                    : `Save ${money(product.price - product.memberPrice)} with membership`}
                </span>
              </div>
              <div className="shop-size-heading">
                <strong>
                  {product.type === 'Tote bag'
                    ? 'One size, plenty of possibility'
                    : 'Choose your size'}
                </strong>
                {product.type !== 'Tote bag' && (
                  <button
                    onClick={() => {
                      setFit(true);
                      setFitResult('');
                    }}
                  >
                    Find my fit <Icon name="CircleHelp" size={14} />
                  </button>
                )}
              </div>
              <div className="shop-size-options">
                {Object.entries(product.stock).map(([s, n]) => (
                  <button
                    key={s}
                    disabled={!n}
                    className={size === s ? 'selected' : ''}
                    aria-pressed={size === s}
                    aria-label={`${s}, ${n} available`}
                    onClick={() => {
                      setSize(s);
                      setQuantity(1);
                    }}
                  >
                    {s}
                    {!n && <small>Sold out</small>}
                  </button>
                ))}
              </div>
              <span className="shop-stock-note">
                {size
                  ? `${product.stock[size] || 0} left in ${size}`
                  : 'This piece is currently sold out.'}
              </span>
              <div className="shop-quantity">
                <span>Quantity</span>
                <div>
                  <button
                    aria-label="Decrease quantity"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => q - 1)}
                  >
                    <Icon name="Minus" size={15} />
                  </button>
                  <strong>{quantity}</strong>
                  <button
                    aria-label="Increase quantity"
                    disabled={!size || quantity >= (product.stock[size] || 0) || quantity >= 10}
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Icon name="Plus" size={15} />
                  </button>
                </div>
                <strong>{money(unitPrice * quantity)}</strong>
              </div>
              {!member && (
                <div className="shop-membership-offer">
                  <label>
                    <input
                      type="checkbox"
                      checked={joinMembership}
                      onChange={(e) => setJoinMembership(e.target.checked)}
                    />
                    <span>
                      <strong>Add annual club membership · ₹500</strong>
                      <small>
                        Save {money((product.price - product.memberPrice) * quantity)} on this
                        order. Membership costs ₹500;{' '}
                        {500 > (product.price - product.memberPrice) * quantity
                          ? `this order costs ${money(500 - (product.price - product.memberPrice) * quantity)} more with membership`
                          : `your net saving is ${money((product.price - product.memberPrice) * quantity - 500)}`}
                        . Future eligible purchases also receive member pricing.
                      </small>
                    </span>
                  </label>
                </div>
              )}
              <div className="shop-promo-input">
                <input
                  aria-label="Promo code"
                  placeholder="Promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                />
                <Button
                  variant="secondary"
                  disabled={pending || !promoCode.trim()}
                  onClick={quotePromo}
                >
                  Apply
                </Button>
              </div>
              {promoMessage && (
                <p className="shop-promo-message" role="status">
                  {promoMessage}
                </p>
              )}
              <dl className="shop-checkout-breakdown">
                <div>
                  <dt>Items ({quantity})</dt>
                  <dd>{money(unitPrice * quantity)}</dd>
                </div>
                {!member && joinMembership && (
                  <div>
                    <dt>Annual membership</dt>
                    <dd>₹500</dd>
                  </div>
                )}
                {promoDiscount > 0 && (
                  <div>
                    <dt>Promo discount</dt>
                    <dd>−{money(promoDiscount)}</dd>
                  </div>
                )}
                <div>
                  <dt>Total</dt>
                  <dd>{money(checkoutTotal)}</dd>
                </div>
              </dl>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              {signedIn && (
                <label className="shop-pickup-consent">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  <span>
                    I understand this is demo checkout and I'll collect from the Student Union
                    office.
                  </span>
                </label>
              )}
              <Button
                className="full-width"
                icon={signedIn ? 'ShoppingBag' : 'UserRound'}
                disabled={
                  pending ||
                  !size ||
                  !(product.stock[size] > 0) ||
                  (signedIn && (!agree || !can('shop')))
                }
                onClick={purchase}
              >
                {pending
                  ? 'Saving order…'
                  : signedIn && !can('shop')
                    ? 'Browse-only college persona'
                    : signedIn
                      ? `Place test order · ${money(checkoutTotal)}`
                      : 'Sign in to order'}
              </Button>
              <div className="shop-checkout-note">
                <Icon name="ShieldCheck" size={15} />
                <span>No real charge. Orders, inventory and ledger are saved by the server.</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {inventory && (
        <Modal
          title="Adjust club stock"
          description="Every change requires a reason and is saved in the server audit."
          onClose={() => {
            if (!pending) setInventory(false);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void adjustInventory();
            }}
          >
            <Field label="Product">
              <select
                value={inventoryProduct}
                onChange={(e) => {
                  setInventoryProduct(e.target.value);
                  setInventorySize(
                    Object.keys(
                      data.products.find((p) => p.id === e.target.value)?.stock || {},
                    )[0] || '',
                  );
                }}
              >
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-two">
              <Field label="Size">
                <select value={inventorySize} onChange={(e) => setInventorySize(e.target.value)}>
                  {Object.entries(
                    data.products.find((p) => p.id === inventoryProduct)?.stock || {},
                  ).map(([size, count]) => (
                    <option key={size} value={size}>
                      {size} · {count} in stock
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stock change" hint="Positive adds units; negative removes units.">
                <input
                  type="number"
                  required
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Reason">
              <textarea
                required
                minLength={4}
                value={inventoryReason}
                onChange={(e) => setInventoryReason(e.target.value)}
                placeholder="Restocked from supplier / damaged item"
              />
            </Field>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={pending || Number(delta) === 0} icon="Check">
              {pending ? 'Saving…' : 'Save adjustment'}
            </Button>
          </form>
        </Modal>
      )}
      {fit && (
        <Modal
          title="A little help finding your fit"
          description="An approximate size guide, not an AI body measurement."
          onClose={() => setFit(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = Number(chest),
                h = Number(height);
              if (
                !Number.isFinite(c) ||
                c < 55 ||
                c > 160 ||
                !Number.isFinite(h) ||
                h < 120 ||
                h > 220
              ) {
                setFitResult('Please enter height 120–220 cm and chest 55–160 cm.');
                return;
              }
              const base = c <= 92 ? 'S' : c <= 100 ? 'M' : c <= 108 ? 'L' : 'XL';
              setFitResult(
                `Start with ${base}${h > 185 && base !== 'XL' ? ' and consider sizing up for length' : ''}. For a relaxed fit, choose the next size. This is approximate; check fit at campus pickup.`,
              );
            }}
          >
            <div className="form-two">
              <Field label="Height (cm)">
                <input
                  type="number"
                  min="120"
                  max="220"
                  required
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="170"
                />
              </Field>
              <Field label="Chest circumference (cm)">
                <input
                  type="number"
                  min="55"
                  max="160"
                  required
                  value={chest}
                  onChange={(e) => setChest(e.target.value)}
                  placeholder="96"
                />
              </Field>
            </div>
            <p className="shop-fit-hint">
              Measure around the fullest part of your chest with a tape. Measurements stay in this
              form and are not saved.
            </p>
            <Button type="submit" icon="Shirt">
              Suggest a starting size
            </Button>
            {fitResult && (
              <div className="shop-fit-result" role="status">
                {fitResult}
              </div>
            )}
          </form>
        </Modal>
      )}
      {receipt && (
        <Modal
          title="A little community, coming your way."
          description="Order saved to the server · no real payment taken"
          onClose={() => setReceipt(null)}
        >
          <div className="shop-order-success">
            <span className="icon-tile">
              <Icon name="CircleCheck" size={35} />
            </span>
            <h2>{receipt.name}</h2>
            <p>
              {receipt.quantity} piece{receipt.quantity > 1 ? 's' : ''} · Size {receipt.size} ·{' '}
              {money(receipt.amount)}
            </p>
            <small>{receipt.refs.join(' · ')}</small>
            <div>
              <Icon name="MapPin" />
              <p>
                Campus pickup at the Student Union office.
                <br />
                Your order appears in your personal workspace.
              </p>
            </div>
            <div className="shop-order-success-actions">
              <Button
                icon="Download"
                variant="secondary"
                onClick={() =>
                  exportInvoicePdf(`${receipt.refs[0] || 'order'}-invoice.pdf`, {
                    title: 'Skyline merchandise invoice',
                    reference: receipt.refs.join(', '),
                    customer: user.name,
                    email: user.email,
                    items: [
                      {
                        description: receipt.name,
                        detail: `Size: ${receipt.size}`,
                        quantity: receipt.quantity,
                        amount: moneyPdf(receipt.amount),
                      },
                    ],
                    total: moneyPdf(receipt.amount),
                    note: 'Demo payment - no money charged.',
                  })
                }
              >
                Download invoice PDF
              </Button>
              <LinkButton to="/app/my-orders" icon="ShoppingBag">
                View my orders
              </LinkButton>
              <Button variant="secondary" onClick={() => setReceipt(null)}>
                Keep exploring
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
