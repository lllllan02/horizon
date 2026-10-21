export type DashboardView = 'overview' | 'activity' | 'review';

export function dashboardRoute(hash: string): DashboardView | null {
  if (/^#\/dashboard\/?$/.test(hash)) return 'overview';
  if (/^#\/dashboard\/activity\/?$/.test(hash)) return 'activity';
  if (/^#\/dashboard\/review\/?$/.test(hash)) return 'review';
  return null;
}
export const dashboardHref = (view: DashboardView) =>
  view === 'overview' ? '#/dashboard' : `#/dashboard/${view}`;
