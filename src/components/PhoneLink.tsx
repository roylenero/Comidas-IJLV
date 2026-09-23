import { CONTACT_PHONE } from '../config/business';

export function PhoneLink() {
  return (
    <a className="tel-link" href={`tel:${CONTACT_PHONE.tel}`}>
      {CONTACT_PHONE.display}
    </a>
  );
}
