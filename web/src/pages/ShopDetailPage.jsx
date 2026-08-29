import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  Heart,
  Lock,
  LockOpen,
  MapPin,
  Package,
  Scale,
  ShoppingBag,
  Star,
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
import { useAdminTopbar } from '../admin/context/AdminTopbarContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTimeDetail, formatPrice } from '../utils/format';
import PreviewableImage, { VerifyDocCard } from '../components/PreviewableImage';

function statusBadgeClass(status) {
  return status === 1 ? 'badge badge-success' : 'badge badge-danger';
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

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const { getIdToken } = useAuth();
  const { setTrail, clearTrail } = useAdminTopbar();

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
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
      setConfirmUnlock(false);
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

  const shopDisplayName =
    shop?.shopName || shop?.shopUsername || (loading ? '…' : 'Chi tiết');

  useEffect(() => {
    setTrail([
      { label: 'Người bán', to: '/sellers' },
      { label: shopDisplayName },
    ]);
    return () => clearTrail();
  }, [shopDisplayName, setTrail, clearTrail]);

  const owner = shop?.owner;
  const hoursLabel =
    shop?.openTime || shop?.closeTime
      ? `${shop.openTime || '—'} – ${shop.closeTime || '—'}`
      : 'Chưa cấu hình';
  const isShopActive = shop?.status === 1;

  function openWalletHistory() {
    setMainTab('history');
    setHistoryTab('wallet');
  }

  const statCards = useMemo(() => {
    if (!shop) return [];
    return [
    {
      label: 'Tổng doanh thu',
      value: formatPrice(shop.totalRevenue || 0),
      hint: 'Từ đơn hoàn thành',
      icon: Wallet,
      tone: 'amber',
    },
    {
      label: 'Tổng sản phẩm',
      value: shop.tongSP ?? 0,
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
      value: `${Number(shop.diemTB || 0).toFixed(1)} ★`,
      hint: `${shop.tongDG || 0} lượt đánh giá`,
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
  }, [shop]);

  return (
    <div className="admin-detail-page account-detail-page account-detail-page-v2 shop-detail-page shop-detail-page-v2">
      {error ? <p className="error-banner">{error}</p> : null}

      {loading ? <DetailSkeleton /> : null}

      {!loading && shop ? (
        <>
          <section className="shop-detail-hero">
            <button
              type="button"
              className={
                isShopActive
                  ? 'account-hero-lock-btn account-hero-lock-btn--corner account-hero-lock-btn--lock'
                  : 'account-hero-lock-btn account-hero-lock-btn--corner account-hero-lock-btn--unlock'
              }
              title={isShopActive ? 'Khóa gian hàng' : 'Mở khóa gian hàng'}
              aria-label={isShopActive ? 'Khóa gian hàng' : 'Mở khóa gian hàng'}
              disabled={busy}
              onClick={() => {
                if (isShopActive) {
                  setConfirmLock(true);
                } else {
                  setConfirmUnlock(true);
                }
              }}
            >
              {isShopActive ? (
                <Lock size={18} aria-hidden="true" />
              ) : (
                <LockOpen size={18} aria-hidden="true" />
              )}
            </button>
            <div className="shop-detail-hero-content account-detail-hero-content">
              <div className="account-detail-hero-aside">
                <PreviewableImage
                  src={shop.avatar}
                  alt={shop.shopName || 'Gian hàng'}
                  width={160}
                  height={160}
                  shape="circle"
                  fallbackLetter={shop.shopName || shop.shopUsername || 'S'}
                  wrapperClassName="shop-detail-hero-avatar-wrap"
                  className="shop-detail-hero-avatar"
                />
              </div>
              <div className="shop-detail-hero-main">
                <div className="shop-detail-hero-title-row">
                  <h1>{shop.shopName || 'Gian hàng'}</h1>
                  <span className={statusBadgeClass(shop.status)}>
                    {shop.statusLabel || (isShopActive ? 'Hoạt động' : 'Đã khóa')}
                  </span>
                </div>
                <p className="shop-detail-hero-handle">@{shop.shopUsername || '—'}</p>
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
                    count={shop.soNguoiTheo || 0}
                    onClick={() => setFollowDialog('followers')}
                  />
                </div>
                <div className="account-detail-hero-meta-lines">
                  <p className="account-detail-hero-meta-line">
                    <CalendarDays size={14} aria-hidden="true" />
                    <span>
                      Tham gia từ:{' '}
                      <strong>{formatDateTimeDetail(shop.createdAt) || '—'}</strong>
                    </span>
                  </p>
                  {owner?.lastActiveAt ? (
                    <p className="account-detail-hero-meta-line">
                      <Clock size={14} aria-hidden="true" />
                      <span>
                        Lần hoạt động cuối (chủ shop):{' '}
                        <strong>{formatDateTimeDetail(owner.lastActiveAt) || '—'}</strong>
                      </span>
                    </p>
                  ) : null}
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
                        {formatDate(shop.subscriptionExpiresAt) || '—'}
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
              <section className="shop-detail-stat-grid account-detail-overview-stats">
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

              <div className="account-detail-overview-cards">
                <article className="shop-detail-panel shop-detail-info-panel shop-detail-info-panel-compact account-detail-overview-card">
                  <div className="shop-detail-panel-head">
                    <h3>Thông tin gian hàng</h3>
                  </div>
                  <dl className="shop-detail-dl account-detail-user-dl">
                    <div>
                      <dt>ID gian hàng</dt>
                      <dd>{shop.id || '—'}</dd>
                    </div>
                    <div>
                      <dt>Tên gian hàng</dt>
                      <dd>{shop.shopName || '—'}</dd>
                    </div>
                    <div>
                      <dt>Username</dt>
                      <dd>@{shop.shopUsername || '—'}</dd>
                    </div>
                    <div>
                      <dt>Địa chỉ</dt>
                      <dd title={shop.addressHeThong || shop.address || ''}>
                        {shop.addressHeThong || shop.address || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>Số điện thoại</dt>
                      <dd>{shop.phone || '—'}</dd>
                    </div>
                    <div>
                      <dt>Danh mục</dt>
                      <dd>{shop.categoryName || '—'}</dd>
                    </div>
                    <div>
                      <dt>Giờ mở cửa</dt>
                      <dd className="shop-detail-hours-dd">
                        <span>{hoursLabel}</span>
                        {shop.isOpenLabel ? (
                          <span className="badge badge-neutral shop-detail-open-badge">{shop.isOpenLabel}</span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt>Tạo lúc</dt>
                      <dd>{formatDate(shop.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Cập nhật</dt>
                      <dd>{formatDate(shop.updatedAt)}</dd>
                    </div>
                  </dl>
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

                <article className="shop-detail-panel account-detail-overview-card">
                  <div className="shop-detail-panel-head">
                    <h3>Chủ gian hàng</h3>
                  </div>
                  {owner ? (
                    <>
                      <div className="shop-detail-owner">
                        <PreviewableImage
                          src={owner.avatar}
                          alt={owner.fullName || owner.userName || 'Chủ shop'}
                          width={56}
                          height={56}
                          shape="circle"
                          fallbackLetter={owner.fullName || owner.userName || 'U'}
                          className="shop-detail-owner-avatar"
                        />
                        <div>
                          <strong>{owner.fullName || owner.userName || ''}</strong>
                          <span className="shop-detail-owner-handle">
                            {owner.userName ? `@${owner.userName}` : '—'}
                          </span>
                        </div>
                      </div>
                      <dl className="shop-detail-dl compact account-detail-overview-card-body">
                        <div>
                          <dt>Email</dt>
                          <dd>{owner.email || '—'}</dd>
                        </div>
                        <div>
                          <dt>Số điện thoại</dt>
                          <dd>{owner.phone || '—'}</dd>
                        </div>
                        <div>
                          <dt>Vai trò</dt>
                          <dd>{owner.roleLabel || 'Người bán'}</dd>
                        </div>
                      </dl>
                      <Link className="detail-btn shop-detail-side-actions" to={`/users/${owner.id}`}>
                        Xem chi tiết người dùng
                      </Link>
                    </>
                  ) : (
                    <p className="muted account-detail-overview-card-body">Không có thông tin chủ shop.</p>
                  )}
                </article>
              </div>

              <article className="shop-detail-panel shop-detail-verify-panel">
                <div className="shop-detail-panel-head shop-detail-verify-panel-head">
                  <h3>Ảnh xác minh người bán</h3>
                  <span className={shop.isVerified ? 'badge badge-success' : 'badge badge-warning'}>
                    {shop.verification?.statusLabel || (shop.isVerified ? 'Đã xác minh' : 'Chưa xác minh')}
                  </span>
                </div>
                <div className="seller-verify-doc-grid shop-detail-verify-doc-grid shop-detail-verify-doc-grid-active">
                  <VerifyDocCard label="Mặt trước" url={shop.verification?.anhCccdTruoc} />
                  <VerifyDocCard label="Mặt sau" url={shop.verification?.anhCccdSau} />
                  <VerifyDocCard label="Selfie" url={shop.verification?.selfieImage} />
                  <VerifyDocCard label="Giấy tờ kinh doanh" url={shop.verification?.anhKD} />
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
        </>
      ) : null}

      {!loading && !shop ? (
        <p className="error-banner">{error || 'Không tìm thấy gian hàng.'}</p>
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
              Gian hàng sẽ bị khóa: không hiển thị bài đăng; đơn chờ xác nhận và đang giữ hàng sẽ hủy
              và hoàn cọc. Đơn tranh chấp và đơn đang giam tiền giữ nguyên. Tài khoản chủ shop vẫn
              dùng được các tính năng khác.
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

      {confirmUnlock ? (
        <div className="dialog-overlay" role="presentation" onClick={() => !busy && setConfirmUnlock(false)}>
          <div className="dialog-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>Mở khóa gian hàng</h3>
            <p>
              Gian hàng sẽ hoạt động lại, hiển thị sản phẩm đã ẩn và có thể nhận đơn mới. Bạn có chắc
              muốn mở khóa?
            </p>
            <div className="dialog-actions">
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => setConfirmUnlock(false)}>
                Huỷ
              </button>
              <button type="button" className="unlock-confirm-btn" disabled={busy} onClick={toggleLock}>
                {busy ? 'Đang xử lý...' : 'Xác nhận mở khóa'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
