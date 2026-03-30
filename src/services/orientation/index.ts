import { NativeModules } from 'react-native';

const { OrientationModule } = NativeModules;

/** Lock the screen to portrait orientation */
export function lockPortrait(): void {
  OrientationModule.lockPortrait();
}

/** Unlock to follow device sensor (respects system auto-rotate setting) */
export function unlockOrientation(): void {
  OrientationModule.unlockAll();
}
