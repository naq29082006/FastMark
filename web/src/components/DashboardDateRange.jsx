import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function toDateInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function presetDates(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export function presetRange(key) {
  const now = new Date();
  switch (key) {
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const value = toDateInput(yesterday);
      return { from: value, to: value };
    }
    case 'thisMonth':
      return {
        from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: toDateInput(now),
      };
    case 'thisYear':
      return {
        from: toDateInput(new Date(now.getFullYear(), 0, 1)),
        to: toDateInput(now),
      };
    case '7days':
      return presetDates(7);
    case '15days':
      return presetDates(15);
    case '30days':
      return presetDates(30);
    case 'today':
    default:
      return presetDates(1);
  }
}

const DATE_PRESETS = [
  ['today', 'Hôm nay'],
  ['yesterday', 'Hôm qua'],
  ['7days', '7 ngày qua'],
  ['15days', '15 ngày qua'],
  ['30days', '30 ngày qua'],
  ['thisMonth', 'Tháng này'],
  ['thisYear', 'Năm nay'],
];

const ALL_PRESET = ['all', 'Tất cả thời gian'];

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function parseDateInput(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatDateDisplay(value) {
  const date = parseDateInput(value);
  if (!date) return '';
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('-');
}

function buildCalendarDays(monthDate) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function CalendarMonth({ monthDate, rangeFrom, rangeTo, onSelect }) {
  const month = monthDate.getMonth();
  const today = toDateInput(new Date());
  return (
    <div className="date-calendar-month">
      <strong className="date-calendar-title">
        Tháng {month + 1} {monthDate.getFullYear()}
      </strong>
      <div className="date-calendar-grid date-calendar-weekdays">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="date-calendar-grid">
        {buildCalendarDays(monthDate).map((date) => {
          const value = toDateInput(date);
          const outside = date.getMonth() !== month;
          const selected = value === rangeFrom || value === rangeTo;
          const inRange = rangeFrom && rangeTo && value > rangeFrom && value < rangeTo;
          return (
            <button
              key={value}
              type="button"
              className={[
                'date-calendar-day',
                outside ? 'outside' : '',
                selected ? 'selected' : '',
                inRange ? 'in-range' : '',
                value === today ? 'today' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelect(value)}
              aria-label={formatDateDisplay(value)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardDateRange({
  from,
  to,
  preset,
  onApply,
  label = 'Thời Gian Dữ Liệu',
  allowAll = false,
  inline = false,
}) {
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [draftPreset, setDraftPreset] = useState(preset);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const presets = allowAll ? [ALL_PRESET, ...DATE_PRESETS] : DATE_PRESETS;

  function updatePopoverPosition() {
    const trigger = rootRef.current?.querySelector('.dashboard-date-trigger');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(760, window.innerWidth - 24);
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    setPopoverStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: Math.max(12, left),
      width,
      zIndex: 1000,
    });
  }

  useEffect(() => {
    if (!open) {
      setPopoverStyle(null);
      return undefined;
    }

    updatePopoverPosition();

    const closeOnOutsideClick = (event) => {
      if (
        rootRef.current?.contains(event.target) ||
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', updatePopoverPosition, true);
    window.addEventListener('resize', updatePopoverPosition);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      window.removeEventListener('resize', updatePopoverPosition);
    };
  }, [open]);

  function togglePicker() {
    if (!open) {
      setDraftFrom(from);
      setDraftTo(to);
      setDraftPreset(preset);
      setSelectingEnd(false);
      const initial = parseDateInput(from) || new Date();
      setCalendarMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    }
    setOpen((current) => !current);
  }

  function choosePreset(key) {
    if (key === 'all') {
      onApply({ from: '', to: '', preset: 'all' });
      setOpen(false);
      return;
    }
    const dates = presetRange(key);
    onApply({ from: dates.from, to: dates.to, preset: key });
    setOpen(false);
  }

  function chooseDate(value) {
    setDraftPreset('custom');
    if (!selectingEnd) {
      setDraftFrom(value);
      setDraftTo(value);
      setSelectingEnd(true);
      return;
    }
    if (value < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(value);
    } else {
      setDraftTo(value);
    }
    setSelectingEnd(false);
  }

  const displayValue =
    !from && !to
      ? 'Tất cả thời gian'
      : from === to
        ? formatDateDisplay(from)
        : `${formatDateDisplay(from)} → ${formatDateDisplay(to)}`;

  return (
    <div
      className={`dashboard-date-picker${inline ? ' dashboard-date-picker--inline' : ''}`}
      ref={rootRef}
    >
      {label ? <span className="dashboard-date-label">{label}</span> : null}
      <button
        type="button"
        className={`dashboard-date-trigger${open ? ' open' : ''}`}
        onClick={togglePicker}
        aria-expanded={open}
      >
        <span>{displayValue}</span>
        <span aria-hidden="true">▣</span>
      </button>

      {open && popoverStyle
        ? createPortal(
            <div
              ref={popoverRef}
              className="dashboard-date-popover dashboard-date-popover-portal"
              style={popoverStyle}
            >
              <aside className="date-preset-list">
                <strong>Chọn nhanh</strong>
                {presets.map(([key, presetLabel]) => (
                  <button
                    key={key}
                    type="button"
                    className={draftPreset === key ? 'active' : ''}
                    onClick={() => choosePreset(key)}
                  >
                    {presetLabel}
                  </button>
                ))}
              </aside>

              <div className="date-calendar-panel">
                <div className="date-calendar-toolbar">
                  <button type="button" onClick={() => setCalendarMonth((date) => shiftMonth(date, -1))}>
                    ‹
                  </button>
                  <span>
                    {draftFrom
                      ? `${formatDateDisplay(draftFrom)}${
                          draftFrom !== draftTo ? ` → ${formatDateDisplay(draftTo)}` : ''
                        }`
                      : 'Chọn khoảng ngày'}
                  </span>
                  <button type="button" onClick={() => setCalendarMonth((date) => shiftMonth(date, 1))}>
                    ›
                  </button>
                </div>
                <div className="date-calendar-months">
                  <CalendarMonth
                    monthDate={calendarMonth}
                    rangeFrom={draftFrom}
                    rangeTo={draftTo}
                    onSelect={chooseDate}
                  />
                  <CalendarMonth
                    monthDate={shiftMonth(calendarMonth, 1)}
                    rangeFrom={draftFrom}
                    rangeTo={draftTo}
                    onSelect={chooseDate}
                  />
                </div>
                <div className="date-picker-actions">
                  <span>{selectingEnd ? 'Chọn ngày kết thúc' : 'Khoảng thời gian đã chọn'}</span>
                  <button type="button" className="date-picker-cancel" onClick={() => setOpen(false)}>
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="date-picker-apply"
                    disabled={!draftFrom || !draftTo}
                    onClick={() => {
                      onApply({ from: draftFrom, to: draftTo, preset: draftPreset });
                      setOpen(false);
                    }}
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
