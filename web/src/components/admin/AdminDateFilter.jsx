import DashboardDateRange from '../DashboardDateRange';

export default function AdminDateFilter({
  label = 'Thời gian',
  from,
  to,
  preset,
  onApply,
  inline = false,
}) {
  const picker = (
    <DashboardDateRange
      label={inline ? null : label}
      inline={inline}
      from={from}
      to={to}
      preset={preset}
      allowAll
      onApply={onApply}
    />
  );

  if (inline) {
    return (
      <div className="admin-date-filter admin-date-filter--inline">
        <span className="admin-date-filter-inline-label">{label}:</span>
        {picker}
      </div>
    );
  }

  return (
    <div className="admin-filter-field reservation-date-filter">
      {picker}
    </div>
  );
}
