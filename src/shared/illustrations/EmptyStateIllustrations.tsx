/**
 * VaultCalc - Empty State SVG Illustrations
 *
 * Expressive, theme-aware SVG illustrations for empty states.
 * Each illustration conveys emotion and context, not just absence.
 *
 * Design language: rounded strokes, soft gradients, layered depth,
 * floating particles for life. Consistent 120x120 viewport.
 */

import React from 'react';
import Svg, { Path, Circle, Rect, G, Defs, LinearGradient, Stop, Line } from 'react-native-svg';

interface IllustrationProps {
  size?: number;
  /** Primary stroke/fill color (usually textTertiary) */
  color: string;
  /** Accent highlight color */
  accent: string;
}

/**
 * Images empty — polaroid-style frame with dashed outline + sparkle hint
 */
export function ImagesIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="imgGrad" x1="20" y1="25" x2="100" y2="95" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.14" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.03" />
        </LinearGradient>
      </Defs>
      {/* Soft glow */}
      <Circle cx="60" cy="58" r="42" fill={accent} fillOpacity="0.04" />
      {/* Back polaroid (tilted) */}
      <G transform="rotate(-8, 60, 60)">
        <Rect x="28" y="24" width="56" height="68" rx="6" fill={color} fillOpacity="0.04" stroke={color} strokeWidth="1.5" strokeOpacity="0.12" />
      </G>
      {/* Front polaroid */}
      <Rect x="30" y="22" width="60" height="72" rx="8" fill="url(#imgGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.25" strokeDasharray="6 4" />
      {/* Sun in photo area */}
      <Circle cx="50" cy="46" r="8" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" />
      {/* Mountain silhouette */}
      <Path d="M30 72 L50 50 L62 62 L75 46 L90 72 Z" fill={color} fillOpacity="0.06" stroke={color} strokeWidth="1.5" strokeOpacity="0.2" strokeLinejoin="round" />
      {/* Plus hint */}
      <Circle cx="60" cy="58" r="12" fill={accent} fillOpacity="0.08" stroke={accent} strokeWidth="1.5" strokeOpacity="0.25" />
      <Line x1="60" y1="52" x2="60" y2="64" stroke={accent} strokeWidth="1.8" strokeOpacity="0.35" strokeLinecap="round" />
      <Line x1="54" y1="58" x2="66" y2="58" stroke={accent} strokeWidth="1.8" strokeOpacity="0.35" strokeLinecap="round" />
      {/* Floating sparkles */}
      <Circle cx="96" cy="30" r="2" fill={accent} fillOpacity="0.35" />
      <Circle cx="22" cy="44" r="1.5" fill={accent} fillOpacity="0.25" />
      <Circle cx="100" cy="70" r="1.2" fill={accent} fillOpacity="0.2" />
    </Svg>
  );
}

/**
 * Videos empty — film reel frame with play hint
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
      {/* Soft glow */}
      <Circle cx="60" cy="60" r="42" fill={accent} fillOpacity="0.04" />
      {/* Video frame */}
      <Rect x="20" y="30" width="80" height="56" rx="10" fill="url(#vidGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.25" strokeDasharray="6 4" />
      {/* Film sprocket holes */}
      <Circle cx="30" cy="36" r="2.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeOpacity="0.15" />
      <Circle cx="30" cy="80" r="2.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeOpacity="0.15" />
      <Circle cx="90" cy="36" r="2.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeOpacity="0.15" />
      <Circle cx="90" cy="80" r="2.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1" strokeOpacity="0.15" />
      {/* Play button circle */}
      <Circle cx="60" cy="58" r="14" fill={accent} fillOpacity="0.1" stroke={accent} strokeWidth="1.5" strokeOpacity="0.3" />
      {/* Play triangle */}
      <Path d="M55 50 L55 66 L68 58 Z" fill={accent} fillOpacity="0.3" stroke={accent} strokeWidth="1.5" strokeOpacity="0.5" strokeLinejoin="round" />
      {/* Timeline bar */}
      <Rect x="30" y="92" width="60" height="3" rx="1.5" fill={color} fillOpacity="0.08" />
      <Rect x="30" y="92" width="20" height="3" rx="1.5" fill={accent} fillOpacity="0.2" />
      {/* Sparkle */}
      <Circle cx="98" cy="26" r="1.5" fill={accent} fillOpacity="0.3" />
    </Svg>
  );
}

/**
 * Audio empty — headphones with sound waves
 */
