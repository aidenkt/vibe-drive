import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

let pending: Promise<string> | null = null;

function loadHandle() {
  pending ??= AsyncStorage.getItem('vibe-drive-handle').then(async (stored) => {
    if (stored) return stored;
    const handle = `driver-${Math.random().toString(36).slice(2, 8)}`;
    await AsyncStorage.setItem('vibe-drive-handle', handle);
    return handle;
  });
  return pending;
}

export function useHandle() {
  const [handle, setHandle] = useState<string | null>(null);
  useEffect(() => { void loadHandle().then(setHandle); }, []);
  return handle;
}
