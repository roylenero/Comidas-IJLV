import type { Timestamp } from 'firebase/firestore';
import type { ServiceType } from '../config/business';

export type { ServiceType };

/** Fecha de calendario en zona America/Mexico_City, formato YYYY-MM-DD. */
export type ISODate = string;

export type OrderStatus = 'active' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid';
export type OrderSource = 'parent' | 'admin';

export interface Settings {
  prices: Record<ServiceType, number>;
  updatedAt?: Timestamp;
}

export interface Family {
  id: string;
  name: string;
  active: boolean;
}

/** authorizedEmails/{email}: relación correo autorizado → familia. */
export interface AuthorizedEmail {
  email: string;
  familyId: string;
}

export interface Student {
  id: string;
  name: string;
  familyId: string;
  active: boolean;
}

export interface MenuService {
  available: boolean;
  description: string;
  /** Instante de cierre para padres, calculado en America/Mexico_City. */
  cutoffAt: Timestamp;
}

export interface MenuDay {
  date: ISODate;
  weekId: ISODate;
  noService: boolean;
  breakfast: MenuService;
  lunch: MenuService;
}

export interface MenuWeek {
  id: ISODate;
  weekStart: ISODate;
  hasImage: boolean;
  imageUpdatedAt?: Timestamp | null;
}

export interface MenuAsset {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
}

export interface Order {
  id: string;
  date: ISODate;
  studentId: string;
  studentName: string;
  familyId: string;
  service: ServiceType;
  priceAtOrder: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  source: OrderSource;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  createdBy: string;
  updatedBy: string;
}

export type Role = 'admin' | 'parent';
