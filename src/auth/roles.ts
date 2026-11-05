export type Role = 'owner' | 'manager' | 'viewer';
export const ROLES: Role[] = ['owner', 'manager', 'viewer'];

/** Old tokens carry role "admin": they are the owner. Unknown roles are rejected (null). */
export function normalizeRole(r: unknown): Role | null {
  if (r === 'admin' || r === 'owner') return 'owner';
  if (r === 'manager' || r === 'viewer') return r;
  return null;
}

/** Lower-cased, decoded, no query, no duplicate/trailing slashes: so /STAFF, //staff and /staff/ can't dodge a rule. */
export function normalizePath(raw: string): string {
  let p = (raw ?? '').split('?')[0].split('#')[0];
  try {
    p = decodeURIComponent(p);
  } catch {
    // keep the raw path
  }
  p = p.toLowerCase().replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

const RESTRICTED = /^\/(staff|activity)(\/|$)/; // owner only

/**
 * The role matrix (the server is the only authority):
 *   owner   : everything
 *   manager : everything except /staff* and /activity*
 *   viewer  : GET / HEAD only (and never /staff*, /activity*)
 *   /auth/* : every signed-in role (me, change own password)
 */
export function authorize(role: Role, method: string, rawPath: string): boolean {
  const path = normalizePath(rawPath);
  if (path === '/auth' || path.startsWith('/auth/')) return true;
  if (role === 'owner') return true;
  if (RESTRICTED.test(path)) return false;
  if (role === 'manager') return true;
  const m = (method ?? '').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}
