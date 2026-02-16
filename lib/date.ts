import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export function formatDate(value: string): string {
  return format(new Date(value), 'yyyy年MM月dd日', { locale: zhCN });
}
