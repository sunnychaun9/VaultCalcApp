/**
 * VaultCalc - Onboarding SVG Illustrations
 *
 * Premium, theme-aware SVG illustrations for the onboarding flow.
 * Each illustration conveys a specific emotion tied to the slide.
 *
 * Screen 1: Exposed phone — fear/urgency
 * Screen 2: Calculator disguise — curiosity
 * Screen 3: Intruder camera capture — safety
 * Screen 4: Shield lock — trust/action
 */

import React from 'react';
import Svg, {
  Path,
  Circle,
  Rect,
  G,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Text as SvgText,
} from 'react-native-svg';

interface IllustrationProps {
  size?: number;
}

// ── Shared palette ────────────────────────────────────────────

const ACCENT = '#3B82F6';
const ACCENT_LIGHT = '#60A5FA';
const DANGER = '#EF4444';
const DANGER_LIGHT = '#FCA5A5';
const SURFACE_DARK = '#1E293B';
const SURFACE_DARKER = '#0F172A';
const TEXT_MUTED = '#64748B';
const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';

// ── Screen 1: Exposed Phone ──────────────────────────────────

export function ExposedPhoneIllustration({ size = 200 }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="phoneBg1" x1="60" y1="20" x2="140" y2="180" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={SURFACE_DARK} />
          <Stop offset="1" stopColor={SURFACE_DARKER} />
        </LinearGradient>
        <LinearGradient id="dangerGlow" x1="100" y1="0" x2="100" y2="200" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={DANGER} stopOpacity="0.15" />
          <Stop offset="1" stopColor={DANGER} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>

      {/* Danger glow background */}
      <Circle cx="100" cy="100" r="90" fill="url(#dangerGlow)" />

      {/* Phone body */}
      <Rect x="60" y="24" width="80" height="152" rx="14" fill="url(#phoneBg1)" stroke={TEXT_MUTED} strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Phone screen */}
      <Rect x="66" y="42" width="68" height="116" rx="4" fill={SURFACE_DARKER} fillOpacity="0.8" />

      {/* Photo thumbnails on screen (exposed) */}
      <Rect x="70" y="46" width="28" height="24" rx="3" fill={ACCENT} fillOpacity="0.2" stroke={ACCENT} strokeWidth="0.8" strokeOpacity="0.3" />
      <Rect x="102" y="46" width="28" height="24" rx="3" fill={SUCCESS} fillOpacity="0.15" stroke={SUCCESS} strokeWidth="0.8" strokeOpacity="0.3" />
      <Rect x="70" y="74" width="28" height="24" rx="3" fill={WARNING} fillOpacity="0.15" stroke={WARNING} strokeWidth="0.8" strokeOpacity="0.3" />
      <Rect x="102" y="74" width="28" height="24" rx="3" fill={ACCENT_LIGHT} fillOpacity="0.15" stroke={ACCENT_LIGHT} strokeWidth="0.8" strokeOpacity="0.3" />
      <Rect x="70" y="102" width="60" height="24" rx="3" fill={DANGER} fillOpacity="0.1" stroke={DANGER} strokeWidth="0.8" strokeOpacity="0.3" />

      {/* Eye icon (watching) */}
      <G transform="translate(85, 135)">
        <Path d="M0 6 Q15 -2 30 6 Q15 14 0 6 Z" stroke={DANGER_LIGHT} strokeWidth="1.5" fill="none" strokeOpacity="0.8" />
        <Circle cx="15" cy="6" r="4" stroke={DANGER_LIGHT} strokeWidth="1.5" fill={DANGER} fillOpacity="0.3" />
        <Circle cx="15" cy="6" r="1.5" fill={DANGER_LIGHT} fillOpacity="0.8" />
      </G>

      {/* Warning triangles floating around phone */}
      <G transform="translate(38, 40)">
        <Path d="M8 0 L16 14 L0 14 Z" stroke={DANGER} strokeWidth="1.5" fill={DANGER} fillOpacity="0.15" strokeLinejoin="round" />
        <Line x1="8" y1="5" x2="8" y2="9" stroke={DANGER} strokeWidth="1.5" strokeLinecap="round" />
        <Circle cx="8" cy="11.5" r="0.8" fill={DANGER} />
      </G>

      <G transform="translate(148, 60)">
        <Path d="M7 0 L14 12 L0 12 Z" stroke={DANGER} strokeWidth="1.2" fill={DANGER} fillOpacity="0.1" strokeLinejoin="round" strokeOpacity="0.7" />
        <Line x1="7" y1="4" x2="7" y2="7.5" stroke={DANGER} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
        <Circle cx="7" cy="9.5" r="0.7" fill={DANGER} fillOpacity="0.7" />
      </G>

      {/* Scan lines (breach effect) */}
      <Line x1="66" y1="55" x2="134" y2="55" stroke={DANGER} strokeWidth="0.5" strokeOpacity="0.3" />
      <Line x1="66" y1="85" x2="134" y2="85" stroke={DANGER} strokeWidth="0.5" strokeOpacity="0.2" />
      <Line x1="66" y1="115" x2="134" y2="115" stroke={DANGER} strokeWidth="0.5" strokeOpacity="0.15" />

      {/* Notch */}
      <Rect x="88" y="28" width="24" height="6" rx="3" fill={SURFACE_DARKER} />
    </Svg>
  );
}

