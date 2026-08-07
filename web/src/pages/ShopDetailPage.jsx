import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  Heart,
  Layers,
  Lock,
  MapPin,
  Package,
  Scale,
  ShoppingBag,
  Star,
  Unlock,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import {
  blockShop,
  getShopDetail,
  getShopFollowers,
  getShopFollowing,
  getShopHistory,
  unblockShop,
} from '../api/catalogApi';
import {
  ActivityHistorySection,
  ACCOUNT_MAIN_TABS,
  SHOP_DETAIL_HISTORY_TABS,
} from './AccountDetailPage';
import { getAccountFinance } from '../api/accountApi';
import AdminDetailTabs from '../components/admin/AdminDetailTabs';
import FollowListDialog, { FollowStatButton } from '../components/admin/FollowListDialog';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatPrice } from '../utils/format';
import { goBackOr } from '../utils/navigation';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
}

function formatJoinDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN');
}

function subscriptionDaysLeft(end) {
  if (!end) return 0;
  const endMs = new Date(end).getTime();
  return Math.max(0, Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24)));
}

function subscriptionRemainingPercent(start, end) {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const now = Date.now();
  if (endMs <= startMs) return 0;
  if (now >= endMs) return 0;
  if (now <= startMs) return 100;
  return Math.round(((endMs - now) / (endMs - startMs)) * 100);
}

function DetailSkeleton() {
  return (
    <div className="shop-detail-v2-skeleton">
      <div className="skeleton skeleton-card shop-detail-hero-skeleton" />
      <div className="shop-detail-stat-skeleton">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  );
}

function VerifyDocCard({ label, url, onPreview }) {
  const src = resolveMediaUrl(url);
  if (!src) {
    return (
      <article className="seller-verify-doc-card empty">
        <div className="seller-verify-doc-preview placeholder">{label}</div>
        <span>{label}</span>
      </article>
    );
  }

  return (
    <article className="seller-verify-doc-card">
      <button
        type="button"
        className="seller-verify-doc-preview shop-detail-doc-preview-btn"
        onClick={() => onPreview?.({ url: src, label })}
      >
        <img src={src} alt={label} />
      </button>
      <span>{label}</span>
    </article>
  );
}

