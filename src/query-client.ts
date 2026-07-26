import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/src/api';

focusManager.setEventListener((setFocused) => {
  if (Platform.OS === 'web') return () => undefined;
  const subscription = AppState.addEventListener('change', (state) => {
    setFocused(state === 'active');
  });
  return () => subscription.remove();
});

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'almonium:query-cache:v1',
  throttleTime: 1_000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: 24 * 60 * 60 * 1_000,
  buster: 'mobile-v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) => {
      const scope = String(query.queryKey[0]);
      return (
        query.state.status === 'success' &&
        scope !== 'book-text' &&
        scope !== 'book-parallel'
      );
    },
  },
};
