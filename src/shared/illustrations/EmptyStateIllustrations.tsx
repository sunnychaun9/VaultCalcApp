/**
 * VaultCalc - Empty State SVG Illustrations
 *
 * Lightweight, theme-aware SVG illustrations for empty states.
 * Each illustration is a self-contained component that accepts
 * `size` and color props derived from the current theme.
 *
 * Design language: rounded strokes, soft shapes, minimal detail.
 * Consistent 120x120 viewport with 2dp stroke.
 */

import React from 'react';
import Svg, { Path, Circle, Rect, G, Defs, LinearGradient, Stop } from 'react-native-svg';

interface IllustrationProps {
  size?: number;
  /** Primary stroke/fill color (usually textTertiary) */
  color: string;
  /** Accent highlight color */
  accent: string;
}

/**
 * Images empty — stylized photo frame with mountain/sun
 */
export function ImagesIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="imgGrad" x1="20" y1="30" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.12" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </LinearGradient>
      </Defs>
      {/* Background card */}
      <Rect x="18" y="25" width="84" height="70" rx="12" fill="url(#imgGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.3" />
      {/* Sun */}
      <Circle cx="45" cy="48" r="8" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Mountain */}
      <Path d="M18 82 L48 55 L62 68 L75 50 L102 82 Z" fill={color} fillOpacity="0.08" stroke={color} strokeWidth="2" strokeOpacity="0.3" strokeLinejoin="round" />
      {/* Corner accent */}
      <Circle cx="90" cy="38" r="3" fill={accent} fillOpacity="0.4" />
    </Svg>
  );
}

/**
 * Videos empty — play button within a frame
 */
export function VideosIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="vidGrad" x1="20" y1="30" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.12" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </LinearGradient>
      </Defs>
      {/* Video frame */}
      <Rect x="18" y="30" width="84" height="60" rx="10" fill="url(#vidGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.3" />
      {/* Play triangle */}
      <Path d="M52 50 L52 70 L70 60 Z" fill={accent} fillOpacity="0.35" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" strokeLinejoin="round" />
      {/* Film strip dots */}
      <Circle cx="30" cy="36" r="2" fill={color} fillOpacity="0.2" />
      <Circle cx="38" cy="36" r="2" fill={color} fillOpacity="0.2" />
      <Circle cx="30" cy="84" r="2" fill={color} fillOpacity="0.2" />
      <Circle cx="38" cy="84" r="2" fill={color} fillOpacity="0.2" />
    </Svg>
  );
}

/**
 * Audio empty — music note with sound waves
 */
export function AudioIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Circular background */}
      <Circle cx="60" cy="60" r="38" fill={accent} fillOpacity="0.06" stroke={color} strokeWidth="2" strokeOpacity="0.15" />
      {/* Music note */}
      <Path d="M55 42 L55 72 C55 77 50 80 45 78 C40 76 38 71 41 68 C44 65 50 65 55 68" stroke={color} strokeWidth="2.5" strokeOpacity="0.4" strokeLinecap="round" fill="none" />
      <Path d="M55 42 L72 36 L72 62 C72 67 67 70 62 68 C57 66 55 61 58 58 C61 55 67 55 72 58" stroke={color} strokeWidth="2.5" strokeOpacity="0.4" strokeLinecap="round" fill="none" />
      {/* Sound waves */}
      <Path d="M80 50 C84 54 84 66 80 70" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" strokeLinecap="round" fill="none" />
      <Path d="M86 44 C92 51 92 69 86 76" stroke={accent} strokeWidth="1.5" strokeOpacity="0.2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * Documents empty — stacked papers with lines
 */
export function DocumentsIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="docGrad" x1="30" y1="20" x2="90" y2="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.1" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.03" />
        </LinearGradient>
      </Defs>
      {/* Back page */}
      <Rect x="36" y="22" width="56" height="72" rx="6" fill={color} fillOpacity="0.04" stroke={color} strokeWidth="1.5" strokeOpacity="0.15" />
      {/* Front page */}
      <Rect x="28" y="28" width="56" height="72" rx="8" fill="url(#docGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.3" />
      {/* Dog-ear fold */}
      <Path d="M68 28 L84 28 L84 44 Z" fill={color} fillOpacity="0.06" stroke={color} strokeWidth="1.5" strokeOpacity="0.2" />
      {/* Text lines */}
      <Path d="M38 50 L68 50" stroke={color} strokeWidth="2" strokeOpacity="0.15" strokeLinecap="round" />
      <Path d="M38 60 L62 60" stroke={color} strokeWidth="2" strokeOpacity="0.15" strokeLinecap="round" />
      <Path d="M38 70 L56 70" stroke={color} strokeWidth="2" strokeOpacity="0.15" strokeLinecap="round" />
      {/* Accent dot */}
      <Circle cx="75" cy="80" r="3" fill={accent} fillOpacity="0.3" />
    </Svg>
  );
}

