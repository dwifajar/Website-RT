# Admin Authentication Stability Fix — Dusun Dawung RT 04 / RW 01

This release fixes the `/admin/` page redirecting back to `login.html` immediately after login.

Changes:
- Admin access is validated from the live Supabase Auth session + `profiles.role`.
- Roles accepted by the admin guard: `admin`, `ketua_rt`, `super_admin`.
- `rt-data.js` no longer independently redirects the browser.
- Login routing now sends `super_admin` to `/admin/`.
- Admin critical scripts use a cache-busting query string.

No Supabase SQL changes are required for this frontend fix.
