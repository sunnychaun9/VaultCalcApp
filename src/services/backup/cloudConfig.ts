/**
 * VaultCalc - Cloud Backup Configuration
 *
 * Runtime cloud mode flag and singleton factory.
 * Switches between MockCloudBackupService (dev) and
 * ProductionCloudBackupService (prod).
 *
 * @see FEATURE_INDEX.md CLOUD-002
 */

import type { CloudMode } from './cloudTypes';
import type { CloudBackupService } from './cloudBackupServiceInterface';
import { MockCloudBackupService } from './MockCloudBackupService';
import { ProductionCloudBackupService } from './ProductionCloudBackupService';

/** Cloud mode — mock in dev builds, production in release */
export const CLOUD_MODE: CloudMode = __DEV__ ? 'mock' : 'production';

let instance: CloudBackupService | null = null;

/** Get the singleton CloudBackupService for the current mode */
export function getCloudBackupService(): CloudBackupService {
  if (instance === null) {
    instance = CLOUD_MODE === 'mock'
      ? new MockCloudBackupService()
      : new ProductionCloudBackupService();
  }
  return instance;
}

/** Reset singleton — test utility only */
export function _resetCloudBackupService(): void {
  instance = null;
}
