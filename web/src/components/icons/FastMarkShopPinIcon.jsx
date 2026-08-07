/** Ghim vị trí gian hàng — đồng bộ bản đồ FastMark (#16A34A). */
export const SHOP_PIN_SIZE = {
  sidebar: 20,
  card: 24,
};

/**
 * Map marker / giọt nước mềm, vòng tròn trắng ở giữa.
 * @param {'sm'|'md'|'sidebar'|'card'|'lg'|number} [size='sm'] — sidebar ~20px, card/dialog ~24px
 */
export default function FastMarkShopPinIcon({
  size = 'sm',
  className = '',
  title = 'Gian hàng',
  style,
  strokeWidth: _strokeWidth,
  ...rest
}) {
  let width;
  if (typeof size === 'number' && size > 0) {
    width = size;
  } else if (size === 'md' || size === 'card') {
    width = SHOP_PIN_SIZE.card;
  } else if (size === 'lg') {
    width = 32;
  } else {
    width = SHOP_PIN_SIZE.sidebar;
  }
  const height = Math.round(width * 1.6);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 32"
      width={width}
      height={height}
      className={['fastmark-shop-pin-icon', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={title}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      {...rest}
    >
      <path
        d="M10 1.75C5.17 1.75 1.75 5.42 1.75 10.35c0 6.15 7.38 18.35 8.25 19.65.87-1.3 8.25-13.5 8.25-19.65C18.25 5.42 14.83 1.75 10 1.75z"
        fill="#16A34A"
        stroke="#ffffff"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.35" r="3.85" fill="#ffffff" />
    </svg>
  );
}
