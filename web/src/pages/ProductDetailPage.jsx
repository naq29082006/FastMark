import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Eye,
  Heart,
  ShoppingBag,
  Star,
  Trash2,
  TrendingUp,
} from 'lucide-react';

import {
  deleteProduct,
  getProductDetail,
} from '../api/catalogApi';
import ProductRemoveDialog from '../components/admin/ProductRemoveDialog';
import { useAuth } from '../context/AuthContext';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { formatDateTimeDetail, formatMoney } from '../utils/format';
import { goBackOr } from '../utils/navigation';
import { keepIfSame } from '../utils/realtimeList';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

function statusBadgeClass(product) {
  if (product?.isDeleted) return 'badge badge-danger';
  if (product?.status === 1) return 'badge badge-success';
  return 'badge badge-neutral';
}

function resolveStatusLabel(product) {
  if (product?.statusLabel) return product.statusLabel;
  if (product?.isDeleted) return 'Đã gỡ';
  return product?.status === 1 ? 'Đang hiện' : 'Đã ẩn';
}

function DetailSkeleton() {
  return (
    <div className="product-detail-layout">
      <div className="skeleton skeleton-card product-detail-hero-card" />
      <div className="skeleton skeleton-card product-detail-panel" />
    </div>
  );
}

function ShopAvatar({ src, name }) {
  const avatarUrl = resolveMediaUrl(src);
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="product-detail-shop-avatar" />;
  }
  return (
    <div className="product-detail-shop-avatar product-detail-shop-avatar--fallback">
      {String(name || 'S').charAt(0).toUpperCase()}
    </div>
  );
}

function ProductStatItem({ icon: Icon, label, value, tone = 'slate' }) {
  return (
    <article className={`product-detail-stat-item product-detail-stat-item--${tone}`}>
      <span className="product-detail-stat-item-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="product-detail-stat-item-body">
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </article>
  );
}

function getVariantSalePrice(variant, product) {
  const base = Number(variant?.price) || 0;
  if (product?.isPromotion && Number(product.discountPercent) > 0) {
    return Math.max(0, Math.round(base * (1 - Number(product.discountPercent) / 100)));
  }
  return base;
}

function resolveVariantImage(variant, product, gallery) {
  const variantImage = resolveMediaUrl(variant?.imageUrl);
  if (variantImage) return variantImage;
  return gallery[0] || resolveMediaUrl(product?.thumbnail) || '';
}

function buildProductStats(product) {
  if (!product) return [];

  return [
    { icon: Eye, label: 'Lượt xem', value: product.viewCount || 0, tone: 'blue' },
    { icon: Heart, label: 'Lượt thích', value: product.likeCount || 0, tone: 'pink' },
    {
      icon: Heart,
      label: 'Tỷ lệ yêu thích',
      value: `${product.favoriteRate || 0}%`,
      tone: 'amber',
    },
    { icon: ShoppingBag, label: 'Đã bán', value: product.soldCount || 0, tone: 'green' },
    {
      icon: ShoppingBag,
      label: 'Đơn hàng',
      value: product.reservationCount || 0,
      tone: 'green',
    },
    {
      icon: TrendingUp,
      label: 'Chuyển đổi giữ hàng',
      value: `${product.conversionRate || 0}%`,
      tone: 'teal',
    },
    {
      icon: Star,
      label: 'Đánh giá trung bình',
      value: `${(product.averageRating || 0).toFixed(1)} ★ (${product.reviewCount || 0})`,
      tone: 'amber',
    },
  ];
}

