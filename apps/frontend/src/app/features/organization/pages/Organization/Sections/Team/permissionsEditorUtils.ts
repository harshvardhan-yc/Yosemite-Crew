import { Permission, ROLE_PERMISSIONS, RoleCode } from '@/app/lib/permissions';

export function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export function computeEffectivePermissions(args: {
  role: RoleCode;
  extraPerissions?: Permission[];
  revokedPermissions?: Permission[];
}): Permission[] {
  const roleDefaults = ROLE_PERMISSIONS[args.role] ?? [];
  const extra = args.extraPerissions ?? [];
  const revoked = args.revokedPermissions ?? [];

  const revokedSet = new Set(revoked);
  return uniq([...roleDefaults, ...extra]).filter((p) => !revokedSet.has(p));
}
