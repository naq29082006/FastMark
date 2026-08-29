/** Chuẩn hóa response dashboard backend → shape frontend admin pages dùng. */
function pendingPreviewRows(count, label) {
  const total = Number(count) || 0;
  if (!total) return [];
  return [{ id: label, code: '—', label: `${total} ${label}`, status: 0, createdAt: null }];
}

export function normalizeDashboard(raw) {
  if (!raw) return null;

  const cards = raw.cards || {};
  const charts = raw.charts || {};
  const rankings = raw.rankings || {};
  const pending = raw.pending || {};
  const metrics = raw.metrics || {};

  const topSellingShops = rankings.topSellingShops || [];
  const topSellingProducts = rankings.topSellingProducts || [];

  return {
    ...raw,
    summary: {
      totalUsers: cards.totalUsers ?? metrics.totalUsers ?? 0,
      totalShops: cards.totalShops ?? cards.totalActiveShops ?? 0,
      totalSellers: cards.totalSellers ?? 0,
      tongSP: cards.tongSP ?? cards.totalActiveProducts ?? 0,
      totalReservations: cards.totalReservations ?? metrics.totalReservations ?? 0,
      totalDisputes: cards.disputedReservations ?? metrics.disputedReservations ?? 0,
      tongDG: cards.tongDG ?? metrics.tongDG ?? 0,
      totalReports: cards.totalReports ?? metrics.totalReports ?? 0,
      totalRevenue: cards.periodRevenue ?? metrics.periodRevenue ?? 0,
      platformRevenue: cards.periodRevenue ?? metrics.periodRevenue ?? 0,
      systemWalletBalance: cards.escrowBalance ?? 0,
    },
    series: {
      usersOverTime: charts.usersOverTime || [],
      sellersOverTime: charts.sellersOverTime || [],
      reservationsOverTime: charts.reservationsOverTime || [],
      revenueOverTime: charts.revenueOverTime || [],
      paymentOverTime: charts.revenueOverTime || [],
    },
    charts,
    cards,
    rankings,
    pending,
    topShopsByRevenue: topSellingShops.map((row) => ({
      shopId: row.shopId,
      shopName: row.shopName,
      revenue: row.revenue,
      orderCount: row.orders,
    })),
    topShopsByOrders: [...topSellingShops]
      .sort((a, b) => (b.orders || 0) - (a.orders || 0))
      .map((row) => ({
        shopId: row.shopId,
        shopName: row.shopName,
        orderCount: row.orders,
        revenue: row.revenue,
      })),
    topProductsByReservations: topSellingProducts.map((row) => ({
      productId: row.productId,
      productName: row.name,
      count: row.soldQuantity,
      revenue: row.revenue,
    })),
    recent: {
      verifications: pendingPreviewRows(pending.sellerVerifications, 'hồ sơ chờ duyệt'),
      reservations: [],
      disputes: pendingPreviewRows(pending.reports, 'báo cáo chờ'),
      withdraws: pendingPreviewRows(pending.banners, 'banner chờ'),
    },
  };
}

/** Chuẩn hóa finance overview backend → shape FinancePage dùng. */
export function normalizeFinanceOverview(raw) {
  if (!raw) return null;

  const inRange = raw.inRange || {};
  const series = raw.series || {};
  const balances = raw.balances || {};

  const platformRevenueTotal = inRange.platformRevenue?.total ?? 0;
  const walletTotal =
    raw.summary?.walletTotal ??
    (Number(balances.buyerWalletTotal) || 0) + (Number(balances.sellerWalletTotal) || 0);
  const walletCount =
    raw.summary?.walletCount ??
    (Number(balances.buyerWalletCount) || 0) + (Number(balances.sellerWalletCount) || 0);

  return {
    ...raw,
    balances: {
      ...balances,
      walletTotal,
      walletCount,
    },
    inRange,
    series,
    summary: {
      walletTotal,
      walletCount,
      subscriptionRevenue: platformRevenueTotal,
      bannerRevenue: inRange.bannerSales?.total ?? 0,
      depositHoldTotal: inRange.depositHold?.total ?? 0,
      depositRefundTotal: inRange.depositRefund?.total ?? 0,
      withdrawTotal: raw.summary?.withdrawTotal ?? inRange.withdrawal?.total ?? 0,
      withdrawCount: raw.summary?.withdrawCount ?? inRange.withdrawal?.count ?? 0,
      topupTotal: raw.summary?.topupTotal ?? inRange.topup?.total ?? 0,
      topupCount: raw.summary?.topupCount ?? inRange.topup?.count ?? 0,
      platformRevenue: platformRevenueTotal,
      depositReleaseTotal: inRange.depositRelease?.total ?? 0,
      gmvTotal: inRange.gmv?.total ?? 0,
      disputedTotal: inRange.disputed?.total ?? 0,
      escrowHeldTotal: raw.summary?.escrowHeldTotal ?? balances.escrowHeldTotal ?? 0,
      escrowHeldCount: raw.summary?.escrowHeldCount ?? balances.escrowHeldCount ?? 0,
      totalRevenue:
        platformRevenueTotal +
        (Number(inRange.bannerSales?.total) || 0),
    },
    charts: {
      topupSeries: series.topup || [],
      withdrawSeries: series.withdrawal || [],
      depositReleaseSeries: series.depositRelease || [],
      revenueSeries: series.platformRevenue || [],
    },
  };
}

/** Chuẩn hóa pagination withdraw (backend trả flat total/page/limit). */
export function normalizeListPayload(raw) {
  const data = raw?.data || raw || {};
  const pagination = data.pagination || {
    page: data.page ?? 1,
    limit: data.limit ?? 20,
    total: data.total ?? 0,
    totalPages:
      data.totalPages ??
      Math.max(1, Math.ceil((data.total || 0) / (data.limit || 20))),
  };

  return {
    data: {
      items: data.items || data.rows || data.list || data.verifications || data.plans || [],
      pagination,
      stats: data.stats || data.summary || data.statistics,
    },
  };
}

/** Danh sách gói dịch vụ / gói banner từ response admin API. */
export function extractPlansList(payload) {
  if (Array.isArray(payload)) return payload;
  const data = payload?.data ?? payload ?? {};
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.plans)) return data.plans;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(payload?.plans)) return payload.plans;
  return [];
}
