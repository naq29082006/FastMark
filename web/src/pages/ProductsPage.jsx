import { useCallback, useEffect, useMemo, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Eye, Package, Trash2 } from 'lucide-react';



import { deleteProduct, listProducts } from '../api/catalogApi';

import { listCategories } from '../api/categoryApi';

import AdminFilterPanel from '../components/admin/AdminFilterPanel';

import AdminDateFilter from '../components/admin/AdminDateFilter';

import AdminPageShell from '../components/admin/AdminPageShell';

import AdminPagination from '../components/admin/AdminPagination';

import DataTableShell from '../components/admin/DataTableShell';

import ProductRemoveDialog from '../components/admin/ProductRemoveDialog';

import {

  ProductDiscountCell,

  ProductOriginalPriceCell,

} from '../components/admin/ProductAdminPriceCells';

import { TableSttCell, TableSttHeader } from '../components/admin/TableStt';

import TableIconActions from '../components/ui/TableIconActions';

import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useAdminDateFilter } from '../hooks/useAdminDateFilter';
import { useAdminRealtimeRefresh } from '../hooks/useAdminRealtimeRefresh';
import { useAuth } from '../context/AuthContext';

import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { REALTIME_COALESCE_MS } from '../constants/realtime';
import { keepIfSame, mergeListById } from '../utils/realtimeList';
import PreviewableImage from '../components/PreviewableImage';



const STATUS_OPTIONS = [

  { value: '', label: 'Tất cả trạng thái' },

  { value: '1', label: 'Đang hiện' },

  { value: '0', label: 'Đã ẩn' },

  { value: 'removed', label: 'Đã xóa' },

];



