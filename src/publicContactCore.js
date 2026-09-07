export function publicContactHref(email) {
  const address = String(email || '').trim();
  if (!/^[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(address)) return null;
  const domain = address.split('@')[1].toLowerCase();
  if (domain === 'invalid' || domain.endsWith('.invalid')) return null;
  return 'mailto:' + address;
}
