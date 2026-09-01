import { Redirect } from 'expo-router';

import { useAuth } from '@/providers/AuthProvider';

export default function AuthCallbackScreen() {
  const { error, isAuthenticated } = useAuth();

  if (isAuthenticated) return <Redirect href="/" />;
  if (error) return <Redirect href="/sign-in" />;

  return null;
}
