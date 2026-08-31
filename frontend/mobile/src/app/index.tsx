import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

export default function EntryScreen() {
  const { isAuthenticated } = useAuth();
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/sign-in'} />;
}
