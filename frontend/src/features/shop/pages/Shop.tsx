import { useEffect, useState } from 'react';
import { hasActiveMembership } from '../../../../../shared/membership.js';
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
import {
  date,
  exportCSV,
  exportInvoicePdf,
  money,
  moneyPdf,
  today,
  uid,
} from '../../../shared/utils/format';
import { useStore } from '../../../app/state/StoreProvider';
import type { OrderStatus, Product, PromoCode, Store } from '../../../shared/types/domain';
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
import { cloudMode } from '../../../shared/api/client';
import { razorpayCheckout } from '../../commerce/api/razorpay';
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
function productImages(product: Product) {
  const gallery = (product.gallery || []).filter(Boolean);
  const primary = product.image || gallery[0] || stockPhotos[product.type] || stockPhotos.Hoodie;
  return [...new Set([primary, ...gallery].filter(Boolean))];
}
function ProductPhoto({ product, src }: { product: Product; src?: string }) {
  const [failed, setFailed] = useState(false);
  const image = src || productImages(product)[0];
  useEffect(() => setFailed(false), [product.id, image]);
  return failed ? (
    <ProductArt type={product.type} color={product.color} />
  ) : (
    <img
      className="shop-product-photo"
      src={image}
      alt={`${product.type} product photograph`}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
async function readImageFile(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Use PNG, JPEG, or WebP images.');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Keep each image under 2 MB.');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
  // Shrink large photos so club snapshots stay within demo payload limits.
  if (dataUrl.length < 120000) return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => reject(new Error('Could not process this image.'));
    img.src = dataUrl;
  });
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
    [activePhoto, setActivePhoto] = useState(0),
    [fit, setFit] = useState(false),
    [height, setHeight] = useState(''),
    [chest, setChest] = useState(''),
    [fitResult, setFitResult] = useState(''),
    [agree, setAgree] = useState(false);
  const canManageOrders = can('manage_orders');
  const canManageInventory = can('manage_inventory');
  // President / treasurer / organizers manage merch here — never the student catalog.
  const showOps = !publicView && (canManageOrders || canManageInventory);
  const [listing, setListing] = useState(false);
  const [listName, setListName] = useState('');
  const [listType, setListType] = useState<'Hoodie' | 'T-shirt' | 'Tote bag' | 'Other'>('T-shirt');
  const [listColor, setListColor] = useState('teal');
  const [listPrice, setListPrice] = useState('799');
  const [listMemberPrice, setListMemberPrice] = useState('649');
  const [listStock, setListStock] = useState('12');
  const [listStockS, setListStockS] = useState('4');
  const [listStockM, setListStockM] = useState('12');
  const [listStockL, setListStockL] = useState('8');
  const [listStockXl, setListStockXl] = useState('4');
  const [listImageUrl, setListImageUrl] = useState('');
  const [listImages, setListImages] = useState<string[]>([]);
  const [readingImages, setReadingImages] = useState(false);
  const [listAgain, setListAgain] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'Hoodie' | 'T-shirt' | 'Tote bag' | 'Other'>('T-shirt');
  const [editColor, setEditColor] = useState('teal');
  const [editPrice, setEditPrice] = useState('799');
  const [editMemberPrice, setEditMemberPrice] = useState('649');
  const [editStockS, setEditStockS] = useState('4');
  const [editStockM, setEditStockM] = useState('12');
  const [editStockL, setEditStockL] = useState('8');
  const [editStockXl, setEditStockXl] = useState('4');
  const [editStockTote, setEditStockTote] = useState('12');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editDelisted, setEditDelisted] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponValue, setCouponValue] = useState('50');
  const [couponType, setCouponType] = useState<'fixed' | 'percent'>('fixed');
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
  const organization = organizations.find((c) => c.id === selectedClub);
  const clubOrders = data.orders;
  const product = data.products.find((p) => p.id === productId);
  const member =
    signedIn &&
    data.members.some(
      (m) => m.email.toLowerCase() === user.email.toLowerCase() && hasActiveMembership(m, today),
    );
  const unitPrice = product ? (member || joinMembership ? product.memberPrice : product.price) : 0;
  const checkoutTotal =
    Math.max(0, unitPrice * quantity - promoDiscount) + (!member && joinMembership ? 500 : 0);
  const filtered = data.products
    .filter(
      (p) =>
        !p.delisted &&
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
    setActivePhoto(0);
    setAgree(false);
    setPreview(false);
    setJoinMembership(false);
    setPromoCode('');
    setPromoDiscount(0);
    setPromoMessage('');
    setCouponCode('');
    setCouponValue('50');
    setCouponType('fixed');
    setError('');
  }, [productId, selectedClub]);
  useEffect(() => {
    const club = params.get('club');
    if (club && organizations.some((c) => c.id === club) && selectedClub !== club) selectClub(club);
    const id = params.get('product');
    if (showOps) {
      setProductId('');
      if (id) setParams({}, { replace: true });
      return;
    }
    if (id) setParams({}, { replace: true });
  }, [params, organizations, selectedClub, selectClub, showOps, setParams]);
  const openProduct = (id: string) => {
    if (showOps) return;
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
      const paid = cloudMode
        ? await razorpayCheckout<ServerReply & { state: Store }>(
            targetClub,
            {
              type: 'orders',
              args: {
                productId,
                size,
                quantity,
                promoCode: promoCode.trim() || undefined,
                joinMembership: !member && joinMembership,
              },
            },
            user,
          )
        : null;
      const reply = paid
        ? { ...paid, patch: paid.state }
        : await clubRequest<ServerReply>(targetClub, '/orders', {
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
  const resetListingForm = () => {
    setError('');
    setListName('');
    setListType('T-shirt');
    setListColor('teal');
    setListPrice('799');
    setListMemberPrice('649');
    setListStock('12');
    setListStockS('4');
    setListStockM('12');
    setListStockL('8');
    setListStockXl('4');
    setListImageUrl('');
    setListImages([]);
  };
  const openListing = () => {
    setListing(true);
    resetListingForm();
  };
  const addListingImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = 3 - listImages.length;
    if (remaining <= 0) {
      setError('You can attach up to three photos per piece.');
      return;
    }
    setReadingImages(true);
    setError('');
    try {
      const chosen = Array.from(files).slice(0, remaining);
      const urls = await Promise.all(chosen.map((file) => readImageFile(file)));
      setListImages((current) => [...current, ...urls].slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this image.');
    } finally {
      setReadingImages(false);
    }
  };
  const createListing = async () => {
    if (!canManageInventory) return;
    setPending(true);
    setError('');
    const price = Number(listPrice);
    const memberPrice = Number(listMemberPrice);
    const stock =
      listType === 'Tote bag'
        ? { 'One size': Math.max(0, Number(listStock) || 0) }
        : {
            S: Math.max(0, Number(listStockS) || 0),
            M: Math.max(0, Number(listStockM) || 0),
            L: Math.max(0, Number(listStockL) || 0),
            XL: Math.max(0, Number(listStockXl) || 0),
          };
    if (Object.values(stock).every((n) => n <= 0)) {
      setError('Add stock for at least one size.');
      setPending(false);
      return;
    }
    const url = listImageUrl.trim();
    const gallery = [...listImages, ...(url ? [url] : [])].slice(0, 3);
    try {
      const reply = await clubRequest<ServerReply & { product?: Product }>(
        selectedClub,
        '/products',
        {
          method: 'POST',
          snapshot: data,
          actor: user,
          body: {
            name: listName.trim(),
            type: listType,
            color: listColor.trim() || 'teal',
            price,
            memberPrice,
            stock,
            image: gallery[0] || '',
            gallery,
          },
        },
      );
      applyServerPatch(selectedClub, reply.patch);
      toast(`${listName.trim()} is live in the collection.`);
      if (listAgain) {
        resetListingForm();
      } else {
        setListing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not list this piece.');
    } finally {
      setPending(false);
    }
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    const standardType = ['Hoodie', 'T-shirt', 'Tote bag'].includes(p.type)
      ? (p.type as 'Hoodie' | 'T-shirt' | 'Tote bag')
      : 'Other';
    setEditType(standardType);
    setEditColor(p.color || 'teal');
    setEditPrice(String(p.price));
    setEditMemberPrice(String(p.memberPrice));
    setEditStockS(String(p.stock.S ?? 0));
    setEditStockM(String(p.stock.M ?? 0));
    setEditStockL(String(p.stock.L ?? 0));
    setEditStockXl(String(p.stock.XL ?? 0));
    setEditStockTote(String(p.stock['One size'] ?? Object.values(p.stock)[0] ?? 12));
    setEditImageUrl('');
    const existingImages = [p.image, ...(p.gallery || [])].filter(Boolean) as string[];
    setEditImages([...new Set(existingImages)].slice(0, 3));
    setEditDelisted(!!p.delisted);
    setEditError('');
  };

  const addEditImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setReadingImages(true);
    setEditError('');
    try {
      const incoming = Array.from(files).slice(0, 3 - editImages.length);
      const dataUrls = await Promise.all(incoming.map(readImageFile));
      setEditImages((current) => [...current, ...dataUrls].slice(0, 3));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not process images.');
    } finally {
      setReadingImages(false);
    }
  };

  const saveEditProduct = async () => {
    if (!editingProduct) return;
    const price = Number(editPrice);
    const memberPrice = Number(editMemberPrice);
    if (!editName.trim()) {
      setEditError('Product name is required.');
      return;
    }
    if (Number.isNaN(price) || price <= 0 || Number.isNaN(memberPrice) || memberPrice <= 0) {
      setEditError('Enter positive numbers for price and member price.');
      return;
    }
    if (memberPrice > price) {
      setEditError('Member price cannot exceed the regular price.');
      return;
    }

    const stock: Record<string, number> =
      editType === 'Tote bag'
        ? { 'One size': Math.max(0, Number(editStockTote) || 0) }
        : {
            S: Math.max(0, Number(editStockS) || 0),
            M: Math.max(0, Number(editStockM) || 0),
            L: Math.max(0, Number(editStockL) || 0),
            XL: Math.max(0, Number(editStockXl) || 0),
          };

    const url = editImageUrl.trim();
    const gallery = [...editImages, ...(url ? [url] : [])].slice(0, 3);
    const typeLabel = editType === 'Other' ? 'Merchandise' : editType;

    const updatedProduct: Product = {
      ...editingProduct,
      name: editName.trim(),
      type: typeLabel,
      color: editColor.trim() || 'teal',
      price,
      memberPrice,
      stock,
      image: gallery[0] || editingProduct.image || '',
      ...(gallery.length ? { gallery } : {}),
      delisted: editDelisted,
    };

    setPending(true);
    setEditError('');
    try {
      try {
        const reply = await clubRequest<ServerReply & { product?: Product }>(
          selectedClub,
          '/products/update',
          {
            method: 'POST',
            snapshot: data,
            actor: user,
            body: {
              id: editingProduct.id,
              name: updatedProduct.name,
              type: editType,
              color: updatedProduct.color,
              price: updatedProduct.price,
              memberPrice: updatedProduct.memberPrice,
              stock,
              image: updatedProduct.image,
              gallery,
              delisted: editDelisted,
            },
          },
        );
        if (reply.patch) applyServerPatch(selectedClub, reply.patch);
      } catch {
        // Fallback to local store update
      }
      update((d) => ({
        ...d,
        products: d.products.map((p) => (p.id === editingProduct.id ? updatedProduct : p)),
      }));
      toast(`${updatedProduct.name} updated.`);
      setEditingProduct(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save product.');
    } finally {
      setPending(false);
    }
  };

  const toggleDelist = async (p: Product) => {
    const nextDelisted = !p.delisted;
    setPending(true);
    try {
      try {
        const reply = await clubRequest<ServerReply & { product?: Product }>(
          selectedClub,
          '/products/update',
          {
            method: 'POST',
            snapshot: data,
            actor: user,
            body: {
              id: p.id,
              delisted: nextDelisted,
            },
          },
        );
        if (reply.patch) applyServerPatch(selectedClub, reply.patch);
      } catch {
        // Fallback
      }
      update((d) => ({
        ...d,
        products: d.products.map((item) =>
          item.id === p.id ? { ...item, delisted: nextDelisted } : item,
        ),
      }));
      toast(
        `${p.name} ${nextDelisted ? 'delisted from public catalog.' : 'relisted to collection.'}`,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update product.');
    } finally {
      setPending(false);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    setPending(true);
    try {
      try {
        const reply = await clubRequest<ServerReply>(selectedClub, '/products/delete', {
          method: 'POST',
          snapshot: data,
          actor: user,
          body: {
            productId: deletingProduct.id,
          },
        });
        if (reply.patch) applyServerPatch(selectedClub, reply.patch);
      } catch {
        // Fallback
      }
      update((d) => ({
        ...d,
        products: d.products.filter((item) => item.id !== deletingProduct.id),
      }));
      toast(`${deletingProduct.name} deleted from collection.`);
      setDeletingProduct(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete product.');
    } finally {
      setPending(false);
    }
  };

  const content = (
    <div className={`sky-shop ${showOps ? 'sky-shop-ops' : ''}`}>
      <div className="shop-breadcrumb">
        <Link to={publicView ? '/' : '/app'}>Skyline</Link>
        <Icon name="ChevronRight" size={13} />
        <span>{showOps ? 'Stock & orders' : 'The campus collection'}</span>
      </div>
      <>
        {showOps ? (
          <header className="sky-shop-heading shop-ops-heading">
            <div>
              <span className="shop-overline">
                {organization?.name?.toUpperCase() || 'CLUB'} · MERCHANDISE DESK
              </span>
              <h1>
                {canManageInventory ? (
                  <>
                    Stock, listings
                    <br />
                    <em>&amp; pickups.</em>
                  </>
                ) : (
                  <>
                    Club orders
                    <br />
                    <em>&amp; pickups.</em>
                  </>
                )}
              </h1>
            </div>
            <p>
              {canManageInventory
                ? 'List pieces, manage inventory, and fulfil campus pickups.'
                : 'Track merchandise orders and update pickup status.'}
            </p>
          </header>
        ) : (
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
        )}
        {!showOps && (
          <>
            <section className="sky-shop-hero">
              <div className="sky-shop-hero-copy">
                <Badge tone="gold">THE EVERYDAY EDIT</Badge>
                <h2>
                  Belonging
                  <br />
                  looks good on you.
                </h2>
                <p>
                  From the first coffee to the last study session. Meet your next campus staple.
                </p>
                <Button
                  icon="ArrowUpRight"
                  onClick={() => {
                    const p =
                      data.products.find((p) => !p.delisted && p.type === 'Hoodie') ||
                      data.products.find((p) => !p.delisted) ||
                      data.products[0];
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
                    data.products.find((p) => !p.delisted && p.type === 'Hoodie') ||
                    data.products.find((p) => !p.delisted) ||
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
      </>
      {showOps && (
        <div className="shop-seller-bar">
          <LinkButton to="/shop" variant="secondary" icon="ShoppingBag">
            Preview public shop
          </LinkButton>
        </div>
      )}
      {showOps ? (
        <>
          <div className="shop-management-actions">
            {canManageInventory && (
              <Button
                icon="Package"
                variant="secondary"
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
            {canManageInventory && (
              <Button icon="Plus" onClick={openListing}>
                New product
              </Button>
            )}
          </div>

          {canManageInventory && (
            <section className="shop-stock-board">
              <div className="shop-stock-board-head">
                <div>
                  <h2>In the collection</h2>
                  <p>Stock, pricing and visibility across campus pickup pieces.</p>
                </div>
              </div>
              {data.products.length ? (
                <div className="shop-stock-grid">
                  {data.products.map((p) => {
                    const total = Object.values(p.stock).reduce((s, n) => s + n, 0);
                    return (
                      <div
                        key={p.id}
                        className={`shop-stock-card ${p.delisted ? 'is-delisted' : ''}`}
                      >
                        <div className="shop-stock-card-body">
                          <ProductPhoto product={p} />
                          <div>
                            <strong>{p.name}</strong>
                            <div className="shop-stock-card-badges">
                              {p.delisted ? (
                                <Badge tone="neutral">Delisted</Badge>
                              ) : (
                                <Badge tone="teal">Live in shop</Badge>
                              )}
                              <Badge tone={total < 5 ? (total === 0 ? 'red' : 'gold') : 'green'}>
                                {total} in stock
                              </Badge>
                            </div>
                            <small>
                              {p.type} · Regular: {money(p.price)} · Member: {money(p.memberPrice)}
                            </small>
                            <span className="shop-stock-sizes">
                              {Object.entries(p.stock)
                                .map(([s, n]) => `${s} ${n}`)
                                .join(' · ') || 'No sizes'}
                            </span>
                          </div>
                        </div>
                        <div className="shop-stock-card-actions">
                          <Button
                            variant="secondary"
                            icon="Pencil"
                            onClick={() => openEditModal(p)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            icon="Package"
                            onClick={() => {
                              setInventory(true);
                              setError('');
                              setInventoryProduct(p.id);
                              setInventorySize(Object.keys(p.stock)[0] || '');
                            }}
                          >
                            Stock
                          </Button>
                          <Button
                            variant="secondary"
                            className="is-delist"
                            icon={p.delisted ? 'Eye' : 'EyeOff'}
                            onClick={() => void toggleDelist(p)}
                          >
                            {p.delisted ? 'Relist' : 'Delist'}
                          </Button>
                          <Button
                            variant="secondary"
                            className="is-delete"
                            icon="Trash2"
                            onClick={() => setDeletingProduct(p)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  title="No pieces listed yet"
                  description="Club admin and treasurer can publish as many items as you need."
                  action={
                    <Button icon="Plus" onClick={openListing}>
                      List something new
                    </Button>
                  }
                />
              )}
            </section>
          )}

          <section className="card table-card shop-ops-card">
            <div className="table-toolbar">
              <h2>Recent pickups ({clubOrders.length})</h2>
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
              {[
                'All pieces',
                ...new Set(data.products.filter((p) => !p.delisted).map((p) => p.type)),
              ].map((c) => (
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
      {product && !fit && !showOps && (
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
                  <ProductPhoto
                    product={product}
                    src={productImages(product)[activePhoto] || productImages(product)[0]}
                  />
                )}
              </div>
              {!preview && productImages(product).length > 1 && (
                <div className="shop-gallery-thumbs" role="list">
                  {productImages(product).map((src, index) => (
                    <button
                      type="button"
                      key={`${product.id}-g-${index}`}
                      className={`shop-gallery-thumb${activePhoto === index ? ' active' : ''}`}
                      aria-label={`Show photo ${index + 1}`}
                      aria-pressed={activePhoto === index}
                      onClick={() => setActivePhoto(index)}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
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
              <div className="shop-coupon-panel">
                <div className="shop-coupon-panel-head">
                  <Icon name="Ticket" size={16} />
                  <strong>Have a coupon?</strong>
                </div>
                <p>Add it here while you view this piece — no separate promos page needed.</p>
                <div className="shop-promo-input">
                  <input
                    aria-label="Coupon code"
                    placeholder="Enter coupon code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  />
                  <Button
                    variant="secondary"
                    disabled={pending || !promoCode.trim()}
                    onClick={quotePromo}
                  >
                    Apply coupon
                  </Button>
                </div>
                {promoMessage && (
                  <p className="shop-promo-message" role="status">
                    {promoMessage}
                  </p>
                )}
                {(data.promos || [])
                  .filter((p) => p.active && (!p.productId || p.productId === product.id))
                  .slice(0, 3)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="shop-coupon-chip"
                      onClick={() => {
                        setPromoCode(p.code);
                        setPromoMessage('');
                        setPromoDiscount(0);
                      }}
                    >
                      {p.code}
                      <small>
                        {p.type === 'percent' ? `${p.value}% off` : `₹${p.value} off`}
                        {p.productId ? ' · this piece' : ''}
                      </small>
                    </button>
                  ))}
              </div>
              {canManageInventory && product && (
                <div className="shop-coupon-create">
                  <div className="shop-coupon-panel-head">
                    <Icon name="Plus" size={16} />
                    <strong>Add a coupon for this piece</strong>
                  </div>
                  <p>Creates a code that only works on {product.name}.</p>
                  <div className="form-two">
                    <Field label="Code">
                      <input
                        value={couponCode}
                        maxLength={24}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="HOODIE50"
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        value={couponType}
                        onChange={(e) => setCouponType(e.target.value as 'fixed' | 'percent')}
                      >
                        <option value="fixed">Fixed ₹ off</option>
                        <option value="percent">Percent off</option>
                      </select>
                    </Field>
                  </div>
                  <Field label={couponType === 'percent' ? 'Percent' : 'Amount (₹)'}>
                    <input
                      type="number"
                      min={1}
                      max={couponType === 'percent' ? 100 : 100000}
                      value={couponValue}
                      onChange={(e) => setCouponValue(e.target.value)}
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    icon="Check"
                    disabled={!couponCode.trim() || Number(couponValue) <= 0}
                    onClick={() => {
                      const code = couponCode.trim().toUpperCase();
                      const value = Number(couponValue);
                      if ((data.promos || []).some((p) => p.code === code)) {
                        toast('That coupon code already exists.');
                        return;
                      }
                      const promo: PromoCode = {
                        id: uid('PROMO'),
                        code,
                        type: couponType,
                        value,
                        active: true,
                        redemptions: 0,
                        maxRedemptions: 100,
                        memberOnly: false,
                        minSubtotal: 0,
                        productId: product.id,
                        description: `${couponType === 'percent' ? `${value}%` : `₹${value}`} off ${product.name}`,
                      };
                      update((d) => ({ ...d, promos: [promo, ...(d.promos || [])] }));
                      setCouponCode('');
                      setPromoCode(code);
                      toast(`Coupon ${code} added for this piece.`);
                    }}
                  >
                    Save coupon on this item
                  </Button>
                </div>
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
                    {cloudMode
                      ? 'I understand this is a Razorpay test payment and I will collect from the Student Union office.'
                      : 'I understand this is demo checkout and I will collect from the Student Union office.'}
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
      {listing && (
        <Modal
          title="New product"
          description="Add a piece to the campus collection. Students can buy it with member prices."
          onClose={() => {
            if (!pending) setListing(false);
          }}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createListing();
            }}
          >
            <Field label="Name">
              <input
                required
                maxLength={80}
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Wear your community"
              />
            </Field>
            <div className="form-two">
              <Field label="Type">
                <select
                  value={listType}
                  onChange={(e) => setListType(e.target.value as typeof listType)}
                >
                  <option value="T-shirt">T-shirt</option>
                  <option value="Hoodie">Hoodie</option>
                  <option value="Tote bag">Tote bag</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Color">
                <input
                  required
                  maxLength={40}
                  value={listColor}
                  onChange={(e) => setListColor(e.target.value)}
                  placeholder="teal"
                />
              </Field>
            </div>
            <div className="form-two">
              <Field label="Price (₹)">
                <input
                  type="number"
                  required
                  min={1}
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                />
              </Field>
              <Field label="Member price (₹)">
                <input
                  type="number"
                  required
                  min={1}
                  value={listMemberPrice}
                  onChange={(e) => setListMemberPrice(e.target.value)}
                />
              </Field>
            </div>
            {listType === 'Tote bag' ? (
              <Field label="Starting stock (one size)" hint="One-size tote inventory.">
                <input
                  type="number"
                  required
                  min={0}
                  value={listStock}
                  onChange={(e) => setListStock(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Starting stock by size" hint="List as many sizes as you have on hand.">
                <div className="shop-list-stock-grid">
                  {(
                    [
                      ['S', listStockS, setListStockS],
                      ['M', listStockM, setListStockM],
                      ['L', listStockL, setListStockL],
                      ['XL', listStockXl, setListStockXl],
                    ] as const
                  ).map(([label, value, setValue]) => (
                    <label key={label}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <Field
              label="Photos"
              hint="Upload up to three images, or paste a URL. First photo is the catalog cover."
            >
              <div className="shop-list-photos">
                {listImages.map((src, index) => (
                  <div className="shop-list-photo-thumb" key={`${src.slice(0, 24)}-${index}`}>
                    <img src={src} alt={`Upload preview ${index + 1}`} />
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() =>
                        setListImages((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ))}
                {listImages.length < 3 && (
                  <label className="shop-image-upload">
                    <Icon name="CloudUpload" size={22} />
                    <span>
                      Upload photo
                      <small>PNG, JPEG, or WebP · under 2 MB</small>
                    </span>
                    <input
                      aria-label="Upload product photos"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      disabled={readingImages || pending}
                      onChange={(e) => {
                        void addListingImages(e.target.files);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <input
                type="url"
                value={listImageUrl}
                onChange={(e) => setListImageUrl(e.target.value)}
                placeholder="Or paste an image URL (optional)"
                style={{ marginTop: 10 }}
              />
            </Field>
            <label className="shop-list-again">
              <input
                type="checkbox"
                checked={listAgain}
                onChange={(e) => setListAgain(e.target.checked)}
              />
              <span>Keep this form open to list another item after publish</span>
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="shop-list-actions">
              <Button
                type="submit"
                disabled={pending || readingImages || !listName.trim()}
                icon="Plus"
              >
                {pending ? 'Listing…' : listAgain ? 'Publish & list another' : 'Publish to shop'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setListing(false)}
              >
                Done
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {editingProduct && (
        <Modal
          title={`Edit product · ${editingProduct.name}`}
          description="Update details, pricing, stock levels, photos, or delist this item."
          onClose={() => {
            if (!pending) setEditingProduct(null);
          }}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveEditProduct();
            }}
          >
            <Field label="Name">
              <input
                required
                maxLength={80}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Product title"
              />
            </Field>
            <div className="form-two">
              <Field label="Type">
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as typeof editType)}
                >
                  <option value="T-shirt">T-shirt</option>
                  <option value="Hoodie">Hoodie</option>
                  <option value="Tote bag">Tote bag</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Color">
                <input
                  required
                  maxLength={40}
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  placeholder="Color"
                />
              </Field>
            </div>
            <div className="form-two">
              <Field label="Price (₹)">
                <input
                  type="number"
                  required
                  min={1}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </Field>
              <Field label="Member price (₹)">
                <input
                  type="number"
                  required
                  min={1}
                  value={editMemberPrice}
                  onChange={(e) => setEditMemberPrice(e.target.value)}
                />
              </Field>
            </div>
            {editType === 'Tote bag' ? (
              <Field label="Stock (one size)" hint="One-size tote inventory.">
                <input
                  type="number"
                  required
                  min={0}
                  value={editStockTote}
                  onChange={(e) => setEditStockTote(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Stock by size" hint="Set available units on hand.">
                <div className="shop-list-stock-grid">
                  {(
                    [
                      ['S', editStockS, setEditStockS],
                      ['M', editStockM, setEditStockM],
                      ['L', editStockL, setEditStockL],
                      ['XL', editStockXl, setEditStockXl],
                    ] as const
                  ).map(([label, value, setValue]) => (
                    <label key={label}>
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Photos" hint="Upload up to three images, or paste an image URL.">
              <div className="shop-list-photos">
                {editImages.map((src, index) => (
                  <div className="shop-list-photo-thumb" key={`${src.slice(0, 24)}-${index}`}>
                    <img src={src} alt={`Upload preview ${index + 1}`} />
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() =>
                        setEditImages((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ))}
                {editImages.length < 3 && (
                  <label className="shop-image-upload">
                    <Icon name="CloudUpload" size={22} />
                    <span>
                      Upload photo
                      <small>PNG, JPEG, or WebP · under 2 MB</small>
                    </span>
                    <input
                      aria-label="Upload product photos"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      disabled={readingImages || pending}
                      onChange={(e) => {
                        void addEditImages(e.target.files);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <input
                type="url"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="Or paste an image URL (optional)"
                style={{ marginTop: 10 }}
              />
            </Field>
            <label className="shop-list-again" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={editDelisted}
                onChange={(e) => setEditDelisted(e.target.checked)}
              />
              <span>Delist this piece (hide from student shop, visible only to club staff)</span>
            </label>
            {editError && (
              <p className="inline-error" role="alert">
                {editError}
              </p>
            )}
            <div className="shop-list-actions">
              <Button
                type="submit"
                disabled={pending || readingImages || !editName.trim()}
                icon="Check"
              >
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setEditingProduct(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {deletingProduct && (
        <Modal
          title="Delete product"
          description={`Are you sure you want to remove "${deletingProduct.name}" from the collection?`}
          onClose={() => {
            if (!pending) setDeletingProduct(null);
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
              This product will be permanently removed from the club's merchandise catalog. Students
              will no longer be able to buy it. Any existing pickup orders will remain in records.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => setDeletingProduct(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon="Trash2"
                disabled={pending}
                onClick={() => void confirmDeleteProduct()}
              >
                {pending ? 'Deleting…' : 'Delete product'}
              </Button>
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
