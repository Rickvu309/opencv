export async function sessionToken() {
  return undefined;
}

export async function setSessionCookie(_token: string, _expires?: Date) {}

export async function clearSessionCookie() {}

export async function currentUser() {
  return null;
}

export async function requireUser() {
  throw new Error("sign in needed");
}
