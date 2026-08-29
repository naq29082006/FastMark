import PreviewableImage from '../../components/PreviewableImage';

export default function ProductCell({ productName, productImage, onClick }) {
  const name = productName || '—';

  const nameBlock = (
    <span className="admin-dashboard-product-cell-name" title={name}>
      {name}
    </span>
  );

  return (
    <div className="admin-dashboard-product-cell">
      <PreviewableImage
        src={productImage}
        alt={name}
        width={36}
        height={36}
        shape="rounded"
        fallbackLetter={name}
        className="admin-dashboard-product-cell-thumb"
      />
      {onClick ? (
        <button type="button" className="admin-shop-cell-text-button" onClick={onClick}>
          {nameBlock}
        </button>
      ) : (
        nameBlock
      )}
    </div>
  );
}