function ImagePreviewModal({ imageUrl, label, onClose }) {
  if (!imageUrl) {
    return null;
  }

  return (
    <div className="image-preview-overlay" role="presentation" onClick={onClose}>
      <div className="image-preview-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="ghost-btn image-preview-close" onClick={onClose}>
          Đóng
        </button>
        <img src={imageUrl} alt={label || 'Ảnh xác minh phóng to'} className="image-preview-full" />
      </div>
    </div>
  );
}

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [followDialog, setFollowDialog] = useState('');
  const [finance, setFinance] = useState(null);
  const [mainTab, setMainTab] = useState('overview');
  const [historyTab, setHistoryTab] = useState('products');

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await getShopDetail(token, shopId);
      const shopData = payload.data?.shop || null;
      setShop(shopData);
      if (shopData?.owner?.id) {
        const financePayload = await getAccountFinance(token, shopData.owner.id).catch(() => null);
        setFinance(financePayload?.data?.finance || null);
      } else {
        setFinance(null);
      }
    } catch (loadError) {
      setError(loadError.message || 'Không tải được chi tiết gian hàng.');
      setShop(null);
      setFinance(null);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, shopId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function toggleLock() {
    if (!shop) return;
    if (shop.status === 1 && !confirmLock) {
      setConfirmLock(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token = await getIdToken();
      if (shop.status === 1) {
        await blockShop(token, shop.id);
      } else {
        await unblockShop(token, shop.id);
      }
      setConfirmLock(false);
      await loadDetail();
    } catch (actionError) {
      setError(actionError.message || 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  }

  const mapEmbedUrl = useMemo(() => {
    const lat = Number(shop?.latitude);
    const lng = Number(shop?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    }
    const address = shop?.addressHeThong || shop?.address;
    if (address) {
      return `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`;
    }
    return '';
  }, [shop?.latitude, shop?.longitude, shop?.addressHeThong, shop?.address]);

  const mapLinkUrl = useMemo(() => {
    if (shop?.latitude && shop?.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
    }
    if (shop?.addressHeThong || shop?.address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        shop.addressHeThong || shop.address
      )}`;
    }
    return '';
  }, [shop]);

  const loadFollowPage = useCallback(
    async (params) => {
      const token = await getIdToken();
      if (followDialog === 'following') {
        return getShopFollowing(token, shopId, params);
      }
      if (followDialog === 'followers') {
        return getShopFollowers(token, shopId, params);
      }
      return { data: { items: [], pagination: null } };
    },
    [followDialog, getIdToken, shopId]
  );

  const subscriptionRemaining = subscriptionRemainingPercent(
    shop?.subscriptionStartAt,
    shop?.subscriptionExpiresAt
  );
  const subscriptionDaysRemaining = subscriptionDaysLeft(shop?.subscriptionExpiresAt);

  if (loading) {
    return (
      <div className="page shop-detail-page shop-detail-page-v2">
        <DetailSkeleton />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="page shop-detail-page shop-detail-page-v2">
        <p className="error-banner">{error || 'Không tìm thấy gian hàng.'}</p>
        <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/sellers')}>
          ← Quay lại
        </button>
      </div>
    );
  }

  const owner = shop.owner;
  const hoursLabel =
    shop.openTime || shop.closeTime
      ? `${shop.openTime || '—'} – ${shop.closeTime || '—'}`
      : 'Chưa cấu hình';

  function openWalletHistory() {
    setMainTab('history');
    setHistoryTab('wallet');
  }

  const statCards = [
    {
      label: 'Tổng doanh thu',
      value: formatPrice(shop.totalRevenue || 0),
      hint: 'Từ đơn hoàn thành',
      icon: Wallet,
      tone: 'amber',
    },
    {
      label: 'Tổng sản phẩm',
      value: shop.totalProducts ?? 0,
      icon: Package,
      tone: 'blue',
    },
    {
      label: 'Tổng lượt xem tym',
      value: shop.totalTymViews ?? 0,
      icon: Eye,
      tone: 'blue',
    },
    {
      label: 'Tổng tym',
      value: shop.totalTym ?? 0,
      icon: Heart,
      tone: 'purple',
    },
    {
      label: 'Tổng đơn',
      value: shop.totalOrders ?? 0,
      icon: ShoppingBag,
      tone: 'green',
    },
    {
      label: 'Tổng đơn hoàn thành',
      value: shop.totalCompletedOrders ?? shop.completedOrders ?? 0,
      icon: CheckCircle2,
      tone: 'green',
    },
    {
      label: 'Tổng đã hủy',
      value: shop.totalCancelledOrders ?? 0,
      icon: XCircle,
      tone: 'amber',
    },
    {
      label: 'Tổng tranh chấp',
      value: shop.totalDisputes ?? 0,
      icon: Scale,
      tone: 'red',
    },
    {
      label: 'Đánh giá',
      value: `${Number(shop.averageRating || 0).toFixed(1)} ★`,
      hint: `${shop.totalReviews || 0} lượt đánh giá`,
      icon: Star,
      tone: 'green',
    },
    {
      label: 'Báo cáo bị nhận gần đây',
      value: shop.recentReportCount ?? shop.reports?.length ?? 0,
      hint: '30 ngày qua',
      icon: AlertTriangle,
      tone: 'red',
    },
  ];

  return (
    <div className="admin-detail-page shop-detail-page shop-detail-page-v2">
      <header className="admin-detail-toolbar">
        <button type="button" className="ghost-btn" onClick={() => goBackOr(navigate, '/sellers')}>
          ← Quay lại
        </button>
        <div className="header-actions">
          <button type="button" className="ghost-btn" onClick={loadDetail} disabled={busy}>
            Làm mới
          </button>
          <button
            type="button"
            className={shop.status === 1 ? 'danger-btn' : 'approve-btn'}
            onClick={toggleLock}
            disabled={busy}
          >
            {shop.status === 1 ? (
              <>
                <Lock size={16} aria-hidden="true" /> Khóa gian hàng
              </>
            ) : (
              <>
                <Unlock size={16} aria-hidden="true" /> Mở khóa
              </>
            )}
          </button>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="shop-detail-hero">
        <span className={`shop-detail-hero-status ${statusBadgeClass(shop.status)}`}>
          {shop.statusLabel || (shop.status === 1 ? 'Hoạt động' : 'Đã khóa')}
        </span>
        <div className="shop-detail-hero-content">
          {shop.avatar ? (
            <img src={shop.avatar} alt="" className="shop-detail-hero-avatar" />
          ) : (
            <div className="shop-detail-hero-avatar placeholder">
              {(shop.shopName || shop.shopUsername || 'S').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="shop-detail-hero-main">
            <h1>{shop.shopName || 'Gian hàng'}</h1>
            <p className="shop-detail-hero-handle">@{shop.shopUsername || ''}</p>
            <p className="shop-detail-hero-meta">
              <MapPin size={14} aria-hidden="true" />
              {shop.addressHeThong || shop.address || 'Chưa có địa chỉ'}
              <span className="shop-detail-hero-meta-sep">|</span>
              <CalendarDays size={14} aria-hidden="true" />
              Tham gia từ {formatJoinDate(shop.createdAt)}
            </p>
            <div className="shop-detail-hero-extra">
              {shop.categoryName ? (
                <span className="shop-detail-hero-extra-item">
                  <Layers size={14} aria-hidden="true" />
                  <span>Danh mục:</span>
                  <span className="shop-detail-tag">{shop.categoryName}</span>
                </span>
              ) : null}
              <span className="shop-detail-hero-extra-item">
                <Clock size={14} aria-hidden="true" />
                <span>Giờ mở cửa:</span>
                <strong>{hoursLabel}</strong>
                <span className="badge badge-neutral shop-detail-open-badge">{shop.isOpenLabel}</span>
              </span>
            </div>
            <div className="shop-detail-hero-extra shop-detail-hero-follow-row">
              <FollowStatButton
                icon={UserPlus}
                label="Đang theo dõi"
                count={shop.followingCount || 0}
                onClick={() => setFollowDialog('following')}
              />
              <FollowStatButton
                icon={Users}
                label="Đã theo dõi"
                count={shop.followersCount || 0}
                onClick={() => setFollowDialog('followers')}
              />
            </div>
            {shop.subscriptionActive && shop.subscriptionPlan ? (
              <div className="shop-detail-hero-subscription">
                <div className="shop-detail-hero-subscription-head">
                  <span className="shop-detail-hero-subscription-label">
                    <Crown size={14} aria-hidden="true" />
                    {shop.subscriptionPlan}
                  </span>
                  <span className="shop-detail-hero-subscription-meta">
                    Còn <strong>{subscriptionDaysRemaining}</strong> ngày · Hết hạn{' '}
                    {formatJoinDate(shop.subscriptionExpiresAt)}
                  </span>
                </div>
                <div className="shop-detail-hero-subscription-track" aria-hidden="true">
                  <div
                    className="shop-detail-hero-subscription-bar"
                    style={{ width: `${subscriptionRemaining}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="account-detail-main-section">
        <AdminDetailTabs
          tabs={ACCOUNT_MAIN_TABS}
          activeTab={mainTab}
          onChange={setMainTab}
          variant="underline"
        />

        <div className="account-detail-main-tab-body">
          {mainTab === 'overview' ? (
            <div className="account-detail-overview-tab">
              <section className="shop-detail-stat-grid shop-detail-overview-stats">
                {statCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <article key={card.label} className={`shop-detail-stat-card tone-${card.tone}`}>
                      <div className="shop-detail-stat-icon">
                        <Icon size={22} aria-hidden="true" />
                      </div>
                      <div>
                        <span className="shop-detail-stat-label">{card.label}</span>
                        <strong className="shop-detail-stat-value">{card.value}</strong>
                        {card.hint ? <em className="shop-detail-stat-hint">{card.hint}</em> : null}
                      </div>
                    </article>
                  );
                })}
              </section>

              <div className="shop-detail-overview-layout">
                <div className="shop-detail-overview-main">
                  <article className="shop-detail-panel shop-detail-info-panel shop-detail-info-panel-compact">
                    <div className="shop-detail-panel-head">
                      <h3>Thông tin gian hàng</h3>
                    </div>
                    <div className="shop-detail-info-split">
                      <dl className="shop-detail-dl">
                        <div><dt>Tên gian hàng</dt><dd>{shop.shopName || '—'}</dd></div>
                        <div><dt>Username</dt><dd>@{shop.shopUsername || '—'}</dd></div>
                        <div className="shop-detail-address-row">
                          <dt>Địa chỉ</dt>
                          <dd title={shop.addressHeThong || shop.address || ''}>
                            {shop.addressHeThong || shop.address || '—'}
                          </dd>
                        </div>
                        <div><dt>Số điện thoại</dt><dd>{shop.phone || '—'}</dd></div>
                        <div>
                          <dt>Giờ mở cửa</dt>
                          <dd className="shop-detail-hours-dd">
                            <span>{hoursLabel}</span>
                            {shop.isOpenLabel ? (
                              <span className="badge badge-neutral shop-detail-open-badge">{shop.isOpenLabel}</span>
                            ) : null}
                          </dd>
                        </div>
                        <div><dt>Mô tả</dt><dd>{shop.description || 'Chưa có mô tả.'}</dd></div>
                        <div><dt>Ngày tạo</dt><dd>{formatDate(shop.createdAt)}</dd></div>
                      </dl>

                      <div className="shop-detail-info-verify shop-detail-info-verify-compact">
                        <div className="shop-detail-verify-head">
                          <h4>Xác minh người bán hàng</h4>
                          <span className={shop.isVerified ? 'badge badge-success' : 'badge badge-warning'}>
                            {shop.verification?.statusLabel || (shop.isVerified ? 'Đã xác minh' : 'Chưa xác minh')}
                          </span>
                        </div>
                        <div className="seller-verify-doc-grid shop-detail-verify-doc-grid">
                          <VerifyDocCard
                            label="Mặt trước"
                            url={shop.verification?.cccdFrontImage}
                            onPreview={setPreviewImage}
                          />
                          <VerifyDocCard
                            label="Mặt sau"
                            url={shop.verification?.cccdBackImage}
                            onPreview={setPreviewImage}
                          />
                          <VerifyDocCard
                            label="Selfie"
                            url={shop.verification?.selfieImage}
                            onPreview={setPreviewImage}
                          />
                          <VerifyDocCard
                            label="Giấy tờ kinh doanh"
                            url={shop.verification?.businessImage}
                            onPreview={setPreviewImage}
                          />
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="shop-detail-panel shop-detail-overview-map-panel">
                    <div className="shop-detail-panel-head shop-detail-map-panel-head">
                      <h3>Vị trí gian hàng</h3>
                      {mapLinkUrl ? (
                        <a
                          className="detail-btn shop-detail-map-link shop-detail-map-link-head"
                          href={mapLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Xem trên Google Maps
                        </a>
                      ) : null}
                    </div>
                    {(shop.addressHeThong || shop.address) ? (
                      <p className="shop-detail-map-address">
                        <MapPin size={14} aria-hidden="true" />
                        {shop.addressHeThong || shop.address}
                      </p>
                    ) : null}
                    <div className="shop-detail-map-wrap">
                      {mapEmbedUrl ? (
                        <iframe
                          title="Bản đồ gian hàng"
                          className="shop-detail-map"
                          src={mapEmbedUrl}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : (
                        <div className="shop-detail-map-fallback">
                          <MapPin size={32} aria-hidden="true" />
                          <p>Chưa có tọa độ GPS.</p>
                        </div>
                      )}
                    </div>
                  </article>
                </div>

                <div className="account-detail-overview-cards shop-detail-overview-cards">
                <article className="shop-detail-panel account-detail-overview-card">
                  <div className="shop-detail-panel-head">
                    <h3>Chủ gian hàng</h3>
                  </div>
                  {owner ? (
                    <>
                      <div className="shop-detail-owner">
                        {owner.avatar ? (
                          <img src={owner.avatar} alt="" className="shop-detail-owner-avatar" />
                        ) : (
                          <div className="shop-detail-owner-avatar placeholder">
                            {(owner.fullName || owner.userName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <strong>{owner.fullName || owner.userName || ''}</strong>
                          <span className="shop-detail-owner-handle">
                            {owner.userName ? `@${owner.userName}` : '—'}
                          </span>
                        </div>
                      </div>
                      <dl className="shop-detail-dl compact account-detail-overview-card-body">
                        <div><dt>Email</dt><dd>{owner.email || '—'}</dd></div>
                        <div><dt>Số điện thoại</dt><dd>{owner.phone || '—'}</dd></div>
                      </dl>
                      <Link className="detail-btn shop-detail-side-actions" to={`/accounts/${owner.id}`}>
                        Xem chi tiết người dùng
                      </Link>
                    </>
                  ) : (
                    <p className="muted account-detail-overview-card-body">Không có thông tin chủ shop.</p>
                  )}
                </article>

                <article className="shop-detail-panel account-wallet-panel account-detail-overview-card">
                  <div className="shop-detail-panel-head">
                    <h3>Ví tiền</h3>
                  </div>
                  <div className="account-detail-overview-card-body">
                    <div className="account-wallet-balance-block">
                      <p className="account-wallet-balance-label">Số dư hiện tại</p>
                      <p className="account-wallet-balance-value">
                        {formatPrice(finance?.walletBalance ?? shop.walletBalance ?? 0)}
                      </p>
                    </div>
                    <div className="account-wallet-stats account-wallet-stats-stacked">
                      <div>
                        <span>Tổng nạp</span>
                        <strong>{formatPrice(finance?.totalTopup || 0)}</strong>
                      </div>
                      <div>
                        <span>Tổng rút</span>
                        <strong>{formatPrice(finance?.totalWithdrawal || 0)}</strong>
                      </div>
                      <div>
                        <span>Chờ duyệt rút</span>
                        <strong>{formatPrice(finance?.pendingWithdrawTotal || 0)}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="detail-btn account-wallet-detail-btn"
                    onClick={openWalletHistory}
                  >
                    Xem chi tiết ví
                  </button>
                </article>
                </div>
              </div>
            </div>
          ) : (
            <ActivityHistorySection
              entityId={shop.id}
              getIdToken={getIdToken}
              tabs={SHOP_DETAIL_HISTORY_TABS}
              loadHistory={getShopHistory}
              tabVariant="underline"
              panelClassName="account-history-nested shop-detail-history-panel"
              hideTitle
              activeTab={historyTab}
              onTabChange={setHistoryTab}
            />
          )}
        </div>
      </section>

      {previewImage ? (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          label={previewImage.label}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}

      <FollowListDialog
        open={Boolean(followDialog)}
        type={followDialog}
        entityLabel={shop ? `${shop.shopName || ''} · @${shop.shopUsername || ''}` : ''}
        loadPage={loadFollowPage}
        onClose={() => setFollowDialog('')}
      />

      {confirmLock ? (
        <div className="dialog-overlay" role="presentation" onClick={() => !busy && setConfirmLock(false)}>
          <div className="dialog-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>Khóa gian hàng</h3>
            <p>
              Gian hàng sẽ bị khóa: không hiển thị bài đăng, mọi đơn đang treo sẽ hủy và hoàn cọc
              cho người mua. Tài khoản chủ shop vẫn dùng được các tính năng khác.
            </p>
            <div className="dialog-actions">
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => setConfirmLock(false)}>
                Huỷ
              </button>
              <button type="button" className="danger-btn" disabled={busy} onClick={toggleLock}>
                {busy ? 'Đang xử lý...' : 'Khóa gian hàng'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
