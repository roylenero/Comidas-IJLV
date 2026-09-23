import { useSubscription } from './useSubscription';
import { watchSettings } from '../services/settings';
import { watchMenuDays, watchMenuWeek } from '../services/menu';
import { watchFamilyOrders, watchOrdersByDate } from '../services/orders';
import { watchAllStudents, watchAuthorizedEmails, watchFamilies } from '../services/families';
import type { ISODate } from '../types/models';

export const useSettings = () => useSubscription('settings', watchSettings);

export const useMenuWeek = (weekId: ISODate) =>
  useSubscription(`week:${weekId}`, (onData, onError) => watchMenuWeek(weekId, onData, onError));

export const useMenuDays = (weekId: ISODate) =>
  useSubscription(`days:${weekId}`, (onData, onError) => watchMenuDays(weekId, onData, onError));

export const useFamilyOrders = (familyId: string | null, from: ISODate, to: ISODate) =>
  useSubscription(familyId ? `forders:${familyId}:${from}:${to}` : null, (onData, onError) =>
    watchFamilyOrders(familyId!, from, to, onData, onError),
  );

export const useOrdersByDate = (date: ISODate) =>
  useSubscription(`orders:${date}`, (onData, onError) => watchOrdersByDate(date, onData, onError));

export const useFamilies = () => useSubscription('families', watchFamilies);
export const useAllStudents = () => useSubscription('students', watchAllStudents);
export const useAuthorizedEmails = () => useSubscription('authorizedEmails', watchAuthorizedEmails);
