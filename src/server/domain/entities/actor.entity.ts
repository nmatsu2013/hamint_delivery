export const ROLE = {
  SALES: 'sales',
  PURCHASING: 'purchasing',
  WAREHOUSE: 'warehouse',
  ACCOUNTING: 'accounting',
  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<Role, string> = {
  sales: '営業',
  purchasing: '購買',
  warehouse: '倉庫',
  accounting: '経理',
  admin: '管理者',
};

export const ALL_ROLES: Role[] = Object.values(ROLE);

export function isRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value);
}

export interface Actor {
  id: string;
  email: string;
  role: Role;
  name?: string;
}

/** 仕入価格・原価を閲覧できるロール。 */
export function canViewCost(role: Role): boolean {
  return role === 'purchasing' || role === 'accounting' || role === 'admin';
}