export default function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeImage, setActiveImage] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeError, setRemoveError] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);

  const loadDetail = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const token = await getIdToken();
        const payload = await getProductDetail(token, productId);
        const nextProduct = payload.data?.product || null;
        setProduct((current) => keepIfSame(current, nextProduct));
        if (!silent) {
          // Đồng bộ realtime thì giữ nguyên biến thể/ảnh người dùng đang xem.
          setSelectedVariantId('');
          setActiveImage(nextProduct?.thumbnail || nextProduct?.thumbnails?.[0] || '');
        }
      } catch (loadError) {
        if (silent) {
          return;
        }
        setError(loadError.message || 'Không tải được chi tiết sản phẩm.');
        setProduct(null);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [getIdToken, productId]
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useAdminRealtimeRefresh(
    'product',
    (payload) => {
      const changedId = String(payload?.productId || payload?.id || '');
      if (changedId && changedId !== String(productId)) {
        return;
      }
      loadDetail({ silent: true });
    },
    { coalesceMs: REALTIME_COALESCE_MS }
  );

  useEffect(() => {
    if (!message) return undefined;
    const timeoutId = setTimeout(() => setMessage(''), 3200);
    return () => clearTimeout(timeoutId);
  }, [message]);

  const gallery = useMemo(() => {
    const urls = product?.thumbnails?.length
      ? product.thumbnails
      : product?.thumbnail
        ? [product.thumbnail]
        : [];
    return urls.filter(Boolean);
  }, [product]);

  const productStats = useMemo(() => buildProductStats(product), [product]);

  const variants = product?.variants || [];

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) || null,
    [variants, selectedVariantId],
  );

  const heroPrice = useMemo(() => {
    if (!product) {
      return { hasPromotion: false, originalLabel: '', saleLabel: '' };
    }

    const hasPromotion = Boolean(product.isPromotion) && Number(product.discountPercent) > 0;

    if (selectedVariant) {
      const originalLabel = formatMoney(selectedVariant.price);
      const saleLabel = formatMoney(getVariantSalePrice(selectedVariant, product));
      return { hasPromotion, originalLabel, saleLabel };
    }

    return {
      hasPromotion,
      originalLabel: product.priceLabel || formatMoney(product.minPrice),
      saleLabel:
        product.promotionPriceLabel ||
        formatMoney(product.promotionMinPrice ?? product.minPrice),
    };
  }, [product, selectedVariant]);

  function handleSelectVariant(variant) {
    if (!variant?.id) return;

    if (selectedVariantId === variant.id) {
      setSelectedVariantId('');
      setActiveImage(product?.thumbnail || product?.thumbnails?.[0] || gallery[0] || '');
      return;
    }

    setSelectedVariantId(variant.id);
    setActiveImage(resolveVariantImage(variant, product, gallery));
  }

  function openRemoveDialog() {
    setRemoveError('');
    setRemoveTarget(product);
  }

  function closeRemoveDialog() {
    if (removeLoading) return;
    setRemoveTarget(null);
    setRemoveError('');
  }

  async function confirmRemoveProduct(reason) {
    if (!removeTarget?.id) return;
    setRemoveLoading(true);
    setRemoveError('');
    try {
      const token = await getIdToken();
      await deleteProduct(token, removeTarget.id, { reason });
      setMessage('Đã gỡ sản phẩm và gửi thông báo cho shop.');
      closeRemoveDialog();
      await loadDetail();
    } catch (actionError) {
      setRemoveError(actionError.message || 'Không gỡ được sản phẩm.');
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <div className="admin-detail-page product-detail-page">
      <header className="admin-detail-toolbar product-detail-toolbar no-print">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => goBackOr(navigate, '/products')}
        >
          ← Quay lại
        </button>
        <div className="header-actions">
          {!product?.isDeleted ? (
            <button
              type="button"
              className="danger-btn product-detail-delete-btn"
              disabled={loading || removeLoading || !product}
              onClick={openRemoveDialog}
            >
              <Trash2 size={16} aria-hidden="true" />
              Xóa sản phẩm
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {message ? <div className="snackbar">{message}</div> : null}

      {loading ? <DetailSkeleton /> : null}

      {!loading && !product ? (
        <section className="table-card">
          <p>Không tìm thấy sản phẩm.</p>
          <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/products')}>
            Quay lại
          </button>
        </section>
      ) : null}

      {!loading && product ? (
        <div className="product-detail-layout">
          <section className="product-detail-hero-card">
            <div className="product-detail-hero-topbar">
              <span className="product-detail-card-id" title={product.id}>
                ID: <code>{product.id}</code>
              </span>
              <span className={statusBadgeClass(product)}>{resolveStatusLabel(product)}</span>
            </div>

            <div className="product-detail-gallery">
              <div className="product-detail-main-image-wrap">
                {activeImage ? (
                  <img src={activeImage} alt={product.productName} className="product-detail-main-image" />
                ) : (
                  <div className="product-detail-main-image product-detail-main-image--empty">SP</div>
                )}
              </div>
              {gallery.length > 1 ? (
                <div className="product-detail-thumbs">
                  {gallery.slice(0, 4).map((url) => (
                    <button
                      key={url}
                      type="button"
                      className={activeImage === url ? 'active' : undefined}
                      onClick={() => setActiveImage(url)}
                    >
                      <img src={url} alt="" />
                    </button>
                  ))}
                  {gallery.length > 4 ? (
                    <span className="product-detail-thumbs-more">+{gallery.length - 4}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="product-detail-hero-body">
              <div className="product-detail-shop-head">
                <ShopAvatar
                  src={product.shopAvatar || product.avatar}
                  name={product.shopName}
                />
                <div className="product-detail-shop-head-text">
                  {product.shopId ? (
                    <Link to={`/shops/${product.shopId}`} className="product-detail-shop-link">
                      {product.shopName || 'Gian hàng'}
                    </Link>
                  ) : (
                    <span className="product-detail-shop-name">{product.shopName || '—'}</span>
                  )}
                  {product.shopUsername ? (
                    <span className="product-detail-shop-handle">@{product.shopUsername}</span>
                  ) : null}
                </div>
              </div>

              <div className="product-detail-hero-fields">
                <div className="product-detail-field">
                  <span className="product-detail-field-label">Giá bán</span>
                  <div className="product-detail-price-block">
                    {heroPrice.hasPromotion ? (
                      <>
                        <div className="product-detail-price-promo-row">
                          <span className="product-price-original">{heroPrice.originalLabel}</span>
                          <span className="badge badge-warning">
                            {product.discountLabel || `−${product.discountPercent}%`}
                          </span>
                        </div>
                        <strong className="product-detail-price-new">{heroPrice.saleLabel}</strong>
                      </>
                    ) : (
                      <strong className="product-detail-price-new">
                        {selectedVariant
                          ? formatMoney(selectedVariant.price)
                          : product.priceLabel || formatMoney(product.minPrice)}
                      </strong>
                    )}
                  </div>
                </div>

                {variants.length > 0 ? (
                  <div className="product-detail-field product-detail-field--block">
                    <span className="product-detail-field-label">Biến thể</span>
                    <div className="product-detail-variant-list">
                      {variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          className={
                            selectedVariantId === variant.id
                              ? 'product-detail-variant-chip active'
                              : 'product-detail-variant-chip'
                          }
                          onClick={() => handleSelectVariant(variant)}
                        >
                          {variant.variantName || 'Phân loại'}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="product-detail-field">
                  <span className="product-detail-field-label">Đơn vị tính</span>
                  <span className="product-detail-field-value">{product.donVi || '—'}</span>
                </div>

                <div className="product-detail-field product-detail-field--block">
                  <span className="product-detail-field-label">Mô tả sản phẩm</span>
                  <div className="product-detail-description">
                    {product.description ? (
                      product.description.split('\n').map((line, index) => (
                        <p key={`${index}-${line.slice(0, 12)}`}>{line}</p>
                      ))
                    ) : (
                      <p className="muted">Chưa có mô tả.</p>
                    )}
                  </div>
                </div>

                <div className="product-detail-field">
                  <span className="product-detail-field-label">Danh mục</span>
                  <span className="product-detail-field-value">{product.categoryName || '—'}</span>
                </div>

                <div className="product-detail-field">
                  <span className="product-detail-field-label">Ngày tạo</span>
                  <span className="product-detail-field-value">
                    {formatDateTimeDetail(product.createdAt) || '—'}
                  </span>
                </div>

                <div className="product-detail-field">
                  <span className="product-detail-field-label">Ngày cập nhật cuối</span>
                  <span className="product-detail-field-value">
                    {formatDateTimeDetail(product.updatedAt) || '—'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <article className="product-detail-panel">
            <h2>Thống kê</h2>
            <div className="product-detail-stats-grid">
              {productStats.map((item) => (
                <ProductStatItem
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  tone={item.tone}
                />
              ))}
            </div>
          </article>
        </div>
      ) : null}

      <ProductRemoveDialog
        product={removeTarget}
        open={Boolean(removeTarget)}
        loading={removeLoading}
        error={removeError}
        onClose={closeRemoveDialog}
        onConfirm={confirmRemoveProduct}
      />
    </div>
  );
}
