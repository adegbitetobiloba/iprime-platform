// Owner: Account 1.
import { useSyncExternalStore } from 'react';
import { session } from './api';
import type { SessionState } from './session';

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}
