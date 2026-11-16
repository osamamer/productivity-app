import type { InstalledApp } from '@/services/boundaries';

// Installed apps (with icons) from the last list load, so the rule editor need not reload them all.
const apps = new Map<string, InstalledApp>();

export function rememberInstalledApps(list: InstalledApp[]) {
  apps.clear();
  for (const app of list) apps.set(app.packageName, app);
}

export function installedApp(packageName: string): InstalledApp | undefined {
  return apps.get(packageName);
}
