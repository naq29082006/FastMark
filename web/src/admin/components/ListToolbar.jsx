import { Button, Input, Select, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

function resolveFilterLabel(filter) {
  const raw = String(filter.label || filter.placeholder || '').trim();
  return raw.replace(/:$/, '');
}

export default function ListToolbar({
  searchPlaceholder = 'Tìm kiếm...',
  searchValue,
  onSearchChange,
  onSearch,
  filters = [],
  extra,
  onReset,
}) {
  return (
    <div className="admin-list-toolbar">
      <div className="admin-list-toolbar-row">
        <Input.Search
          allowClear
          className="admin-list-toolbar-search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onSearch={onSearch}
        />

        {filters.map((filter) => {
          const label = resolveFilterLabel(filter);
          return (
            <div key={filter.key} className="admin-list-toolbar-filter">
              {label ? <span className="admin-list-toolbar-filter-label">{label}:</span> : null}
              <Select
                className="admin-list-toolbar-filter-select"
                style={{ width: filter.width || 168 }}
                placeholder={filter.placeholder}
                options={filter.options}
                value={filter.value}
                loading={filter.loading}
                onChange={filter.onChange}
              />
            </div>
          );
        })}

        {(onReset || extra) && (
          <div className="admin-list-toolbar-actions">
            {onReset ? (
              <Tooltip title="Đặt lại bộ lọc">
                <Button
                  type="default"
                  icon={<ReloadOutlined />}
                  aria-label="Đặt lại bộ lọc"
                  onClick={onReset}
                />
              </Tooltip>
            ) : null}
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}
