import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function AdminTopbarTrail({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav className="admin-topbar-trail" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="admin-topbar-trail-segment">
            {index > 0 ? (
              <ChevronRight size={16} className="admin-topbar-trail-sep" aria-hidden />
            ) : null}
            {!isLast && item.to ? (
              <Link to={item.to} className="admin-topbar-trail-link">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'admin-topbar-trail-current' : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
