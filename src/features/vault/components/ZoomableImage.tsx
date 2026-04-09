/**
 * VaultCalc - Zoomable Image Component
 *
 * Uses native Android ZoomableImageView for buttery smooth 60fps
 * pinch-to-zoom and double-tap zoom via ScaleGestureDetector.
 *
 * Features:
 * - Pinch to zoom (1x → 5x) with real multi-touch
 * - Double tap to zoom (toggles fit ↔ 2.5x)
 * - Pan / drag when zoomed in
 * - Smooth bounce-back to bounds
 * - Focal point zoom (zooms into pinch center)
 *
 * @see VAULT-005
 */

import React from 'react';
import { requireNativeComponent, type ViewProps } from 'react-native';

interface NativeZoomableImageProps extends ViewProps {
  uri?: string;
  onSingleTap?: () => void;
}

const NativeZoomableImageView =
  requireNativeComponent<NativeZoomableImageProps>('ZoomableImageView');

interface ZoomableImageProps {
  source: { uri: string } | number;
  style?: object;
  onSingleTap?: () => void;
}

export function ZoomableImage({ source, style, onSingleTap }: ZoomableImageProps): React.JSX.Element {
  const uri = typeof source === 'object' && 'uri' in source ? source.uri : undefined;

  return (
    <NativeZoomableImageView
      style={[{ flex: 1 }, style]}
      uri={uri}
      onSingleTap={onSingleTap}
    />
  );
}
