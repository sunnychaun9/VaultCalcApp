/**
 * VaultCalc - Intruder Camera Service
 *
 * Public exports for intruder camera capture.
 *
 * @see FEATURE_INDEX.md SEC-001
 */

export {
  captureIntruderPhoto,
  hasCameraPermission,
  requestCameraPermission,
} from './intruderCameraService';
export type { CaptureResult } from './nativeIntruderCamera';

export { recordIntruderAttempt } from './intruderLogService';
export type { IntruderLogResult } from './intruderLogService';
