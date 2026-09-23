import { Link } from 'react-router-dom';
import { Soup } from 'lucide-react';
import { APP_SHORT_NAME } from '../config/business';

/** Marca provisional neutral. Reemplazar el ícono por el logo oficial cuando exista. */
export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label={`${APP_SHORT_NAME}, inicio`}>
      <span className="brand__mark" aria-hidden="true">
        <Soup size={22} />
      </span>
      <span>{APP_SHORT_NAME}</span>
    </Link>
  );
}