export default function ProductsPage() {

  const { getIdToken } = useAuth();

  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const shopIdFilter = searchParams.get('shopId') || '';

  const productIdParam = searchParams.get('productId') || '';

  const statusFromUrl = searchParams.get('status') || '';

  const [items, setItems] = useState([]);

  const [categories, setCategories] = useState([]);

  const [pagination, setPagination] = useState({

    page: 1,

    limit: DEFAULT_PAGE_SIZE,

    total: 0,

    totalPages: 1,

  });

  const [summary, setSummary] = useState({ total: 0, visible: 0, hidden: 0, removed: 0 });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [message, setMessage] = useState('');

  const { input: searchInput, debounced: search, setInput: setSearchInput } = useDebouncedSearch();

  const {
    from: dateFrom,
    to: dateTo,
    preset: datePreset,
    applyRange: applyDateRange,
    resetRange: resetDateRange,
    queryParams: dateQueryParams,
  } = useAdminDateFilter();

  const [status, setStatus] = useState(statusFromUrl);

  const [categoryId, setCategoryId] = useState('');

  const [page, setPage] = useState(1);

  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const [removeTarget, setRemoveTarget] = useState(null);

  const [removeError, setRemoveError] = useState('');

  const [removeLoading, setRemoveLoading] = useState(false);



  const pageMeta = useMemo(() => {

    if (statusFromUrl === '1') {

      return { title: 'Sản phẩm đang hiện', description: 'Danh sách sản phẩm đang hiển thị trên hệ thống.' };

    }

    if (statusFromUrl === '0') {

      return { title: 'Sản phẩm đã ẩn', description: 'Danh sách sản phẩm đang bị ẩn khỏi người mua.' };

    }

    if (statusFromUrl === 'removed') {

      return {

        title: 'Sản phẩm đã xóa',

        description: 'Danh sách sản phẩm đã bị admin gỡ vi phạm hoặc người bán tự gỡ.',

      };

    }

    return {

      title: 'Quản lý sản phẩm',

      description: 'Theo dõi và điều phối sản phẩm trên toàn bộ gian hàng FastMark.',

    };

  }, [statusFromUrl]);



  useEffect(() => {

    setStatus(statusFromUrl);

    resetDateRange();

    setPage(1);

  }, [resetDateRange, statusFromUrl]);



  useEffect(() => {

    if (!productIdParam) return;

    navigate(`/products/${productIdParam}`, { replace: true });

  }, [navigate, productIdParam]);



  useEffect(() => {

    let cancelled = false;

    (async () => {

      try {

        const token = await getIdToken();

        const payload = await listCategories(token, 'products');

        if (!cancelled) {

          setCategories(payload.data?.categories || payload.data?.items || []);

        }

      } catch {

        if (!cancelled) setCategories([]);

      }

    })();

    return () => {

      cancelled = true;

    };

  }, [getIdToken]);



  const loadItems = useCallback(async ({ silent = false } = {}) => {

    // silent = đồng bộ realtime: không bật loading, chỉ dòng nào đổi mới render lại.
    if (!silent) {

      setLoading(true);

      setError('');

    }

    try {

      const token = await getIdToken();

      const payload = await listProducts(token, {

        search,

        status,

        categoryId,

        shopId: shopIdFilter || undefined,

        page,

        limit,

        ...dateQueryParams,

      });

      setItems((current) => mergeListById(current, payload.data?.items || []));

      setSummary((current) =>

        keepIfSame(current, payload.data?.summary || { total: 0, visible: 0, hidden: 0, removed: 0 }),

      );

      setPagination((current) =>

        keepIfSame(current, payload.data?.pagination || {

          page: 1,

          limit: DEFAULT_PAGE_SIZE,

          total: 0,

          totalPages: 1,

        }),

      );

    } catch (loadError) {

      if (silent) {

        return;

      }

      setError(loadError.message || 'Không tải được danh sách sản phẩm.');

      setItems([]);

      setSummary({ total: 0, visible: 0, hidden: 0, removed: 0 });

    } finally {

      if (!silent) {

        setLoading(false);

      }

    }

  }, [categoryId, dateFrom, dateQueryParams, dateTo, getIdToken, limit, page, search, shopIdFilter, status]);



  useEffect(() => {

    loadItems();

  }, [loadItems]);

  useAdminRealtimeRefresh('product', () => loadItems({ silent: true }), {

    coalesceMs: REALTIME_COALESCE_MS,

  });



  function openRemoveDialog(product) {

    setRemoveError('');

    setRemoveTarget(product);

  }



  function closeRemoveDialog() {

    if (removeLoading) return;

    setRemoveTarget(null);

    setRemoveError('');

  }



  async function confirmRemoveProduct(reason) {

    if (!removeTarget?.id) return;

    setRemoveLoading(true);

    setRemoveError('');

    setError('');

    setMessage('');

    try {

      const token = await getIdToken();

      await deleteProduct(token, removeTarget.id, { reason });

      setMessage('Đã gỡ sản phẩm và gửi thông báo cho shop.');

      closeRemoveDialog();

      await loadItems();

    } catch (actionError) {

      setRemoveError(actionError.message || 'Không gỡ được sản phẩm.');

    } finally {

      setRemoveLoading(false);

    }

  }



  const categoryOptions = [

    { value: '', label: 'Tất cả danh mục' },

    ...categories.map((item) => ({

      value: String(item.id || item._id || ''),

      label: item.name || item.categoryName || 'Danh mục',

    })),

  ];



  useEffect(() => {
    setPage(1);
  }, [search]);

  function handleStatusChange(value) {

    setStatus(value);

    setPage(1);

    const next = new URLSearchParams(searchParams);

    if (value) next.set('status', value);

    else next.delete('status');

    setSearchParams(next, { replace: true });

  }



  const visibleCount = summary.visible;

  const hiddenCount = summary.hidden ?? 0;

  const removedCount = summary.removed;



  return (

    <AdminPageShell

      icon={Package}

      title={pageMeta.title}

      description={pageMeta.description}

      stats={[

        { label: 'Tổng sản phẩm', value: loading ? '…' : summary.total, icon: Package, tone: 'green' },

        { label: 'Đang hiện', value: loading ? '…' : visibleCount, icon: Eye, tone: 'blue' },

        { label: 'Đã ẩn', value: loading ? '…' : hiddenCount, icon: Eye, tone: 'amber' },

        { label: 'Đã xóa', value: loading ? '…' : removedCount, icon: Trash2, tone: 'red' },

      ]}

    >

      {error ? <p className="error-banner">{error}</p> : null}

      {message ? <p className="success-banner">{message}</p> : null}

      {shopIdFilter ? (

        <p className="muted">

          Đang lọc theo gian hàng · <Link to="/products">Xóa bộ lọc</Link>

        </p>

      ) : null}



      <DataTableShell

        title="Danh sách sản phẩm"

        filterColumns={4}

        filters={

          <AdminFilterPanel

            layout="inline"

            searchValue={searchInput}

            onSearchChange={setSearchInput}

            searchPlaceholder="Tên sản phẩm, tên gian hàng, @username..."

          >

            <label>

              Danh mục

              <select

                value={categoryId}

                onChange={(event) => {

                  setCategoryId(event.target.value);

                  setPage(1);

                }}

              >

                {categoryOptions.map((option) => (

                  <option key={option.value || 'all-cat'} value={option.value}>

                    {option.label}

                  </option>

                ))}

              </select>

            </label>

            <label>

              Trạng thái

              <select value={status} onChange={(event) => handleStatusChange(event.target.value)}>

                {STATUS_OPTIONS.map((option) => (

                  <option key={option.value || 'all'} value={option.value}>

                    {option.label}

                  </option>

                ))}

              </select>

            </label>

            <AdminDateFilter
              from={dateFrom}
              to={dateTo}
              preset={datePreset}
              onApply={(range) => applyDateRange(range, () => setPage(1))}
            />

          </AdminFilterPanel>

        }

        pagination={

          <AdminPagination

            page={pagination.page}

            totalPages={pagination.totalPages}

            total={pagination.total}

            label="sản phẩm"

            limit={limit}

            onLimitChange={(next) => {

              setLimit(next);

              setPage(1);

            }}

            loading={loading}

            onPageChange={setPage}

          />

        }

      >

        <table className="data-table catalog-table admin-data-table">

            <thead>

              <tr>

                <TableSttHeader />

                <th className="col-thumb">Ảnh</th>

                <th>Sản phẩm</th>

                <th>Gian hàng</th>

                <th className="col-price">Giá gốc</th>

                <th className="col-discount">Giảm giá</th>

                <th className="col-status">Trạng thái</th>

                <th className="col-actions">Thao tác</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>

                  <td colSpan={8} className="table-empty">

                    Đang tải...

                  </td>

                </tr>

              ) : items.length === 0 ? (

                <tr>

                  <td colSpan={8} className="table-empty">

                    Không có sản phẩm.

                  </td>

                </tr>

              ) : (

                items.map((product, index) => (

                  <tr key={product.id}>

                    <TableSttCell page={pagination.page} limit={limit} index={index} />

                    <td className="col-thumb">

                      <PreviewableImage
                        src={product.thumbnail}
                        alt={product.productName || ''}
                        width={48}
                        height={48}
                        shape="rounded"
                        className="thumb-sm"
                        fallbackLetter="SP"
                        fallbackClassName="thumb-sm thumb-fallback"
                      />

                    </td>

                    <td>

                      <div className="cell-title">{product.productName}</div>

                      <div className="cell-sub">{product.categoryName || 'Chưa có danh mục'}</div>

                    </td>

                    <td>

                      {product.shopId ? (

                        <Link to={`/shops/${product.shopId}`} className="shop-cell-link">

                          <span className="cell-title">{product.shopName || 'Gian hàng'}</span>

                          {product.shopUsername ? (

                            <span className="cell-sub">@{product.shopUsername}</span>

                          ) : null}

                        </Link>

                      ) : (

                        <span className="cell-sub" />

                      )}

                    </td>

                    <td className="col-price">

                      <ProductOriginalPriceCell item={product} />

                    </td>

                    <td className="col-discount">

                      <ProductDiscountCell item={product} />

                    </td>

                    <td className="col-status">

                      <span

                        className={

                          product.isDeleted

                            ? 'badge badge-danger'

                            : product.status === 1

                              ? 'badge badge-success'

                              : 'badge badge-neutral'

                        }

                      >

                        {product.statusLabel ||

                          (product.isDeleted

                            ? 'Đã gỡ'

                            : product.status === 1

                              ? 'Đang hiện'

                              : 'Đã ẩn')}

                      </span>

                    </td>

                    <td className="col-actions">

                      <TableIconActions

                        actions={[

                          {

                            icon: Eye,

                            label: 'Xem chi tiết',

                            onClick: () => navigate(`/products/${product.id}`),

                          },

                          product.isDeleted

                            ? null

                            : {

                                icon: Trash2,

                                label: 'Gỡ sản phẩm vi phạm',

                                variant: 'danger',

                                disabled: removeLoading,

                                onClick: () => openRemoveDialog(product),

                              },

                        ].filter(Boolean)}

                      />

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

      </DataTableShell>



      <ProductRemoveDialog

        product={removeTarget}

        open={Boolean(removeTarget)}

        loading={removeLoading}

        error={removeError}

        onClose={closeRemoveDialog}

        onConfirm={confirmRemoveProduct}

      />

    </AdminPageShell>

  );

}

