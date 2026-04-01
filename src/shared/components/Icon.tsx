/**
 * VaultCalc - Icon Component
 *
 * Centralized icon system using Lucide icons for consistent,
 * professional UI across the app. Stroke-style icons at 24dp
 * standard / 20dp dense.
 *
 * Usage:
 *   <Icon name="settings" size={24} color={themeColors.textPrimary} />
 *
 * For pressable icons with feedback:
 *   <IconButton name="arrow-left" onPress={goBack} color={c.textPrimary} />
 */

import React from 'react';
import { Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '@shared/hooks/useAnimations';
import {
  ArrowLeft,
  ArrowUpDown,
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  Clock,
  EllipsisVertical,
  Eye,
  EyeOff,
  FileText,
  FileSpreadsheet,
  FileJson,
  Archive,
  Film,
  Folder,
  FolderOpen,
  Grid3x3,
  Heart,
  Image as ImageIcon,
  Key,
  List,
  Lock,
  Music,
  Pencil,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  Volume2,
  X,
  Calculator,
  Fingerprint,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Shuffle,
  ListMusic,
  MapPin,
  Scan,
} from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';

/**
 * Icon name map — every emoji in the app maps to a Lucide icon here.
 * Single source of truth for icon selection.
 */
const ICON_MAP = {
  // Navigation
  'arrow-left': ArrowLeft,
  'chevron-right': ChevronRight,
  'x': X,

  // Actions
  'search': Search,
  'settings': Settings,
  'trash': Trash2,
  'share': Share2,
  'pencil': Pencil,
  'check': Check,
  'more-vertical': EllipsisVertical,

  // Content types
  'image': ImageIcon,
  'film': Film,
  'music': Music,
  'file-text': FileText,
  'file-spreadsheet': FileSpreadsheet,
  'file-json': FileJson,
  'archive': Archive,
  'folder': Folder,
  'folder-open': FolderOpen,

  // Security
  'lock': Lock,
  'key': Key,
  'shield': Shield,
  'shield-check': ShieldCheck,
  'fingerprint': Fingerprint,
  'scan': Scan,
  'alert-triangle': AlertTriangle,
  'camera': Camera,
  'eye': Eye,
  'eye-off': EyeOff,
  'smartphone': Smartphone,

  // Location
  'map-pin': MapPin,

  // State
  'star': Star,
  'heart': Heart,
  'clock': Clock,

  // Layout
  'grid': Grid3x3,
  'list': List,
  'arrow-up-down': ArrowUpDown,

  // Calculator
  'calculator': Calculator,

  // Audio player
  'play': Play,
  'pause': Pause,
  'skip-back': SkipBack,
  'skip-forward': SkipForward,
  'rotate-ccw': RotateCcw,
  'rotate-cw': RotateCw,
  'shuffle': Shuffle,
  'list-music': ListMusic,
  'volume': Volume2,
} as const;

export type IconName = keyof typeof ICON_MAP;

/** Standard icon sizes */
export const ICON_SIZE = {
  /** Dense UI (action bars, inline badges) */
  sm: 16,
  /** Default icon size */
  md: 24,
  /** Large display icons (empty states, auth) */
  lg: 48,
  /** Hero icons */
  xl: 64,
} as const;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Render a Lucide icon by name with consistent defaults.
 */
export function Icon({
  name,
  size = ICON_SIZE.md,
  color = '#1A1A1A',
  strokeWidth = 2,
  fill = 'none',
  style,
}: IconProps): React.JSX.Element {
  const LucideIcon = ICON_MAP[name];
  return (
    <LucideIcon
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      fill={fill}
      style={style as LucideProps['style']}
    />
  );
}

interface IconButtonProps extends IconProps {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  /** Hit target size — defaults to 40 */
  hitSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Pressable icon button with spring-physics feedback.
 * Hit target is always >= 40dp for accessibility.
 */
export function IconButton({
  onPress,
  disabled = false,
  accessibilityLabel,
  hitSize = 40,
  containerStyle,
  ...iconProps
}: IconButtonProps): React.JSX.Element {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation({
    scaleDown: 0.88,
    opacityDown: 0.6,
  });

  return (
    <Animated.View style={[animatedStyle, disabled && styles.disabled]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.iconButton,
          { width: hitSize, height: hitSize },
          containerStyle,
        ]}
      >
        <Icon {...iconProps} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  disabled: {
    opacity: 0.3,
  },
});
