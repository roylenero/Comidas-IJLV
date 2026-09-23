import { WifiOff } from 'lucide-react';
import { useOnline } from '../hooks/useOnline';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <WifiOff size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 8 }} />
      Sin conexión. Puedes consultar, pero los pedidos necesitan internet.
    </div>
  );
}