export function AudioIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Soft glow */}
      <Circle cx="60" cy="60" r="42" fill={accent} fillOpacity="0.04" />
      {/* Headphone band */}
      <Path d="M32 62 C32 42 42 28 60 28 C78 28 88 42 88 62" stroke={color} strokeWidth="2.5" strokeOpacity="0.25" fill="none" strokeLinecap="round" />
      {/* Left earpiece */}
      <Rect x="26" y="58" width="14" height="22" rx="7" fill={accent} fillOpacity="0.1" stroke={color} strokeWidth="2" strokeOpacity="0.25" />
      {/* Right earpiece */}
      <Rect x="80" y="58" width="14" height="22" rx="7" fill={accent} fillOpacity="0.1" stroke={color} strokeWidth="2" strokeOpacity="0.25" />
      {/* Sound waves (center) */}
      <Path d="M52 56 C50 60 50 64 52 68" stroke={accent} strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
      <Path d="M56 52 C52 58 52 66 56 72" stroke={accent} strokeWidth="1.5" strokeOpacity="0.22" strokeLinecap="round" fill="none" />
      <Path d="M68 56 C70 60 70 64 68 68" stroke={accent} strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
      <Path d="M64 52 C68 58 68 66 64 72" stroke={accent} strokeWidth="1.5" strokeOpacity="0.22" strokeLinecap="round" fill="none" />
      {/* Music note hint */}
      <Path d="M58 60 L58 54 L64 52 L64 58" stroke={accent} strokeWidth="1.2" strokeOpacity="0.35" strokeLinecap="round" fill="none" />
      <Circle cx="56" cy="61" r="2.5" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1" strokeOpacity="0.3" />
      <Circle cx="62" cy="59" r="2.5" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="1" strokeOpacity="0.3" />
      {/* Sparkles */}
      <Circle cx="60" cy="92" r="1.5" fill={accent} fillOpacity="0.2" />
      <Circle cx="100" cy="48" r="1.2" fill={accent} fillOpacity="0.25" />
    </Svg>
  );
}

/**
 * Documents empty — paper with folded corner and lock hint
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
      {/* Soft glow */}
      <Circle cx="58" cy="60" r="42" fill={accent} fillOpacity="0.04" />
      {/* Back page (offset) */}
      <Rect x="36" y="22" width="54" height="72" rx="6" fill={color} fillOpacity="0.04" stroke={color} strokeWidth="1.5" strokeOpacity="0.12" />
      {/* Front page */}
      <Rect x="28" y="26" width="54" height="72" rx="8" fill="url(#docGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.25" strokeDasharray="6 4" />
      {/* Dog-ear fold */}
      <Path d="M66 26 L82 26 L82 42 Z" fill={color} fillOpacity="0.06" stroke={color} strokeWidth="1.5" strokeOpacity="0.15" />
      {/* Text lines */}
      <Path d="M38 50 L66 50" stroke={color} strokeWidth="1.8" strokeOpacity="0.12" strokeLinecap="round" />
      <Path d="M38 60 L60 60" stroke={color} strokeWidth="1.8" strokeOpacity="0.12" strokeLinecap="round" />
      <Path d="M38 70 L54 70" stroke={color} strokeWidth="1.8" strokeOpacity="0.12" strokeLinecap="round" />
      {/* Lock badge */}
      <G transform="translate(72, 68)">
        <Circle cx="12" cy="12" r="14" fill={accent} fillOpacity="0.08" stroke={accent} strokeWidth="1.2" strokeOpacity="0.25" />
        <Rect x="6" y="12" width="12" height="9" rx="2" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" fill={accent} fillOpacity="0.1" />
        <Path d="M9 12 V9 A3 3 0 0 1 15 9 V12" stroke={accent} strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
        <Circle cx="12" cy="16.5" r="1.2" fill={accent} fillOpacity="0.4" />
      </G>
      {/* Sparkle */}
      <Circle cx="20" cy="36" r="1.5" fill={accent} fillOpacity="0.25" />
    </Svg>
  );
}

/**
 * Albums empty — stacked photo cards with plus
 */
