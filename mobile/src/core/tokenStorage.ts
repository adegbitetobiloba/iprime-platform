// Owner: Account 1. The login token lives in the phone's secure storage (Android Keystore / iOS Keychain).
import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from './session';

const KEY = 'iprime.session.token';

export const secureTokenStorage: TokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (t) => SecureStore.setItemAsync(KEY, t),
  remove: () => SecureStore.deleteItemAsync(KEY),
};
