import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "shekinah:giving:history:v1";

export async function listGivingHistory() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveGivingHistory(items) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function upsertGivingTransaction(transaction) {
  if (!transaction?.id) return transaction;

  const existing = await listGivingHistory();
  const next = [
    transaction,
    ...existing.filter(item => item.id !== transaction.id)
  ].slice(0, 50);

  await saveGivingHistory(next);

  return transaction;
}

export async function clearGivingHistory() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
