import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Empty,
  Field,
  Icon,
  LinkButton,
  Logo,
  Modal,
  ProductArt,
  SearchField,
} from '../components';
import { money, today, uid, useStore } from '../store';
import { useSession } from '../session';
import GarmentPreview from './GarmentPreview';
import { ShopPage as InventoryShop } from './Commerce';
import '../shop.css';

const productNotes: Record<string, string> = {
  Hoodie: 'A soft campus staple for early lectures, late projects, and everything in between.',
  'T-shirt': 'The everyday essential. A simple way to take a little community wherever you go.',
  'Tote bag': 'Books, groceries, a brilliant idea. Make room for whatever your day brings.',
};
export function ShopPage({ publicView = false }: { publicView?: boolean }) {
  const { data, update, toast, organizations, selectedClub, selectClub } = useStore();
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
    [agree, setAgree] = useState(false),
    [staff, setStaff] = useState(false);
  const [receipt, setReceipt] = useState<{
    refs: string[];
    name: string;
    amount: number;
    size: string;
    quantity: number;
  } | null>(null);
  const organization = organizations.find((c) => c.id === selectedClub);
  const product = data.products.find((p) => p.id === productId);
  const member =
    signedIn &&
    data.members.some(
      (m) =>
        m.email.toLowerCase() === user.email.toLowerCase() &&
        (m.status === 'Active' || m.status === 'Expiring') &&
        m.expires >= today,
    );
  const unitPrice = product ? (member ? product.memberPrice : product.price) : 0;
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
  const purchase = () => {
    if (!signedIn) {
      const target = `${publicView ? '/shop' : '/app/merchandise'}?product=${encodeURIComponent(productId)}&club=${encodeURIComponent(selectedClub)}`;
      navigate(`/login?returnTo=${encodeURIComponent(target)}`);
      return;
    }
    if (!can('shop')) {
      toast(
        'This persona can browse the shop. Switch to a student or club persona to place a demo order.',
      );
      return;
    }
    if (!product || !size || quantity < 1 || quantity > (product.stock[size] || 0)) {
      toast('That size or quantity is no longer available. Choose another option.');
      return;
    }
    if (!agree) {
      toast('Confirm campus pickup and demo checkout to continue.');
      return;
    }
    const refs = Array.from({ length: quantity }, () => uid('ORD'));
    const payment = uid('TX');
    update((d) => {
      const current = d.products.find((p) => p.id === productId);
      if (!current || (current.stock[size] || 0) < quantity) return d;
      const eligible = d.members.some(
        (m) =>
          m.email.toLowerCase() === user.email.toLowerCase() &&
          (m.status === 'Active' || m.status === 'Expiring') &&
          m.expires >= today,
      );
      const amount = eligible ? current.memberPrice : current.price;
      return {
        ...d,
        products: d.products.map((p) =>
          p.id === current.id
            ? { ...p, stock: { ...p.stock, [size]: p.stock[size] - quantity } }
            : p,
        ),
        orders: [
          ...refs.map((id) => ({
            id,
            productId: current.id,
            name: user.name,
            size,
            amount,
            date: today,
          })),
          ...d.orders,
        ],
        transactions: [
          {
            id: payment,
            title: `${current.name} × ${quantity} · ${user.name} (demo)`,
            category: 'Merchandise',
            amount: amount * quantity,
            date: today,
            status: 'Completed',
            createdBy: user.id,
          },
          ...d.transactions,
        ],
      };
    });
    setReceipt({ refs, name: product.name, amount: unitPrice * quantity, size, quantity });
    closeProduct();
    toast('Demo order recorded. Your club inventory and ledger are updated.');
  };
  const content = (
    <div className="sky-shop">
      <div className="shop-breadcrumb">
        <Link to={publicView ? '/' : '/app'}>Skyline</Link>
        <Icon name="ChevronRight" size={13} />
        <span>The campus collection</span>
      </div>
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
          <ProductArt type="Hoodie" color="teal" />
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
      {!publicView && can('manage_orders') && (
        <div className="shop-staff-toggle">
          <Button
            variant="secondary"
            icon={staff ? 'ShoppingBag' : 'Package'}
            onClick={() => setStaff(!staff)}
          >
            {staff ? 'Back to the collection' : 'Inventory & order management'}
          </Button>
        </div>
      )}
      {staff && !publicView && can('manage_orders') ? (
        <InventoryShop />
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
                <article key={p.id} className="sky-shop-product">
                  <button
                    className="sky-shop-product-art"
                    aria-label={`Explore ${p.name}`}
                    onClick={() => openProduct(p.id)}
                  >
                    <ProductArt type={p.type} color={p.color} />
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
                        ? `You save ${money(p.price - p.memberPrice)}`
                        : `Members ${money(p.memberPrice)}`}
                    </span>
                    <button onClick={() => openProduct(p.id)}>
                      Choose your fit <Icon name="ArrowRight" size={14} />
                    </button>
                  </div>
                </article>
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
              <GarmentPreview kind={product.type} color={color} onColorChange={setColor} />
              <p>
                Interactive style preview. Preview colours are illustrative; the stocked colour is{' '}
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
                  {member ? 'Member price applied' : 'Standard price'}
                  {!member && <small>Members pay {money(product.memberPrice)}</small>}
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
                  !size || !(product.stock[size] > 0) || (signedIn && (!agree || !can('shop')))
                }
                onClick={purchase}
              >
                {signedIn && !can('shop')
                  ? 'Browse-only college persona'
                  : signedIn
                    ? `Complete demo order · ${money(unitPrice * quantity)}`
                    : 'Sign in to order'}
              </Button>
              <div className="shop-checkout-note">
                <Icon name="ShieldCheck" size={15} />
                <span>No real charge. Inventory and ledger are updated in this browser demo.</span>
              </div>
            </div>
          </div>
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
          description="Demo order recorded · no real payment taken"
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
            <LinkButton to="/app/my-orders" icon="ShoppingBag">
              View my orders
            </LinkButton>
            <Button variant="secondary" onClick={() => setReceipt(null)}>
              Keep exploring
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
