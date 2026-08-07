import { Avatar } from 'antd';

import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

export default function ShopCell({
  shopName,
  shopUsername,
  shopAvatar,
  avatar,
  onClick,
}) {
  const name = shopName || shopUsername || '—';
  const rawHandle = shopUsername ? String(shopUsername).replace(/^@+/, '') : '';
  const handle = rawHandle ? `@${rawHandle}` : '';

  const content = (
    <div className="admin-shop-cell">
      <Avatar src={resolveMediaUrl(shopAvatar || avatar) || undefined} size={36}>
        {name.charAt(0).toUpperCase()}
      </Avatar>
      <div className="admin-shop-cell-text">
        <div className="admin-shop-cell-name">{shopName || shopUsername || '—'}</div>
        {handle ? <div className="admin-shop-cell-handle">{handle}</div> : null}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" className="admin-shop-cell-button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return content;
}
