import { Check } from 'lucide-react';

import PreviewableImageGrid from '../PreviewableImage';
import { formatDateTimeDetail, formatMoney } from '../../utils/format';
import { buildReservationOrderTimeline } from '../../utils/reservationOrderTimeline';

const TONE_CLASS = {
  green: 'reservation-order-progress-step--tone-green',
  red: 'reservation-order-progress-step--tone-red',
  orange: 'reservation-order-progress-step--tone-orange',
  purple: 'reservation-order-progress-step--tone-purple',
  neutral: 'reservation-order-progress-step--tone-neutral',
};

function OutcomeRow({ label, children }) {
  return (
    <div className="reservation-order-outcome-row">
      <span className="reservation-order-outcome-label">{label}:</span>
      <span className="reservation-order-outcome-value">{children}</span>
    </div>
  );
}

export default function ReservationOrderProgress({ reservation }) {
  if (!reservation) return null;

  const { steps, outcome } = buildReservationOrderTimeline(reservation);

  return (
    <div className="reservation-order-progress-wrap">
      <h2 className="reservation-order-progress-title">Tiến trình đơn hàng</h2>

      <ol
        className="reservation-order-progress"
        style={{ '--progress-steps': steps.length }}
      >
        {steps.map((step, index) => {
          const toneClass = TONE_CLASS[step.tone] || TONE_CLASS.neutral;
          const isDone = step.state === 'done';
          const isCurrent = step.state === 'current';
          const nextStep = steps[index + 1];
          const lineTone = nextStep?.tone || step.tone;

          return (
            <li
              key={`${step.key}-${index}`}
              className={[
                'reservation-order-progress-step',
                toneClass,
                isDone ? 'reservation-order-progress-step--done' : '',
                isCurrent ? 'reservation-order-progress-step--current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="reservation-order-progress-track" aria-hidden="true">
                {index > 0 ? (
                  <span
                    className={[
                      'reservation-order-progress-line',
                      'reservation-order-progress-line--done',
                      `reservation-order-progress-line--tone-${lineTone}`,
                    ].join(' ')}
                  />
                ) : null}
              </div>

              <span className="reservation-order-progress-icon" aria-hidden="true">
                {isDone ? <Check size={16} strokeWidth={2.5} /> : null}
              </span>

              <span className="reservation-order-progress-label">{step.label}</span>

              {step.at ? (
                <time className="reservation-order-progress-time" dateTime={step.at}>
                  {formatDateTimeDetail(step.at)}
                </time>
              ) : (
                <span className="reservation-order-progress-time reservation-order-progress-time--empty">
                  —
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {outcome ? (
        <article className="reservation-order-outcome-card">
          <h3 className="reservation-order-outcome-title">Kết quả xử lý</h3>

          <div className="reservation-order-outcome-list">
            <OutcomeRow label="Trạng thái">{outcome.statusLabel}</OutcomeRow>
            <OutcomeRow label="Tiền cọc">{formatMoney(outcome.depositAmount)}</OutcomeRow>
            <OutcomeRow label="Người nhận tiền cọc">{outcome.depositRecipient}</OutcomeRow>
            <OutcomeRow label="Kết quả">{outcome.depositResult}</OutcomeRow>
            <OutcomeRow label="Lý do">{outcome.reason}</OutcomeRow>
          </div>

          {outcome.sellerCancelNote || outcome.anhHuyShop.length > 0 ? (
            <div className="reservation-order-outcome-evidence">
              {outcome.sellerCancelNote ? (
                <OutcomeRow label="Lý do người bán nhập">{outcome.sellerCancelNote}</OutcomeRow>
              ) : null}
              {outcome.anhHuyShop.length > 0 ? (
                <div className="reservation-order-outcome-row reservation-order-outcome-row--block">
                  <span className="reservation-order-outcome-label">Hình ảnh minh chứng:</span>
                  <div className="reservation-order-outcome-images">
                    <PreviewableImageGrid
                      items={outcome.anhHuyShop}
                      width={88}
                      height={88}
                      getSrc={(url) => url}
                      getAlt={() => 'Minh chứng hủy đơn'}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      ) : null}
    </div>
  );
}