export function AlbumsIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="albGrad" x1="20" y1="30" x2="100" y2="90" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.12" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </LinearGradient>
      </Defs>
      {/* Soft glow */}
      <Circle cx="60" cy="60" r="42" fill={accent} fillOpacity="0.04" />
      {/* Back card (tilted left) */}
      <G transform="rotate(-6, 60, 60)">
        <Rect x="26" y="28" width="60" height="60" rx="10" fill={color} fillOpacity="0.04" stroke={color} strokeWidth="1.5" strokeOpacity="0.12" />
      </G>
      {/* Middle card (tilted right) */}
      <G transform="rotate(4, 60, 58)">
        <Rect x="28" y="26" width="60" height="60" rx="10" fill={color} fillOpacity="0.04" stroke={color} strokeWidth="1.5" strokeOpacity="0.15" />
      </G>
      {/* Front card */}
      <Rect x="28" y="28" width="64" height="60" rx="10" fill="url(#albGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.25" strokeDasharray="6 4" />
      {/* Small image thumbnails inside */}
      <Rect x="36" y="36" width="20" height="16" rx="4" fill={accent} fillOpacity="0.08" stroke={accent} strokeWidth="1" strokeOpacity="0.15" />
      <Rect x="60" y="36" width="24" height="16" rx="4" fill={color} fillOpacity="0.05" stroke={color} strokeWidth="1" strokeOpacity="0.1" />
      {/* Plus button */}
      <Circle cx="60" cy="68" r="10" fill={accent} fillOpacity="0.1" stroke={accent} strokeWidth="1.5" strokeOpacity="0.3" />
      <Line x1="60" y1="63" x2="60" y2="73" stroke={accent} strokeWidth="1.8" strokeOpacity="0.4" strokeLinecap="round" />
      <Line x1="55" y1="68" x2="65" y2="68" stroke={accent} strokeWidth="1.8" strokeOpacity="0.4" strokeLinecap="round" />
      {/* Sparkles */}
      <Circle cx="98" cy="32" r="2" fill={accent} fillOpacity="0.3" />
      <Circle cx="18" cy="50" r="1.5" fill={accent} fillOpacity="0.2" />
      {/* Label bar */}
      <Rect x="36" y="96" width="48" height="4" rx="2" fill={color} fillOpacity="0.06" />
    </Svg>
  );
}

/**
 * Notes empty — journal with pencil and sparkle
 */
export function NotesIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Soft glow */}
      <Circle cx="56" cy="60" r="42" fill={accent} fillOpacity="0.04" />
      {/* Paper */}
      <Rect x="30" y="22" width="52" height="72" rx="8" fill={accent} fillOpacity="0.06" stroke={color} strokeWidth="2" strokeOpacity="0.2" strokeDasharray="6 4" />
      {/* Spine binding dots */}
      <Circle cx="30" cy="36" r="1.5" fill={color} fillOpacity="0.15" />
      <Circle cx="30" cy="50" r="1.5" fill={color} fillOpacity="0.15" />
      <Circle cx="30" cy="64" r="1.5" fill={color} fillOpacity="0.15" />
      <Circle cx="30" cy="78" r="1.5" fill={color} fillOpacity="0.15" />
      {/* Writing lines */}
      <Path d="M40 42 L68 42" stroke={color} strokeWidth="1.5" strokeOpacity="0.1" strokeLinecap="round" />
      <Path d="M40 52 L64 52" stroke={color} strokeWidth="1.5" strokeOpacity="0.1" strokeLinecap="round" />
      <Path d="M40 62 L58 62" stroke={color} strokeWidth="1.5" strokeOpacity="0.1" strokeLinecap="round" />
      {/* Pencil (diagonal) */}
      <G transform="rotate(-35, 88, 70)">
        <Rect x="82" y="38" width="10" height="44" rx="2" fill={accent} fillOpacity="0.15" stroke={accent} strokeWidth="1.5" strokeOpacity="0.3" />
        <Path d="M82 82 L87 92 L92 82 Z" fill={accent} fillOpacity="0.25" stroke={accent} strokeWidth="1.5" strokeOpacity="0.3" />
        <Rect x="82" y="38" width="10" height="6" rx="1" fill={accent} fillOpacity="0.08" stroke={accent} strokeWidth="1" strokeOpacity="0.2" />
      </G>
      {/* Writing sparkle (ink flowing) */}
      <Circle cx="72" cy="76" r="2" fill={accent} fillOpacity="0.35" />
      <Circle cx="78" cy="82" r="1.2" fill={accent} fillOpacity="0.2" />
      <Circle cx="22" cy="32" r="1.5" fill={accent} fillOpacity="0.2" />
    </Svg>
  );
}

/**
 * Favorites empty — heart with sparkle constellation
 */
