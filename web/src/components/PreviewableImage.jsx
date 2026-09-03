import { Avatar, Image } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

import { resolveMediaUrl } from '../utils/resolveMediaUrl';

export const PREVIEWABLE_IMAGE_MASK = (
  <span className="previewable-image-mask" aria-hidden="true">
    <EyeOutlined />
  </span>
);

/** Ant Design 6 mounts preview in-place by default; portal to body for full-screen centering. */
export const PREVIEWABLE_IMAGE_PREVIEW = {
  mask: PREVIEWABLE_IMAGE_MASK,
  getContainer: () => document.body,
};

function resolvePreviewConfig(preview) {
  if (preview === false) {
    return false;
  }
  if (preview === true || preview == null) {
    return PREVIEWABLE_IMAGE_PREVIEW;
  }
  return {
    ...PREVIEWABLE_IMAGE_PREVIEW,
    ...preview,
    getContainer: preview.getContainer ?? PREVIEWABLE_IMAGE_PREVIEW.getContainer,
  };
}

export function stopPreviewClick(event) {
  event.stopPropagation();
}

export default function PreviewableImage({
  src,
  alt = '',
  width = 80,
  height = 80,
  shape = 'square',
  className = '',
  wrapperClassName = '',
  style = {},
  preview = true,
  fallbackLetter = '',
  fallbackClassName = '',
  onClick,
}) {
  const url = resolveMediaUrl(src);
  const radius =
    shape === 'circle' ? '50%' : shape === 'rounded' ? 8 : style.borderRadius ?? 0;
  const size = Math.max(Number(width) || 0, Number(height) || 0) || 80;

  if (!url) {
    if (!fallbackLetter) {
      return null;
    }
    const mergedClass = [className, fallbackClassName].filter(Boolean).join(' ');
    return (
      <Avatar
        shape={shape === 'circle' ? 'circle' : 'square'}
        size={size}
        className={mergedClass || undefined}
        style={style}
      >
        {fallbackLetter.charAt(0).toUpperCase()}
      </Avatar>
    );
  }

  const handleClick = (event) => {
    stopPreviewClick(event);
    onClick?.(event);
  };

  return (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={`previewable-image previewable-image--${shape} ${className}`.trim()}
      rootClassName={wrapperClassName}
      style={{ objectFit: 'cover', borderRadius: radius, ...style }}
      preview={resolvePreviewConfig(preview)}
      onClick={handleClick}
    />
  );
}

export function PreviewableImageGrid({
  items = [],
  width = 88,
  height = 88,
  shape = 'rounded',
  className = 'previewable-image-grid',
  getKey,
  getSrc,
  getAlt,
}) {
  const rows = items
    .map((item, index) => {
      const src = getSrc ? getSrc(item, index) : item;
      const url = resolveMediaUrl(typeof src === 'string' ? src : src?.url || src?.imageUrl || src?.src);
      if (!url) {
        return null;
      }
      return {
        key: getKey ? getKey(item, index) : `${url}-${index}`,
        url,
        alt: getAlt ? getAlt(item, index) : '',
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    return null;
  }

  return (
    <div className={className}>
      <Image.PreviewGroup preview={PREVIEWABLE_IMAGE_PREVIEW}>
        {rows.map((row) => (
          <PreviewableImage
            key={row.key}
            src={row.url}
            alt={row.alt}
            width={width}
            height={height}
            shape={shape}
          />
        ))}
      </Image.PreviewGroup>
    </div>
  );
}

export function VerifyDocCard({ label, url, className = '', variant = 'landscape' }) {
  const src = resolveMediaUrl(url);
  const isPortrait = variant === 'portrait';
  const cardClass = [
    'seller-verify-doc-card',
    isPortrait ? 'seller-verify-doc-card--portrait' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const previewClass = [
    'seller-verify-doc-preview',
    isPortrait ? 'seller-verify-doc-preview--portrait' : '',
    'shop-detail-doc-preview-btn',
  ]
    .filter(Boolean)
    .join(' ');

  if (!src) {
    return (
      <article className={`${cardClass} empty`.trim()}>
        <div className={`${previewClass} placeholder`}>{label}</div>
        <span>{label}</span>
      </article>
    );
  }

  return (
    <article className={cardClass}>
      <div className={previewClass}>
        <PreviewableImage
          src={src}
          alt={label}
          width={isPortrait ? 180 : 320}
          height={isPortrait ? 240 : 132}
          shape="rounded"
          className="verify-doc-preview-image"
          style={{ width: '100%', height: '100%', objectFit: isPortrait ? 'contain' : 'cover' }}
        />
      </div>
      <span>{label}</span>
    </article>
  );
}