// ── Screen 2: Calculator Disguise ────────────────────────────

export function CalculatorDisguiseIllustration({ size = 200 }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="phoneBg2" x1="60" y1="20" x2="140" y2="180" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={SURFACE_DARK} />
          <Stop offset="1" stopColor={SURFACE_DARKER} />
        </LinearGradient>
        <LinearGradient id="accentGlow" x1="100" y1="0" x2="100" y2="200" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={ACCENT} stopOpacity="0.12" />
          <Stop offset="1" stopColor={ACCENT} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>

      {/* Subtle glow */}
      <Circle cx="100" cy="100" r="90" fill="url(#accentGlow)" />

      {/* Phone body */}
      <Rect x="60" y="24" width="80" height="152" rx="14" fill="url(#phoneBg2)" stroke={TEXT_MUTED} strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Phone screen */}
      <Rect x="66" y="42" width="68" height="116" rx="4" fill={SURFACE_DARKER} fillOpacity="0.8" />

      {/* Calculator display */}
      <Rect x="70" y="46" width="60" height="28" rx="4" fill={SURFACE_DARK} fillOpacity="0.6" />
      <SvgText x="124" y="66" fill="#F1F5F9" fontSize="16" fontFamily="monospace" textAnchor="end" fontWeight="400">1234=</SvgText>

      {/* Calculator button grid */}
      {/* Row 1 */}
      <Rect x="70" y="80" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="86" y="80" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="102" y="80" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="118" y="80" width="13" height="13" rx="3" fill={ACCENT} fillOpacity="0.2" stroke={ACCENT} strokeWidth="0.6" strokeOpacity="0.4" />

      {/* Row 2 */}
      <Rect x="70" y="96" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="86" y="96" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="102" y="96" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="118" y="96" width="13" height="13" rx="3" fill={ACCENT} fillOpacity="0.2" stroke={ACCENT} strokeWidth="0.6" strokeOpacity="0.4" />

      {/* Row 3 */}
      <Rect x="70" y="112" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="86" y="112" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="102" y="112" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      {/* Equals button highlighted */}
      <Rect x="118" y="112" width="13" height="13" rx="3" fill={ACCENT} fillOpacity="0.6" stroke={ACCENT} strokeWidth="1" />
      <SvgText x="124.5" y="122" fill="#FFFFFF" fontSize="8" textAnchor="middle" fontWeight="600">=</SvgText>

      {/* Row 4 */}
      <Rect x="70" y="128" width="29" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="102" y="128" width="13" height="13" rx="3" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="0.6" strokeOpacity="0.3" />
      <Rect x="118" y="128" width="13" height="13" rx="3" fill={ACCENT} fillOpacity="0.2" stroke={ACCENT} strokeWidth="0.6" strokeOpacity="0.4" />

      {/* Notch */}
      <Rect x="88" y="28" width="24" height="6" rx="3" fill={SURFACE_DARKER} />

      {/* Lock/vault peek icon (bottom right, suggesting hidden vault) */}
      <G transform="translate(148, 140)">
        <Circle cx="12" cy="12" r="16" fill={ACCENT} fillOpacity="0.1" stroke={ACCENT} strokeWidth="1" strokeOpacity="0.3" />
        <Rect x="5" y="11" width="14" height="10" rx="2" stroke={ACCENT_LIGHT} strokeWidth="1.5" fill={ACCENT} fillOpacity="0.15" />
        <Path d="M8 11 V8 A4 4 0 0 1 16 8 V11" stroke={ACCENT_LIGHT} strokeWidth="1.5" fill="none" />
        <Circle cx="12" cy="16" r="1.5" fill={ACCENT_LIGHT} />
      </G>

      {/* Arrow from equals to lock */}
      <Path d="M134 119 Q145 125 150 140" stroke={ACCENT} strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" fill="none" />
    </Svg>
  );
}

