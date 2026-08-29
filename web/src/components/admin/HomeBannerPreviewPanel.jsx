import { useEffect, useMemo, useState } from 'react';

import { formatDate, formatPrice } from '../../utils/format';
import PreviewableImage from '../../components/PreviewableImage';

export default function HomeBannerPreviewPanel({ banner, activeBanners = [], loading = false }) {
  const [previewTab, setPreviewTab] = useState('app');
  const [slideIndex, setSlideIndex] = useState(0);

  const carousel = useMemo(() => {
    const rows = Array.isArray(activeBanners) ? activeBanners.filter((item) => item?.image) : [];
    if (!banner?.image) return rows;
    const focused = rows.find((item) => String(item.id) === String(banner.id));
    if (!focused) return [banner, ...rows];
    return [focused, ...rows.filter((item) => String(item.id) !== String(banner.id))];
  }, [activeBanners, banner]);

  useEffect(() => {
    setSlideIndex(0);
  }, [banner?.id, carousel.length]);

  useEffect(() => {
    if (carousel.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % carousel.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [carousel]);

  const current = carousel[slideIndex] || banner || null;
  const shopLabel = current?.shop?.shopName || 'Shop';

  return (
    <aside className="banner-home-preview-panel">
      <div className="banner-home-preview-head">
        <h3>Xem trước banner</h3>
        <nav className="banner-home-preview-tabs" aria-label="Xem trước banner">
          <button
            type="button"
            className={previewTab === 'app' ? 'active' : undefined}
            onClick={() => setPreviewTab('app')}
          >
            Xem trên ứng dụng
          </button>
          <button
            type="button"
            className={previewTab === 'tech' ? 'active' : undefined}
            onClick={() => setPreviewTab('tech')}
          >
            Thông tin kỹ thuật
          </button>
        </nav>
      </div>

      {previewTab === 'app' ? (
        <>
          <div className="phone-frame banner-home-phone-frame" aria-label="Xem trước banner trên điện thoại">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="phone-status-bar">
                <span>9:41</span>
                <span className="phone-status-dots">●●●</span>
              </div>
              <div className="phone-app-header">
                <strong>FastMark</strong>
                <span className="muted">Home</span>
              </div>
              <div className="phone-section-label">Gần bạn</div>

              {loading ? (
                <div className="phone-banner-empty">Đang tải banner...</div>
              ) : !current?.image ? (
                <div className="phone-banner-empty">Chọn banner để xem trước.</div>
              ) : (
                <div className="phone-banner-slot">
                  <div className="phone-banner-slide">
                    <PreviewableImage
                      src={current.image}
                      alt={shopLabel}
                      width="100%"
                      height={120}
                      shape="rounded"
                      className="phone-banner-image"
                    />
                    <span className="phone-interest-btn">Quan tâm</span>
                  </div>
                  {carousel.length > 1 ? (
                    <div className="phone-banner-dots">
                      {carousel.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={index === slideIndex ? 'phone-banner-dot is-active' : 'phone-banner-dot'}
                          aria-label={`Banner ${index + 1}`}
                          onClick={() => setSlideIndex(index)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="phone-fake-cards">
                <div className="phone-fake-card" />
                <div className="phone-fake-card" />
              </div>
            </div>
            <div className="phone-home-indicator" />
          </div>

          {current ? (
            <div className="banner-home-preview-meta">
              <div>
                <span className="muted">Shop</span>
                <div>{shopLabel}</div>
              </div>
              <div>
                <span className="muted">Hiệu lực</span>
                <div>
                  {formatDate(current.startDate) || '—'} → {formatDate(current.endDate) || '—'}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <dl className="banner-home-preview-tech">
          <div>
            <dt>ID</dt>
            <dd>{banner?.id || '—'}</dd>
          </div>
          <div>
            <dt>Gói banner</dt>
            <dd>{banner?.planName || '—'}</dd>
          </div>
          <div>
            <dt>Đích đến</dt>
            <dd>
              {banner?.targetTypeLabel || '—'}
              {banner?.targetId ? ` (${banner.targetId})` : ''}
            </dd>
          </div>
          <div>
            <dt>Giá</dt>
            <dd>{banner ? formatPrice(banner.amount) : '—'}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>{banner?.lifecycleLabel || banner?.statusLabel || '—'}</dd>
          </div>
          <div>
            <dt>Số click</dt>
            <dd>{Number(banner?.clickCount) || 0}</dd>
          </div>
          <div>
            <dt>Ảnh banner</dt>
            <dd className="banner-home-preview-tech-url">{banner?.image || '—'}</dd>
          </div>
        </dl>
      )}
    </aside>
  );
}
