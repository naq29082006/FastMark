/** Cột STT đầu bảng — tính liên tục theo phân trang server. */
export function buildSttColumn({ page = 1, pageSize = 10 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.max(1, Number(pageSize) || 10);
  const offset = (safePage - 1) * safeSize;

  return {
    title: 'STT',
    key: 'stt',
    width: 64,
    align: 'center',
    fixed: 'left',
    render: (_value, _record, index) => offset + index + 1,
  };
}

export function withSttColumn(columns, pagination = {}) {
  return [buildSttColumn(pagination), ...columns];
}
