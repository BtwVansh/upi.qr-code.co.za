/**
 * Deployment paths for the static GitHub Pages project site.
 *
 * `NEXT_PUBLIC_BASE_PATH` is inlined at build time by Next.js. The default
 * matches the production site: https://btwvansh.github.io/upi-gen/
 */
export const BASE_PATH = (
  process.env.NEXT_PUBLIC_BASE_PATH || "/upi-gen"
).replace(/\/+$/, "");

/** Prefixes an app-relative path with the deployment base path. */
export function withBasePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!BASE_PATH) return normalized;
  return normalized === "/" ? `${BASE_PATH}/` : `${BASE_PATH}${normalized}`;
}

/** Removes the deployment base path from a browser pathname. */
export function stripBasePath(pathname: string): string {
  if (!BASE_PATH) return pathname;
  if (pathname === BASE_PATH) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length);
  }
  return pathname;
}
