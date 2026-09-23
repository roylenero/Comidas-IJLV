import { useSubscription } from './useSubscription';
import { watchSettings } from '../services/settings';
import { watchMenuDays, watchMenuWeek } from '../services/menu';
import { watchFamilyOrders, watchOrdersByDate } from '../services/orders';
import { watchAllStudents, watchAuthorizedEmails, watchFamilies } from '../services/families';
import type { AuthorizedEmail, Family, ISODate, MenuDay, MenuWeek, Order, Settings, Student } from '../types/models';

export const useSettings = () => useSubscription<Settings | null>('settings', watchSettings);

export const useMenuWeek = (weekId: ISODate) =>
  useSubscription<MenuWeek | null>(`week:${weekId}`, (onData, onError) => watchMenuWeek(weekId, onData, onError));

export const useMenuDays = (weekId: ISODate) =>
  useSubscription<MenuDay[]>(`days:${weekId}`, (onData, onError) => watchMenuDays(weekId, onData, onError));

export const useFamilyOrders = (familyId: string | null, from: ISODate, to: ISODate) =>
  useSubscription<Order[]>(familyId ? `forders:${familyId}:${from}:${to}` : null, (onData, onError) =>
    watchFamilyOrders(familyId!, from, to, onData, onError),
  );

export const useOrdersByDate = (date: ISODate) =>
  useSubscription<Order[]>(`orders:${date}`, (onData, onError) => watchOrdersByDate(date, onData, onError));

export const useFamilies = () => useSubscription<Family[]>('families', watchFamilies);
export const useAllStudents = () => useSubscription<Student[]>('students', watchAllStudents);
export const useAuthorizedEmails = () => useSubscription<AuthorizedEmail[]>('authorizedEmails', watchAuthorizedEmails);
