import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  RESERVATION_DISPUTE_REASON,
  RESERVATION_DISPUTE_REASON_LABELS,
  VIEWER_ROLE,
  buildActiveDisputeDetailNotice,
  buildDisputeAdminPendingFooter,
  buildDisputeReportOrder,
  buildDisputeSideSummaryLine,
  DISPUTE_FOOTER_CONTEXT,
  getSellerDisputeReasonPickerLabel,
  hasSellerPostDeliveryResponse,
  isActiveDisputeOrder,
  reservationHasDisputeContext,
} from '../../../constants/sellerOrders';
import {
  getActiveDisputeResponseCountdownLabel,
} from '../../../core/utils/escrowHold';
import { useMinuteNow } from '../../../hooks/useMinuteNow';

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
  const code = report?.reason || reservation?.buyerDisputeReason || reservation?.disputeReason;
  return (
    report?.reasonLabel ||
    RESERVATION_DISPUTE_REASON_LABELS[report?.reason] ||
    String(reservation?.buyerDisputeReasonLabel || '').trim() ||
    RESERVATION_DISPUTE_REASON_LABELS[reservation?.buyerDisputeReason] ||
    reservation?.disputeReasonLabel ||
    RESERVATION_DISPUTE_REASON_LABELS[code] ||
    report?.title ||
    ''
  );
}

function getSellerReasonLabel(report, reservation) {
  const code =
    report?.reason ||
    reservation?.sellerDisputeReason ||
    (reservation?.disputeBySeller ? reservation?.disputeReason : '');
  return (
    report?.reasonLabel ||
    RESERVATION_DISPUTE_REASON_LABELS[report?.reason] ||
    getSellerDisputeReasonPickerLabel(code) ||
    String(reservation?.sellerDisputeReasonLabel || '').trim() ||
    RESERVATION_DISPUTE_REASON_LABELS[reservation?.sellerDisputeReason] ||
    RESERVATION_DISPUTE_REASON_LABELS[code] ||
    getSellerDisputeReasonPickerLabel(RESERVATION_DISPUTE_REASON.BUYER_NO_SHOW)
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
    return side === 'buyer' ? 'Khiếu nại của người mua' : 'Báo cáo của người bán';
  }

  return side === 'buyer' ? 'Khiếu nại của người mua' : 'Báo cáo của người bán';
}

function getSummaryLine(side, viewerRole, reasonLabel, isResponse = false) {
  return buildDisputeSideSummaryLine(side, viewerRole, reasonLabel, { isResponse });
}

function SellerResponseBlock({ reservation, viewerRole }) {
  const response = reservation?.sellerResponse;
  const content = String(response?.content || '').trim();
  const images = Array.isArray(response?.images) ? response.images.filter(Boolean) : [];
  const respondedAt = reservation?.tgPhShop || null;

  if (!hasSellerPostDeliveryResponse(reservation) || !content) {
    return null;
  }

  return (
    <View style={styles.reportItem}>
      <Text style={styles.reportItemTitle}>Phản hồi của người bán</Text>
      <Text style={styles.summaryLine}>Người bán đã phản hồi khiếu nại</Text>
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

function DisputeReportBlock({ side, report, reservation, viewerRole, isResponse = false }) {
  const reasonLabel =
    side === 'buyer'
      ? getBuyerReasonLabel(report, reservation)
      : getSellerReasonLabel(report, reservation);
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
        {getSummaryLine(side, viewerRole, reasonLabel, isResponse)}
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
  const currentTime = useMinuteNow(true);

  if (!reservationHasDisputeContext(reservation, { buyerReport, sellerReport })) {
    return null;
  }

  const disputeCountdownLabel = isActiveDisputeOrder(reservation)
    ? getActiveDisputeResponseCountdownLabel(reservation, currentTime, viewerRole)
    : '';
  const responseCountdown = isActiveDisputeOrder(reservation)
    ? buildDisputeAdminPendingFooter(
        reservation,
        viewerRole,
        DISPUTE_FOOTER_CONTEXT.DETAIL,
        currentTime
      )
    : '';
  const waitingNotice = isActiveDisputeOrder(reservation)
    ? buildActiveDisputeDetailNotice(reservation, viewerRole, currentTime)
    : null;

  const orderedReports = buildOrderedReports(buyerReport, sellerReport, reservation);

  return (
    <View style={styles.section}>
      <View style={styles.divider} />
      <Text style={styles.heading}>TRANH CHẤP</Text>

      {orderedReports.map((entry, index) => (
        <DisputeReportBlock
          key={entry.side}
          side={entry.side}
          report={entry.report}
          reservation={reservation}
          viewerRole={viewerRole}
          isResponse={index > 0}
        />
      ))}

      {responseCountdown ? (
        <Text style={styles.countdownLine}>{responseCountdown}</Text>
      ) : disputeCountdownLabel ? (
        <Text style={styles.countdownLine}>{disputeCountdownLabel}</Text>
      ) : null}

      <SellerResponseBlock reservation={reservation} viewerRole={viewerRole} />

      {waitingNotice ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.pendingTitle}>{waitingNotice.title}</Text>
          {waitingNotice.body ? (
            <Text style={styles.pendingBody}>{waitingNotice.body}</Text>
          ) : null}
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
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: '#0f172a',
    marginBottom: 10,
  },
  countdownLine: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    lineHeight: 22,
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
  pendingTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#b91c1c',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  pendingBody: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 20,
  },
});
