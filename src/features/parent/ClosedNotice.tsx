import { Clock } from 'lucide-react';
import { PhoneLink } from '../../components/PhoneLink';
import { SERVICE_LABELS, type ServiceType } from '../../config/business';

export function ClosedNotice({ service }: { service: ServiceType }) {
  return (
    <div className="banner banner--neutral">
      <Clock size={18} aria-hidden="true" />
      <div className="stack-sm">
        <p>
          <strong>Los pedidos de {SERVICE_LABELS[service].lower} para este día han cerrado.</strong>
        </p>
        <p>
          Si necesitas solicitar un alimento después del horario establecido, comunícate directamente con el Instituto al{' '}
          <PhoneLink />.
        </p>
      </div>
    </div>
  );
}
