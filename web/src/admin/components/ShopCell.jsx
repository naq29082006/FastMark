import PreviewableImage from '../../components/PreviewableImage';

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

  const textBlock = (
    <div className="admin-shop-cell-text">
      <div className="admin-shop-cell-name">{shopName || shopUsername || '—'}</div>
      {handle ? <div className="admin-shop-cell-handle">{handle}</div> : null}
    </div>
  );

  return (
    <div className="admin-shop-cell">
      <PreviewableImage
        src={shopAvatar || avatar}
        alt={name}
        width={36}
        height={36}
        shape="circle"
        fallbackLetter={name}
      />
      {onClick ? (
        <button type="button" className="admin-shop-cell-text-button" onClick={onClick}>
          {textBlock}
        </button>
      ) : (
        textBlock
      )}
    </div>
  );
}
