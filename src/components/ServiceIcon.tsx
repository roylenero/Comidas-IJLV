import { Coffee, UtensilsCrossed } from 'lucide-react';
import type { ServiceType } from '../config/business';

export function ServiceIcon({ service, size = 22 }: { service: ServiceType; size?: number }) {
  const Icon = service === 'breakfast' ? Coffee : UtensilsCrossed;
  return (
    <span className={`service-icon service-icon--${service}`} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}