export function FavoritesIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Outer glow ring */}
      <Circle cx="60" cy="58" r="42" fill={accent} fillOpacity="0.04" stroke={accent} strokeWidth="0.5" strokeOpacity="0.08" />
      {/* Star (main) */}
      <Path d="M60 28 L68 48 L90 50 L74 64 L78 86 L60 76 L42 86 L46 64 L30 50 L52 48 Z" fill={accent} fillOpacity="0.08" stroke={color} strokeWidth="2" strokeOpacity="0.2" strokeLinejoin="round" />
      {/* Inner star highlight */}
      <Path d="M60 38 L65 50 L78 52 L69 60 L72 74 L60 68 L48 74 L51 60 L42 52 L55 50 Z" fill={accent} fillOpacity="0.06" stroke={accent} strokeWidth="1" strokeOpacity="0.15" strokeLinejoin="round" />
      {/* Sparkle constellation */}
      <Circle cx="94" cy="32" r="3" fill={accent} fillOpacity="0.35" />
      <Circle cx="100" cy="26" r="1.2" fill={accent} fillOpacity="0.2" />
      <Circle cx="26" cy="36" r="2.5" fill={accent} fillOpacity="0.3" />
      <Circle cx="20" cy="42" r="1" fill={accent} fillOpacity="0.2" />
      <Circle cx="96" cy="74" r="1.8" fill={accent} fillOpacity="0.25" />
      <Circle cx="24" cy="78" r="1.5" fill={accent} fillOpacity="0.2" />
      {/* Twinkle lines */}
      <Line x1="92" y1="30" x2="96" y2="26" stroke={accent} strokeWidth="1" strokeOpacity="0.2" strokeLinecap="round" />
      <Line x1="24" y1="34" x2="28" y2="30" stroke={accent} strokeWidth="1" strokeOpacity="0.15" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Search empty — magnifying glass over empty landscape
 */
export function SearchIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* Soft glow */}
      <Circle cx="52" cy="52" r="42" fill={accent} fillOpacity="0.03" />
      {/* Magnifying glass circle */}
      <Circle cx="50" cy="50" r="26" fill={accent} fillOpacity="0.05" stroke={color} strokeWidth="2.5" strokeOpacity="0.25" />
      {/* Inner lens reflection */}
      <Path d="M36 40 C40 34 48 32 54 36" stroke={color} strokeWidth="1.5" strokeOpacity="0.1" strokeLinecap="round" fill="none" />
      {/* Handle */}
      <Path d="M70 70 L90 90" stroke={color} strokeWidth="4" strokeOpacity="0.2" strokeLinecap="round" />
      <Path d="M70 70 L90 90" stroke={color} strokeWidth="2.5" strokeOpacity="0.15" strokeLinecap="round" />
      {/* Empty result hint — dashed circle inside */}
      <Circle cx="50" cy="50" r="12" stroke={color} strokeWidth="1.5" strokeOpacity="0.1" strokeDasharray="4 3" fill="none" />
      {/* Question mark inside */}
      <Path d="M46 45 C46 40 50 38 53 40 C56 42 54 46 50 47 L50 50" stroke={accent} strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
      <Circle cx="50" cy="55" r="1.2" fill={accent} fillOpacity="0.3" />
      {/* Floating dots (scattered results) */}
      <Circle cx="96" cy="28" r="2" fill={color} fillOpacity="0.1" />
      <Circle cx="20" cy="72" r="1.5" fill={color} fillOpacity="0.08" />
      <Circle cx="88" cy="80" r="1.8" fill={color} fillOpacity="0.06" />
    </Svg>
  );
}

/**
 * Shield / Security — serene shield with checkmark (no intruders)
 */
export function ShieldIllustration({ size = 120, color, accent }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Defs>
        <LinearGradient id="shieldGrad" x1="60" y1="18" x2="60" y2="100" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={accent} stopOpacity="0.18" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.03" />
        </LinearGradient>
      </Defs>
      {/* Pulse rings */}
      <Circle cx="60" cy="58" r="52" stroke={accent} strokeWidth="0.5" fillOpacity="0" strokeOpacity="0.06" />
      <Circle cx="60" cy="58" r="46" stroke={accent} strokeWidth="0.8" fillOpacity="0" strokeOpacity="0.08" />
      {/* Shield shape */}
      <Path d="M60 20 L92 34 L92 60 C92 78 78 92 60 98 C42 92 28 78 28 60 L28 34 Z" fill="url(#shieldGrad)" stroke={color} strokeWidth="2" strokeOpacity="0.25" strokeLinejoin="round" />
      {/* Inner shield */}
      <Path d="M60 30 L82 40 L82 58 C82 72 72 84 60 88 C48 84 38 72 38 58 L38 40 Z" fill={accent} fillOpacity="0.04" stroke={accent} strokeWidth="1" strokeOpacity="0.12" strokeLinejoin="round" />
      {/* Checkmark */}
      <Path d="M46 58 L56 68 L76 46" stroke={accent} strokeWidth="3.5" strokeOpacity="0.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Sparkles around shield */}
      <Circle cx="98" cy="24" r="2" fill={accent} fillOpacity="0.3" />
      <Circle cx="22" cy="30" r="1.5" fill={accent} fillOpacity="0.2" />
      <Circle cx="96" cy="76" r="1.2" fill={accent} fillOpacity="0.15" />
      <Circle cx="24" cy="80" r="1.8" fill={accent} fillOpacity="0.2" />
    </Svg>
  );
}
