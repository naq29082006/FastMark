import { useCallback, useEffect, useState } from 'react';

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../api/categoryApi';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  categoryName: '',
  description: '',
};

function formatDate(value) {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('vi-VN');
}

export default function CategoriesPage() {
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
      const payload = await listCategories(token);
      setItems(payload.data?.categories || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được danh sách danh mục.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

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
      categoryName: category.categoryName || '',
      description: category.description || '',
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const categoryName = form.categoryName.trim();
    if (!categoryName) {
      setError('Vui lòng nhập tên danh mục.');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getIdToken();
      const payload = {
        categoryName,
        description: form.description.trim(),
      };

      if (editingId) {
        await updateCategory(token, editingId, payload);
        setSuccessMessage('Cập nhật danh mục thành công.');
      } else {
        await createCategory(token, payload);
        setSuccessMessage('Tạo danh mục thành công.');
      }

      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được danh mục.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(categoryId, categoryName) {
    const confirmed = window.confirm(`Xóa danh mục "${categoryName}"?`);
    if (!confirmed) {
      return;
    }

    setActionId(categoryId);
    setError('');
    setSuccessMessage('');

    try {
      const token = await getIdToken();
      await deleteCategory(token, categoryId);
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
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Quản lý danh mục</h1>
          <p>Thêm, sửa và xóa danh mục sản phẩm dùng khi đăng tin.</p>
        </div>
        <button type="button" onClick={loadItems} disabled={loading}>
          Làm mới
        </button>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <section className="category-form-card">
        <div className="category-form-header">
          <h2>{editingId ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h2>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={startCreate}>
              Hủy sửa
            </button>
          ) : null}
        </div>

        <form className="category-form" onSubmit={handleSubmit}>
          <label>
            Tên danh mục
            <input
              value={form.categoryName}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryName: event.target.value }))
              }
              placeholder="VD: Trái cây, Rau củ..."
            />
          </label>

          <label>
            Mô tả
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Mô tả ngắn về danh mục (tuỳ chọn)"
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm danh mục'}
          </button>
        </form>
      </section>

      {loading && items.length === 0 ? <p>Đang tải...</p> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-card">Chưa có danh mục nào.</div>
      ) : null}

      {items.length > 0 ? (
        <div className="category-table-wrap">
          <table className="category-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Tên danh mục</th>
                <th>Mô tả</th>
                <th>Ngày thêm</th>
                <th>Ngày cập nhật</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="stt-cell">{index + 1}</td>
                  <td>
                    <strong>{item.categoryName}</strong>
                  </td>
                  <td>{item.description || '—'}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => startEdit(item)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={actionId === item.id}
                        onClick={() => handleDelete(item.id, item.categoryName)}
                      >
                        {actionId === item.id ? 'Đang xóa...' : 'Xóa'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
