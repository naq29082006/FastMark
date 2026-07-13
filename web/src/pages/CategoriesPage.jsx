import { useCallback, useEffect, useState } from 'react';

import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  uploadCategoryIcon,
} from '../api/categoryApi';
import { useAuth } from '../context/AuthContext';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

const emptyForm = {
  name: '',
  description: '',
  icon: '',
  isDeleted: 1,
};

function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('vi-VN');
}

function CategoryPanel({ type, title, subtitle, showIcon = false }) {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionId, setActionId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [iconFile, setIconFile] = useState(null);

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
    setIconFile(null);
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
    setIconFile(null);
    setForm({
      name: category.name || category.categoryName || '',
      description: category.description || '',
      icon: category.icon || '',
      isDeleted: Number(category.isDeleted ?? category.IsDeleted) === 0 ? 0 : 1,
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
        categoryName: name,
        description: form.description.trim(),
        isDeleted: Number(form.isDeleted) === 0 ? 0 : 1,
      };

      if (showIcon) {
        payload.icon = form.icon.trim();
      }

      let savedCategory;
      if (editingId) {
        const response = await updateCategory(token, type, editingId, payload);
        savedCategory = response.data?.category;
      } else {
        const response = await createCategory(token, type, payload);
        savedCategory = response.data?.category;
      }

      if (showIcon && iconFile && savedCategory?.id) {
        const uploaded = await uploadCategoryIcon(token, type, savedCategory.id, iconFile);
        if (uploaded.data?.icon) {
          await updateCategory(token, type, savedCategory.id, {
            ...payload,
            icon: uploaded.data.icon,
          });
        }
      }

      setSuccessMessage(editingId ? 'Cập nhật danh mục thành công.' : 'Tạo danh mục thành công.');
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
      <header className="page-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button type="button" onClick={loadItems} disabled={loading}>
          Làm mới
        </button>
      </header>

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
          <label>
            Tên danh mục
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="VD: Trái cây, Thời trang..."
            />
          </label>

          <label>
            Chi tiết danh mục
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Mô tả ngắn về danh mục"
            />
          </label>

          {showIcon ? (
            <>
              <label>
                Icon (URL Supabase)
                <input
                  value={form.icon}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, icon: event.target.value }))
                  }
                  placeholder="https://..."
                />
              </label>

              <label>
                Upload icon
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setIconFile(event.target.files?.[0] || null)}
                />
              </label>

              {(form.icon || iconFile) && (
                <div className="category-icon-preview">
                  {iconFile ? (
                    <img src={URL.createObjectURL(iconFile)} alt="Icon preview" />
                  ) : (
                    <img src={resolveMediaUrl(form.icon)} alt="Icon" />
                  )}
                </div>
              )}
            </>
          ) : null}

          <label>
            Trạng thái
            <select
              value={String(form.isDeleted)}
              onChange={(event) =>
                setForm((current) => ({ ...current, isDeleted: Number(event.target.value) }))
              }
            >
              <option value="1">Hiển thị (Active)</option>
              <option value="0">Ẩn</option>
            </select>
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm danh mục'}
          </button>
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
                <th>Trạng thái</th>
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
                      {item.icon ? (
                        <img
                          className="category-icon-thumb"
                          src={resolveMediaUrl(item.icon)}
                          alt=""
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  <td>
                    <strong>{item.name || item.categoryName}</strong>
                  </td>
                  <td>{item.description || '—'}</td>
                  <td>{Number(item.isDeleted ?? item.IsDeleted) === 0 ? 'Ẩn' : 'Active'}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => startEdit(item)}>
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={actionId === item.id}
                        onClick={() => handleDelete(item.id, item.name || item.categoryName)}
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
    </section>
  );
}

export default function CategoriesPage() {
  const [activeTab, setActiveTab] = useState('products');

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Quản lý danh mục</h1>
          <p>Danh mục sản phẩm và danh mục cửa hàng được quản lý riêng.</p>
        </div>
      </header>

      <div className="category-tabs">
        <button
          type="button"
          className={activeTab === 'products' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('products')}
        >
          Danh mục sản phẩm
        </button>
        <button
          type="button"
          className={activeTab === 'shops' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('shops')}
        >
          Danh mục cửa hàng
        </button>
      </div>

      {activeTab === 'products' ? (
        <CategoryPanel
          type="products"
          title="Danh mục sản phẩm"
          subtitle="Dùng khi người bán đăng bài sản phẩm."
          showIcon
        />
      ) : (
        <CategoryPanel
          type="shops"
          title="Danh mục cửa hàng"
          subtitle="Dùng khi người bán đăng ký gian hàng."
          showIcon
        />
      )}
    </div>
  );
}
