import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export interface InstalledApp {
  packageName: string;
  appName: string;
  /** Base64 PNG without a data: prefix. */
  icon?: string;
}

export interface EnforcementState {
  active: boolean;
  indefinitelyDisabled: boolean;
  /** Epoch ms a pause ends at, or 0 when not paused. */
  pausedUntil: number;
}

export interface BoundariesNativeModule {
  hasPasswordsSet(): Promise<boolean>;
  setupPasswords(unlockPw: string, masterPw: string): Promise<boolean>;
  verifyUnlockPassword(pw: string): Promise<boolean>;
  verifyMasterPassword(pw: string): Promise<boolean>;
  changeUnlockPassword(masterPw: string, newPw: string): Promise<boolean>;
  changeMasterPassword(currentMasterPw: string, newPw: string): Promise<boolean>;

  getInstalledApps(): Promise<InstalledApp[]>;
  /** JSON array of AppRule. */
  getRules(): Promise<string>;
  setRules(json: string): Promise<boolean>;
  /** JSON object of {[pkg]: AppUsage}. */
  getUsageToday(): Promise<string>;

  getEnforcementState(): Promise<EnforcementState>;
  /** Resolves with the epoch ms enforcement resumes at. */
  pauseWithUnlockPassword(unlockPw: string): Promise<number>;
  disableWithMasterPassword(masterPw: string): Promise<boolean>;
  enable(): Promise<boolean>;

  isAccessibilityServiceEnabled(): Promise<boolean>;
  openAccessibilitySettings(): Promise<void>;
  /** True if Shizuku turned the service on; false if Shizuku isn't running or granted. */
  enableAccessibilityViaShizuku(): Promise<boolean>;

  isDeviceAdminActive(): Promise<boolean>;
  requestDeviceAdmin(): Promise<void>;

  isShizukuRunning(): Promise<boolean>;
  isShizukuPermissionGranted(): Promise<boolean>;
  requestShizukuPermission(): Promise<void>;

  startEnforcementService(): Promise<void>;
  /** JSON {surface, text, accent} (#RRGGBB) for the messages the background service draws. */
  setAppearance(json: string): Promise<void>;
  openAppSettings(): Promise<void>;
}

/** Android only: other platforms expose no API for watching or stopping other apps. */
export const Boundaries: BoundariesNativeModule | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<BoundariesNativeModule>('ClaritardBoundaries') : null;