/**
 * Albums/Folders empty — open folder
 */
export function AlbumsIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="foldGrad" x1="20" y1="40" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.12" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </LinearGradient>
      </Defs>
      {/* Folder back */}
      <Path d="M22 42 L22 88 C22 91 24 93 27 93 L93 93 C96 93 98 91 98 88 L98 48 C98 45 96 43 93 43 L56 43 L50 35 C49 33 47 32 45 32 L27 32 C24 32 22 34 22 37 Z" fill="url(#foldGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.3" />
      {/* Folder tab */}
      <Path d="M22 37 C22 34 24 32 27 32 L45 32 C47 32 49 33 50 35 L56 43" stroke={color} strokeWidth="2" strokeOpacity="0.3" fill="none" />
      {/* Plus sign */}
      <Path d="M60 60 L60 76" stroke={accent} strokeWidth="2" strokeOpacity="0.4" strokeLinecap="round" />
      <Path d="M52 68 L68 68" stroke={accent} strokeWidth="2" strokeOpacity="0.4" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Notes empty — pencil with paper
 */
export function NotesIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Paper */}
      <Rect x="30" y="24" width="52" height="72" rx="8" fill={accent} fillOpacity="0.06" stroke={color} strokeWidth="2" strokeOpacity="0.25" />
      {/* Lines on paper */}
      <Path d="M40 44 L68 44" stroke={color} strokeWidth="1.5" strokeOpacity="0.12" strokeLinecap="round" />
      <Path d="M40 54 L64 54" stroke={color} strokeWidth="1.5" strokeOpacity="0.12" strokeLinecap="round" />
      <Path d="M40 64 L58 64" stroke={color} strokeWidth="1.5" strokeOpacity="0.12" strokeLinecap="round" />
      {/* Pencil */}
      <G transform="rotate(-45, 82, 72)">
        <Rect x="76" y="42" width="12" height="40" rx="2" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4" />
        <Path d="M76 82 L82 92 L88 82 Z" fill={accent} fillOpacity="0.3" stroke={accent} strokeWidth="1.5" strokeOpacity="0.4" />
      </G>
    </Svg>
  );
}

/**
 * Favorites empty — star outline with sparkles
 */
export function FavoritesIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Star */}
      <Path d="M60 28 L68 48 L90 50 L74 64 L78 86 L60 76 L42 86 L46 64 L30 50 L52 48 Z" fill={accent} fillOpacity="0.08" stroke={color} strokeWidth="2" strokeOpacity="0.3" strokeLinejoin="round" />
      {/* Sparkles */}
      <Circle cx="92" cy="34" r="2.5" fill={accent} fillOpacity="0.4" />
      <Circle cx="28" cy="40" r="2" fill={accent} fillOpacity="0.3" />
      <Circle cx="96" cy="72" r="1.5" fill={accent} fillOpacity="0.25" />
    </Svg>
  );
}

/**
 * Search empty — magnifying glass with X
 */
export function SearchIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Magnifying glass circle */}
      <Circle cx="52" cy="52" r="26" fill={accent} fillOpacity="0.06" stroke={color} strokeWidth="2.5" strokeOpacity="0.3" />
      {/* Handle */}
      <Path d="M72 72 L92 92" stroke={color} strokeWidth="3" strokeOpacity="0.3" strokeLinecap="round" />
      {/* X inside */}
      <Path d="M44 44 L60 60" stroke={accent} strokeWidth="2" strokeOpacity="0.35" strokeLinecap="round" />
      <Path d="M60 44 L44 60" stroke={accent} strokeWidth="2" strokeOpacity="0.35" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Shield / Security — for intruder detection empty state
 */
export function ShieldIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="shieldGrad" x1="60" y1="20" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.15" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.03" />
        </LinearGradient>
      </Defs>
      {/* Shield shape */}
      <Path d="M60 22 L90 36 L90 62 C90 78 76 92 60 98 C44 92 30 78 30 62 L30 36 Z" fill="url(#shieldGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.3" strokeLinejoin="round" />
      {/* Checkmark */}
      <Path d="M46 60 L56 70 L76 48" stroke={accent} strokeWidth="3" strokeOpacity="0.45" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
