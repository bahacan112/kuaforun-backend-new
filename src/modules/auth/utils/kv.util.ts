// Sadece memory-based storage - Redis tamamen devre dışı
type Entry = { value: string; expireAt?: number };

const mem = new Map<string, Entry>();

// Redis her zaman kullanılamaz olarak ayarla
function _isRedisAvailable(): boolean {
  return false;
}

export async function kvSet(
  key: string,
  value: string,
  opts?: { EX?: number }
): Promise<void> {
  console.log(
    "kvSet called with key:",
    key,
    "value length:",
    value.length,
    "opts:",
    opts
  );
  console.log("Using memory fallback for kvSet (Redis disabled)");
  const expireAt = opts?.EX ? Date.now() + opts.EX * 1000 : undefined;
  mem.set(key, { value, expireAt });
  console.log("Memory kvSet successful");
}

export async function kvGet(key: string): Promise<string | null> {
  console.log("kvGet called with key:", key);
  const entry = mem.get(key);
  if (!entry) return null;
  if (entry.expireAt && Date.now() > entry.expireAt) {
    mem.delete(key);
    return null;
  }
  return entry.value;
}

export async function kvDel(key: string): Promise<void> {
  console.log("kvDel called with key:", key);
  mem.delete(key);
}
