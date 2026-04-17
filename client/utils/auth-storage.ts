import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./api";

const KEY = "arogyam.auth.user";

export async function saveAuthUser(user: AuthUser) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export async function loadAuthUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export async function clearAuthUser() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