// ── Screen 3: Intruder Camera ────────────────────────────────

export function IntruderCameraIllustration({ size = 200 }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="safeGlow" x1="100" y1="0" x2="100" y2="200" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={SUCCESS} stopOpacity="0.1" />
          <Stop offset="1" stopColor={ACCENT} stopOpacity="0.03" />
        </LinearGradient>
        <LinearGradient id="phoneBg3" x1="60" y1="20" x2="140" y2="180" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={SURFACE_DARK} />
          <Stop offset="1" stopColor={SURFACE_DARKER} />
        </LinearGradient>
      </Defs>

      {/* Safety glow */}
      <Circle cx="100" cy="100" r="90" fill="url(#safeGlow)" />

      {/* Phone body */}
      <Rect x="60" y="24" width="80" height="152" rx="14" fill="url(#phoneBg3)" stroke={TEXT_MUTED} strokeWidth="1.5" strokeOpacity="0.4" />

      {/* Phone screen */}
      <Rect x="66" y="42" width="68" height="116" rx="4" fill={SURFACE_DARKER} fillOpacity="0.8" />

      {/* Intruder silhouette on screen */}
      <Circle cx="100" cy="72" r="14" fill={TEXT_MUTED} fillOpacity="0.2" stroke={TEXT_MUTED} strokeWidth="1" strokeOpacity="0.4" />
      <Path d="M82 110 Q82 90 100 90 Q118 90 118 110" fill={TEXT_MUTED} fillOpacity="0.15" stroke={TEXT_MUTED} strokeWidth="1" strokeOpacity="0.3" />

      {/* Camera flash ring */}
      <Circle cx="100" cy="85" r="32" stroke={DANGER} strokeWidth="1.5" fill="none" strokeOpacity="0.3" strokeDasharray="4 4" />

      {/* Camera viewfinder corners */}
      {/* Top-left */}
      <Path d="M72 52 L72 46 L78 46" stroke={DANGER_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
      {/* Top-right */}
      <Path d="M128 52 L128 46 L122 46" stroke={DANGER_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
      {/* Bottom-left */}
      <Path d="M72 148 L72 154 L78 154" stroke={DANGER_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.7" />
      {/* Bottom-right */}
      <Path d="M128 148 L128 154 L122 154" stroke={DANGER_LIGHT} strokeWidth="2" fill="none" strokeLinecap="round" strokeOpacity="0.7" />

      {/* "INTRUDER DETECTED" label */}
      <Rect x="74" y="120" width="52" height="16" rx="3" fill={DANGER} fillOpacity="0.15" stroke={DANGER} strokeWidth="0.8" strokeOpacity="0.4" />
      <SvgText x="100" y="131" fill={DANGER_LIGHT} fontSize="6.5" textAnchor="middle" fontWeight="600" letterSpacing="0.5">CAPTURED</SvgText>

      {/* Timestamp */}
      <SvgText x="100" y="148" fill={TEXT_MUTED} fontSize="5.5" textAnchor="middle" fontWeight="400">03:42 AM</SvgText>

      {/* Notch */}
      <Rect x="88" y="28" width="24" height="6" rx="3" fill={SURFACE_DARKER} />

      {/* Camera icon (front camera capturing) */}
      <G transform="translate(94, 28)">
        <Circle cx="6" cy="3" r="2.5" fill={SUCCESS} fillOpacity="0.8" />
      </G>

      {/* Shield badge */}
      <G transform="translate(140, 28)">
        <Circle cx="14" cy="14" r="16" fill={SUCCESS} fillOpacity="0.12" stroke={SUCCESS} strokeWidth="1" strokeOpacity="0.3" />
        <Path d="M14 4 L24 9 L24 16 Q24 24 14 27 Q4 24 4 16 L4 9 Z" fill={SUCCESS} fillOpacity="0.15" stroke={SUCCESS} strokeWidth="1.2" strokeOpacity="0.6" />
        <Path d="M10 15 L13 18 L19 11" stroke={SUCCESS} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

// ── Screen 4: Shield CTA ─────────────────────────────────────

export function ShieldCTAIllustration({ size = 200 }: IllustrationProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="shieldGrad" x1="100" y1="30" x2="100" y2="170" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={ACCENT} stopOpacity="0.25" />
          <Stop offset="1" stopColor={ACCENT} stopOpacity="0.05" />
        </LinearGradient>
        <LinearGradient id="innerShield" x1="100" y1="50" x2="100" y2="160" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={ACCENT_LIGHT} />
          <Stop offset="1" stopColor={ACCENT} />
        </LinearGradient>
      </Defs>

      {/* Outer pulse rings */}
      <Circle cx="100" cy="100" r="95" stroke={ACCENT} strokeWidth="0.5" fill="none" strokeOpacity="0.1" />
      <Circle cx="100" cy="100" r="85" stroke={ACCENT} strokeWidth="0.8" fill="none" strokeOpacity="0.15" />
      <Circle cx="100" cy="100" r="75" stroke={ACCENT} strokeWidth="1" fill="none" strokeOpacity="0.2" />

      {/* Shield glow bg */}
      <Circle cx="100" cy="100" r="65" fill="url(#shieldGrad)" />

      {/* Main shield shape */}
      <Path
        d="M100 40 L140 58 L140 95 Q140 135 100 160 Q60 135 60 95 L60 58 Z"
        fill={ACCENT}
        fillOpacity="0.12"
        stroke="url(#innerShield)"
        strokeWidth="2"
      />

      {/* Inner shield */}
      <Path
        d="M100 55 L130 68 L130 93 Q130 125 100 145 Q70 125 70 93 L70 68 Z"
        fill={ACCENT}
        fillOpacity="0.08"
        stroke={ACCENT_LIGHT}
        strokeWidth="1"
        strokeOpacity="0.4"
      />

      {/* Lock icon inside shield */}
      <Rect x="90" y="95" width="20" height="16" rx="3" fill={ACCENT} fillOpacity="0.2" stroke={ACCENT_LIGHT} strokeWidth="1.5" />
      <Path d="M94 95 V88 A6 6 0 0 1 106 88 V95" stroke={ACCENT_LIGHT} strokeWidth="1.5" fill="none" />
      <Circle cx="100" cy="103" r="2.5" fill={ACCENT_LIGHT} />
      <Line x1="100" y1="105" x2="100" y2="108" stroke={ACCENT_LIGHT} strokeWidth="1.5" strokeLinecap="round" />

      {/* Checkmark badge */}
      <G transform="translate(120, 60)">
        <Circle cx="12" cy="12" r="12" fill={SUCCESS} fillOpacity="0.15" stroke={SUCCESS} strokeWidth="1.2" />
        <Path d="M7 12 L10.5 15.5 L17 8.5" stroke={SUCCESS} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>

      {/* Floating particles */}
      <Circle cx="45" cy="60" r="2" fill={ACCENT_LIGHT} fillOpacity="0.3" />
      <Circle cx="155" cy="70" r="1.5" fill={ACCENT_LIGHT} fillOpacity="0.25" />
      <Circle cx="50" cy="140" r="1.8" fill={ACCENT_LIGHT} fillOpacity="0.2" />
      <Circle cx="150" cy="145" r="2.2" fill={ACCENT_LIGHT} fillOpacity="0.15" />
      <Circle cx="40" cy="100" r="1.2" fill={SUCCESS} fillOpacity="0.3" />
      <Circle cx="160" cy="105" r="1" fill={SUCCESS} fillOpacity="0.25" />
    </Svg>
  );
}
