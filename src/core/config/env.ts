export function env(name: string) {
  return process.env[name]?.trim() || undefined;
}

export function requireEnv(name: string) {
  const value = env(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function schemaName() {
  return env("DB_SCHEMA") || "openpath";
}
