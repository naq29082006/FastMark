import { Button, Col, Input, Row, Select, Space } from 'antd';

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
    <div style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} md={10} lg={8}>
          <Input.Search
            allowClear
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onSearch={onSearch}
          />
        </Col>
        {filters.map((filter) => (
          <Col key={filter.key} xs={24} sm={12} md={8} lg={6}>
            <Select
              allowClear
              placeholder={filter.placeholder}
              style={{ width: '100%' }}
              options={filter.options}
              value={filter.value}
              onChange={filter.onChange}
            />
          </Col>
        ))}
        <Col flex="auto">
          <Space wrap style={{ float: 'right' }}>
            {onReset ? (
              <Button onClick={onReset}>Reset</Button>
            ) : null}
            {extra}
          </Space>
        </Col>
      </Row>
    </div>
  );
}
