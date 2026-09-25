// All calls to the backend go through here.
// - same-origin cookies carry the session (the browser can't read the cookie)
// - the X-Requested-With header is required by the server's CSRF check
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Listeners told when the session ends or a password change is forced
const authListeners = new Set();
export const onAuthProblem = (fn) => (authListeners.add(fn), () => authListeners.delete(fn));

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { "X-Requested-With": "stagnes", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your internet connection.", 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(data.error || "Something went wrong.", res.status, data.code);
    if (err.code === "UNAUTHENTICATED" || err.code === "PASSWORD_CHANGE_REQUIRED") authListeners.forEach((fn) => fn(err));
    throw err;
  }
  return data;
}
