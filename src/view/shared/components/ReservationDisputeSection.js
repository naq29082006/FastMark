import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABELS,
  RESERVATION_STATUS,
  VIEWER_ROLE,
  buildDisputeAdminPendingFooter,
  buildDisputeReportOrder,
  hasSellerPostDeliveryResponse,
  isPostDeliveryDisputeReservation,
  reservationHasDisputeContext,
} from '../../../constants/sellerOrders';

function formatDateTime(iso) {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getReportCreatedAt(report) {
  return report?.createdAt || report?.CreatedAt || null;
}

function getBuyerReasonLabel(report, reservation) {
  return (
    report?.reasonLabel ||
    RESERVATION_DISPUTE_REASON_LABELS[report?.reason] ||
    reservation?.disputeReasonLabel ||
    RESERVATION_DISPUTE_REASON_LABELS[reservation?.disputeReason] ||
    report?.title ||
    ''
  );
}

function getSellerReasonLabel(report) {
  return (
    report?.reasonLabel ||
    RESERVATION_DISPUTE_REASON_LABELS[report?.reason] ||
    RESERVATION_DISPUTE_REASON_LABELS[RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW] ||
    'Người mua không đến nhận hàng'
  );
}

function buildOrderedReports(buyerReport, sellerReport, reservation) {
  const merged = {
    ...(reservation || {}),
    buyerDisputedAt:
      reservation?.buyerDisputedAt || getReportCreatedAt(buyerReport) || null,
    sellerDisputedAt:
      reservation?.sellerDisputedAt || getReportCreatedAt(sellerReport) || null,
  };

  return buildDisputeReportOrder(merged).map(({ side }) => ({
    side,
    report: side === 'buyer' ? buyerReport || null : sellerReport || null,
  }));
}

function getReportHeading(side, viewerRole) {
  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;
  const isOwnReport =
    (side === 'buyer' && isViewerBuyer) || (side === 'seller' && !isViewerBuyer);

  if (isOwnReport) {
    return 'Báo cáo của bạn';
  }

  return side === 'buyer' ? 'Báo cáo của người mua' : 'Báo cáo của người bán';
}

function getSummaryLine(side, viewerRole, reasonLabel) {
  const reason = String(reasonLabel || '').trim() || '—';
  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;

  if (side === 'buyer') {
    return isViewerBuyer
      ? `Bạn đã báo cáo: ${reason}`
      : `Người mua đã báo cáo: ${reason}`;
  }

  return isViewerBuyer
    ? `Shop đã báo cáo: ${reason}`
    : `Bạn đã báo cáo: ${reason}`;
}

function SellerResponseBlock({ reservation, viewerRole }) {
  const response = reservation?.sellerResponse;
  const content = String(response?.content || '').trim();
  const images = Array.isArray(response?.images) ? response.images.filter(Boolean) : [];
  const respondedAt = reservation?.sellerRespondedAt || null;
  const isViewerBuyer = viewerRole === VIEWER_ROLE.BUYER;

  if (!hasSellerPostDeliveryResponse(reservation) || !content) {
    return null;
  }

  return (
    <View style={styles.reportItem}>
      <Text style={styles.reportItemTitle}>
        {isViewerBuyer ? 'Phản hồi của shop' : 'Phản hồi của bạn'}
      </Text>
      <Text style={styles.summaryLine}>
        {isViewerBuyer ? 'Shop đã phản hồi khiếu nại' : 'Bạn đã phản hồi khiếu nại'}
      </Text>
      <Text style={styles.reportBody}>{content}</Text>
      {respondedAt ? (
        <Text style={styles.reportMeta}>Lúc: {formatDateTime(respondedAt)}</Text>
      ) : null}
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reportPhotos}>
          {images.map((image) => (
            <Image
              key={image.id || image.imageUrl}
              source={{ uri: image.imageUrl }}
              style={styles.reportPhoto}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function DisputeReportBlock({ side, report, reservation, viewerRole }) {
  const reasonLabel =
    side === 'buyer'
      ? getBuyerReasonLabel(report, reservation)
      : getSellerReasonLabel(report);
  const content =
    side === 'seller'
      ? report?.sellerContent || report?.content || report?.description || ''
      : report?.content || report?.description || '';
  const createdAt = getReportCreatedAt(report);
  const images = Array.isArray(report?.images) ? report.images.filter(Boolean) : [];

  return (
    <View style={styles.reportItem}>
      <Text style={styles.reportItemTitle}>{getReportHeading(side, viewerRole)}</Text>
      <Text style={styles.summaryLine}>
        {getSummaryLine(side, viewerRole, reasonLabel)}
      </Text>
      {content ? <Text style={styles.reportBody}>{content}</Text> : null}
      {createdAt ? (
        <Text style={styles.reportMeta}>Lúc: {formatDateTime(createdAt)}</Text>
      ) : null}
      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reportPhotos}>
          {images.map((image) => (
            <Image
              key={image.id || image.imageUrl}
              source={{ uri: image.imageUrl }}
              style={styles.reportPhoto}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function ReservationDisputeSection({
  reservation,
  buyerReport,
  sellerReport,
  viewerRole = VIEWER_ROLE.BUYER,
}) {
  if (!reservationHasDisputeContext(reservation, { buyerReport, sellerReport })) {
    return null;
  }

  const orderedReports = buildOrderedReports(buyerReport, sellerReport, reservation);
  const showPendingAdminNotice =
    Number(reservation?.status) === RESERVATION_STATUS.DISPUTED;
  const pendingFooter = buildDisputeAdminPendingFooter(reservation, viewerRole);
  const showPostDeliverySellerWait =
    showPendingAdminNotice &&
    isPostDeliveryDisputeReservation(reservation) &&
    reservation?.disputeByBuyer &&
    !hasSellerPostDeliveryResponse(reservation);

  return (
    <View style={styles.section}>
      <View style={styles.divider} />
      <Text style={styles.heading}>TRANH CHẤP</Text>

      {orderedReports.map((entry) => (
        <DisputeReportBlock
          key={entry.side}
          side={entry.side}
          report={entry.report}
          reservation={reservation}
          viewerRole={viewerRole}
        />
      ))}

      {showPostDeliverySellerWait ? (
        <View style={styles.waitNotice}>
          <Text style={styles.waitNoticeText}>
            {viewerRole === VIEWER_ROLE.BUYER
              ? 'Khiếu nại đã gửi tới shop. Shop có 2 ngày để phản hồi trước khi admin xử lý.'
              : 'Khách đã khiếu nại sau khi nhận hàng. Vui lòng phản hồi trong 2 ngày.'}
          </Text>
        </View>
      ) : null}

      <SellerResponseBlock reservation={reservation} viewerRole={viewerRole} />

      {showPendingAdminNotice && pendingFooter ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.adminPendingNotice}>{pendingFooter}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 14,
  },
  heading: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#64748b',
    marginBottom: 10,
  },
  reportItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    gap: 6,
  },
  reportItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 22,
  },
  summaryLine: {
    fontSize: 13,
    fontWeight: '900',
    color: '#334155',
    lineHeight: 20,
  },
  reportBody: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    lineHeight: 20,
  },
  reportMeta: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  reportPhotos: {
    marginTop: 4,
  },
  reportPhoto: {
    width: 72,
    height: 72,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e2e8f0',
  },
  adminPendingNotice: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    lineHeight: 20,
  },
  waitNotice: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 10,
  },
  waitNoticeText: {
    fontSize: 13,
    color: '#9a3412',
    fontWeight: '600',
    lineHeight: 20,
  },
});
