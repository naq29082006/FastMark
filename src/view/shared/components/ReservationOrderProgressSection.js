import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildReservationOrderTimeline } from '../../../core/utils/reservationOrderTimeline';

function formatStepTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${hours}:${minutes} · ${day}/${month}/${year}`;
}

export default function ReservationOrderProgressSection({ reservation }) {
  if (!reservation) {
    return null;
  }

  const { steps } = buildReservationOrderTimeline(reservation);
  if (!steps?.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>TIẾN TRÌNH ĐƠN HÀNG</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.row}>
          {steps.map((step, index) => {
            const isCurrent = step.state === 'current';
            const isDone = step.state === 'done';
            const isLast = index === steps.length - 1;
            return (
              <View key={`${step.key}-${index}`} style={styles.stepWrap}>
                <View style={styles.stepTop}>
                  <View
                    style={[
                      styles.dot,
                      isDone ? styles.dotDone : null,
                      isCurrent ? styles.dotCurrent : null,
                      step.tone === 'purple' && isDone ? styles.dotDispute : null,
                      step.tone === 'red' && isDone ? styles.dotCancelled : null,
                    ]}
                  />
                  {!isLast ? (
                    <View
                      style={[
                        styles.line,
                        isDone ? styles.lineDone : null,
                        step.tone === 'purple' ? styles.lineDispute : null,
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[styles.label, isCurrent ? styles.labelCurrent : null]}
                  numberOfLines={3}
                >
                  {step.label}
                </Text>
                {step.at ? (
                  <Text style={styles.time} numberOfLines={2}>
                    {formatStepTime(step.at)}
                  </Text>
                ) : (
                  <Text style={styles.timeMuted}>—</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 8,
  },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  scroll: {
    marginHorizontal: -4,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  stepWrap: {
    width: 108,
    marginRight: 4,
  },
  stepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
    marginBottom: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  dotDone: {
    backgroundColor: '#076F32',
    borderColor: '#076F32',
  },
  dotCurrent: {
    backgroundColor: '#fff',
    borderColor: '#076F32',
    borderWidth: 3,
  },
  dotDispute: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  dotCancelled: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 2,
  },
  lineDone: {
    backgroundColor: '#076F32',
  },
  lineDispute: {
    backgroundColor: '#a78bfa',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 16,
  },
  labelCurrent: {
    color: '#076F32',
  },
  time: {
    marginTop: 4,
    fontSize: 10,
    color: '#64748b',
    lineHeight: 14,
  },
  timeMuted: {
    marginTop: 4,
    fontSize: 10,
    color: '#cbd5e1',
  },
});
