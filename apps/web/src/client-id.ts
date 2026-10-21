/** Also works on the HTTP LAN reader, where randomUUID is not exposed. */
export function clientId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `r-${Date.now().toString(36)}-${Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('')}`;
}
