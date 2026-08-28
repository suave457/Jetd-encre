export const JET_DENCRE_STORAGE_PREFIXES = Object.freeze(["jde.", "projet-debat-v01-"]);

function browserStorage(name) {
  try {
    return typeof window !== "undefined" ? window[name] : null;
  } catch {
    return null;
  }
}

export function clearOwnedStorage(storage, prefixes = JET_DENCRE_STORAGE_PREFIXES) {
  const report = { available: Boolean(storage), matched: 0, removed: 0, failed: [] };
  if (!storage) return report;

  let keys;
  try {
    keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  } catch {
    return { ...report, available: false };
  }

  for (const key of keys) {
    if (!prefixes.some((prefix) => key.startsWith(prefix))) continue;
    report.matched += 1;
    try {
      storage.removeItem(key);
      report.removed += 1;
    } catch {
      report.failed.push(key);
    }
  }

  return report;
}

export function clearJetDencreLocalData(options = {}) {
  const local = clearOwnedStorage(
    Object.prototype.hasOwnProperty.call(options, "localStorage") ? options.localStorage : browserStorage("localStorage"),
  );
  const session = clearOwnedStorage(
    Object.prototype.hasOwnProperty.call(options, "sessionStorage") ? options.sessionStorage : browserStorage("sessionStorage"),
  );
  return {
    ok: local.available && session.available && local.failed.length === 0 && session.failed.length === 0,
    localStorage: local,
    sessionStorage: session,
  };
}
