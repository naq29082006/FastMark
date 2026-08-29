import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../api/categoryApi';
import FastMarkShopPinIcon from '../components/icons/FastMarkShopPinIcon';
import TableIconActions from '../components/ui/TableIconActions';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/format';

const emptyForm = {
  name: '',
  description: '',
  icon: '',
  disputeDays: '7',
};

function CategoryPanel({ type, showIcon = false }) {
  const isProductCategory = type === 'products';
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionId, setActionId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listCategories(token, type);
      setItems(payload.data?.categories || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách danh mục.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, type]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function resetForm() {
    setEditingId('');
    setForm(emptyForm);
  }

  function startCreate() {
    setError('');
    setSuccessMessage('');
    resetForm();
  }

  function startEdit(category) {
    setError('');
    setSuccessMessage('');
    setEditingId(category.id);
    setForm({
      name: category.name || category.categoryName || '',
      description: category.description || '',
      icon: category.icon || '',
      disputeDays: String(category.disputeDays ?? 7),
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const name = form.name.trim();
    if (!name) {
      setError('Vui lòng nhập tên danh mục.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      const payload = {
        name,
        description: form.description.trim(),
      };

      if (isProductCategory) {
        payload.disputeDays = Number(form.disputeDays) || 7;
      }

      let savedCategory;
      let createMessage = '';
      if (editingId) {
        const response = await updateCategory(token, type, editingId, payload);
        savedCategory = response.data?.category;
      } else {
        const response = await createCategory(token, type, payload);
        savedCategory = response.data?.category;
        createMessage = response.message || 'Tạo danh mục thành công.';
      }

      setSuccessMessage(editingId ? 'Cập nhật danh mục thành công.' : createMessage);
      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được danh mục.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(categoryId, categoryName) {
    const confirmed = window.confirm(
      `Xóa danh mục "${categoryName}"?\nDanh mục sẽ ẩn khỏi admin và app. Thêm lại đúng tên sẽ tự khôi phục.`
    );
    if (!confirmed) {
      return;
    }

    setActionId(categoryId);
    setError('');
    setSuccessMessage('');
    try {
      const token = await getIdToken();
      await deleteCategory(token, type, categoryId);
      setSuccessMessage('Xóa danh mục thành công.');
      if (editingId === categoryId) {
        resetForm();
      }
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message || 'Không xóa được danh mục.');
    } finally {
      setActionId('');
    }
  }

  return (
    <section className="category-panel">
      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <section className="category-form-card">
        <div className="category-form-header">
          <h3>{editingId ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={startCreate}>
              Hủy sửa
            </button>
          ) : null}
        </div>

        <form className="category-form" onSubmit={handleSubmit}>
          <div className="category-form-row">
            <label>
              Tên danh mục
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="VD: Trái cây, Thời trang..."
              />
            </label>
          </div>

          <label>
            Chi tiết danh mục
            <textarea
              rows={2}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Mô tả ngắn về danh mục"
            />
          </label>

          {showIcon ? (
            <div className="category-form-row admin-shop-category-pin-preview">
              <FastMarkShopPinIcon size="card" />
              <span>Ghim vị trí FastMark — đồng bộ bản đồ (#16A34A)</span>
            </div>
          ) : null}

          {isProductCategory ? (
            <label>
              Thời gian khiếu nại (ngày)
              <input
                type="number"
                min="1"
                max="30"
                value={form.disputeDays}
                onChange={(event) =>
                  setForm((current) => ({ ...current, disputeDays: event.target.value }))
                }
              />
            </label>
          ) : null}

          <div className="category-form-actions">
            <button type="submit" className="primary-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm danh mục'}
            </button>
          </div>
        </form>
      </section>

      {loading && items.length === 0 ? <p>Đang tải...</p> : null}
      {!loading && items.length === 0 ? <div className="empty-card">Chưa có danh mục nào.</div> : null}

      {items.length > 0 ? (
        <div className="category-table-wrap">
          <table className="category-table">
            <thead>
              <tr>
                <th>STT</th>
                {showIcon ? <th>Icon</th> : null}
                <th>Tên</th>
                <th>Chi tiết</th>
                {isProductCategory ? <th>Khiếu nại (ngày)</th> : null}
                <th>Ngày thêm</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="stt-cell">{index + 1}</td>
                  {showIcon ? (
                    <td>
                      <FastMarkShopPinIcon size="card" />
                    </td>
                  ) : null}
                  <td>
                    <strong>{item.name || item.categoryName}</strong>
                  </td>
                  <td className="category-desc-cell">{item.description || ''}</td>
                  {isProductCategory ? (
                    <td>{item.disputeDays ?? '—'}</td>
                  ) : null}
                  <td>{formatDate(item.createdAt)}</td>
                  <td className="col-actions">
                    <TableIconActions
                      actions={[
                        {
                          icon: Pencil,
                          label: 'Sửa danh mục',
                          onClick: () => startEdit(item),
                        },
                        {
                          icon: Trash2,
                          label: 'Xóa danh mục',
                          variant: 'danger',
                          disabled: actionId === item.id,
                          onClick: () => handleDelete(item.id, item.name || item.categoryName),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function CategoriesPage() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') === 'shops' ? 'shops' : 'products';

  return (
    <div className="page">
      <CategoryPanel type={type} showIcon={type === 'shops'} />
    </div>
  );
}
