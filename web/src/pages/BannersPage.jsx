import { useCallback, useEffect, useState } from 'react';

import { createBanner, deleteBanner, listBanners, updateBanner } from '../api/bannerApi';
import { useAuth } from '../context/AuthContext';

const TARGET_OPTIONS = [
  { value: 1, label: 'Sản phẩm' },
  { value: 2, label: 'Gian hàng' },
  { value: 3, label: 'Danh mục' },
  { value: 4, label: 'Khuyến mãi' },
];

const emptyForm = {
  title: '',
  image: '',
  description: '',
  targetType: 4,
  targetId: '',
  priority: 0,
  status: 1,
  startDate: '',
  endDate: '',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default function BannersPage() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionId, setActionId] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const payload = await listBanners(token);
      setItems(payload.data?.banners || []);
    } catch (loadError) {
      setError(loadError.message || 'Không tải được banner.');
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

  function startEdit(banner) {
    setEditingId(banner.id);
    setForm({
      title: banner.title || '',
      image: banner.image || '',
      description: banner.description || '',
      targetType: Number(banner.targetType) || 4,
      targetId: banner.targetId || '',
      priority: Number(banner.priority) || 0,
      status: Number(banner.status) === 1 ? 1 : 0,
      startDate: toDateInput(banner.startDate),
      endDate: toDateInput(banner.endDate),
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!form.title.trim()) {
      setError('Vui lòng nhập tiêu đề banner.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getIdToken();
      const payload = {
        title: form.title.trim(),
        image: form.image.trim(),
        description: form.description.trim(),
        targetType: Number(form.targetType) || 4,
        targetId: form.targetId.trim(),
        priority: Number(form.priority) || 0,
        status: Number(form.status) === 1 ? 1 : 0,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      };

      if (editingId) {
        await updateBanner(token, editingId, payload);
        setSuccessMessage('Cập nhật banner thành công.');
      } else {
        await createBanner(token, payload);
        setSuccessMessage('Tạo banner thành công.');
      }
      resetForm();
      await loadItems();
    } catch (submitError) {
      setError(submitError.message || 'Không lưu được banner.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(banner) {
    const confirmed = window.confirm(`Xóa banner "${banner.title}"?`);
    if (!confirmed) return;

    setActionId(banner.id);
    setError('');
    try {
      const token = await getIdToken();
      await deleteBanner(token, banner.id);
      setSuccessMessage('Đã xóa banner.');
      if (editingId === banner.id) resetForm();
      await loadItems();
    } catch (deleteError) {
      setError(deleteError.message || 'Không xóa được banner.');
    } finally {
      setActionId('');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Banner Home</h1>
          <p>Quản lý carousel trang chủ ứng dụng buyer.</p>
        </div>
        <button type="button" onClick={loadItems} disabled={loading}>
          Làm mới
        </button>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {successMessage ? <p className="success-banner">{successMessage}</p> : null}

      <section className="category-form-card">
        <div className="category-form-header">
          <h2>{editingId ? 'Sửa banner' : 'Thêm banner mới'}</h2>
          {editingId ? (
            <button type="button" className="ghost-btn" onClick={resetForm}>
              Hủy sửa
            </button>
          ) : null}
        </div>

        <form className="category-form" onSubmit={handleSubmit}>
          <label>
            Tiêu đề
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="VD: Flash sale cuối tuần"
              required
            />
          </label>

          <label>
            URL ảnh
            <input
              value={form.image}
              onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))}
              placeholder="https://..."
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
            />
          </label>

          <label>
            Loại đích
            <select
              value={form.targetType}
              onChange={(event) =>
                setForm((current) => ({ ...current, targetType: Number(event.target.value) }))
              }
            >
              {TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            ID đích (product/shop/category)
            <input
              value={form.targetId}
              onChange={(event) =>
                setForm((current) => ({ ...current, targetId: event.target.value }))
              }
            />
          </label>

          <label>
            Ưu tiên
            <input
              type="number"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({ ...current, priority: event.target.value }))
              }
            />
          </label>

          <label>
            Trạng thái
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: Number(event.target.value) }))
              }
            >
              <option value={1}>Đang hiện</option>
              <option value={0}>Ẩn</option>
            </select>
          </label>

          <label>
            Ngày bắt đầu
            <input
              type="date"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
            />
          </label>

          <label>
            Ngày kết thúc
            <input
              type="date"
              value={form.endDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, endDate: event.target.value }))
              }
            />
          </label>

          <button type="submit" className="primary-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Tạo banner'}
          </button>
        </form>
      </section>

      <section className="table-card">
        {loading ? (
          <p>Đang tải...</p>
        ) : items.length === 0 ? (
          <p>Chưa có banner.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tiêu đề</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((banner) => (
                <tr key={banner.id}>
                  <td>
                    <strong>{banner.title}</strong>
                    {banner.image ? (
                      <div>
                        <a href={banner.image} target="_blank" rel="noreferrer">
                          Ảnh
                        </a>
                      </div>
                    ) : null}
                  </td>
                  <td>{banner.priority}</td>
                  <td>{Number(banner.status) === 1 ? 'Hiện' : 'Ẩn'}</td>
                  <td>
                    {formatDate(banner.startDate)} → {formatDate(banner.endDate)}
                  </td>
                  <td className="table-actions">
                    <button type="button" onClick={() => startEdit(banner)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      disabled={actionId === banner.id}
                      onClick={() => handleDelete(banner)}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
