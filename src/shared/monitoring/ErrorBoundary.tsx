import { ErrorBoundary as RouterErrorBoundary, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { reportError } from './index';

/** Reports render errors caught by Expo Router and keeps its retry screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, 'route.render');
  }, [error]);
  return <RouterErrorBoundary error={error} retry={retry} />;
}
