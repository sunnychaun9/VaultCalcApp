/**
 * VaultCalc - Settings Row Component
 *
 * Premium settings row with icon, title, optional subtitle,
 * and trailing control (toggle, chevron, value text).
 *
 * Variants:
 * - Navigation: icon + title + subtitle? + chevron
 * - Toggle: icon + title + subtitle? + PremiumSwitch
 * - Value: icon + title + subtitle? + value text
 * - Destructive: red-tinted for dangerous actions
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useThemeColors, type ColorTokens, typography, spacing } from '@shared/theme';
import { Icon, type IconName } from '@shared/components/Icon';
import { PremiumSwitch } from '@shared/components/PremiumSwitch';

interface SettingsRowBaseProps {
  /** Lucide icon name */
  icon: IconName;
  /** Primary label */
  title: string;
  /** Optional helper text below title */
  subtitle?: string;
  /** Whether to show bottom divider (default true) */
  showDivider?: boolean;
  /** Highlight row with accent icon color */
  highlighted?: boolean;
  /** Red-tinted destructive action */
  destructive?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

interface NavigationRowProps extends SettingsRowBaseProps {
  type: 'navigation';
  onPress: () => void;
  /** Optional trailing value text (e.g. "PIN", "30s") */
  value?: string;
}

interface ToggleRowProps extends SettingsRowBaseProps {
  type: 'toggle';
  value: boolean;
  onValueChange: (value: boolean) => void;
}

interface ValueRowProps extends SettingsRowBaseProps {
  type: 'value';
  value: string;
  /** Optional value color override */
  valueColor?: string;
  onPress?: () => void;
}

export type SettingsRowProps = NavigationRowProps | ToggleRowProps | ValueRowProps;

export function SettingsRow(props: SettingsRowProps): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const {
    icon,
    title,
    subtitle,
    showDivider = true,
    highlighted = false,
    destructive = false,
    disabled = false,
  } = props;

  const iconColor = destructive
    ? themeColors.error
    : highlighted
      ? themeColors.accent
      : themeColors.textSecondary;

  const titleColor = destructive
    ? themeColors.error
    : themeColors.textPrimary;

  // ── Inner content (shared across all types) ──
  const content = (
    <>
      {/* Leading icon */}
      <View style={[styles.iconBox, highlighted && styles.iconBoxHighlighted]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>

      {/* Text column */}
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle != null && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Trailing control */}
      {props.type === 'toggle' && (
        <PremiumSwitch
          value={props.value}
          onValueChange={props.onValueChange}
          disabled={disabled}
          trackColorOff={themeColors.surfaceContainerHigh}
          trackColorOn={themeColors.accent}
          thumbColor={themeColors.surface}
        />
      )}
      {props.type === 'navigation' && (
        <View style={styles.trailing}>
          {props.value != null && (
            <Text style={styles.valueText}>{props.value}</Text>
          )}
          <Icon name="chevron-right" size={18} color={themeColors.textTertiary} />
        </View>
      )}
      {props.type === 'value' && (
        <Text style={[styles.valueText, props.valueColor ? { color: props.valueColor } : null]}>
          {props.value}
        </Text>
      )}
    </>
  );

  // ── Pressable wrapper (navigation/value) or plain View (toggle) ──
  if (props.type === 'toggle') {
    return (
      <>
        <View style={[styles.row, disabled && styles.rowDisabled]}>
          {content}
        </View>
        {showDivider && <View style={styles.divider} />}
      </>
    );
  }

  const onPress = props.type === 'navigation' ? props.onPress : props.onPress;

  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={disabled || !onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {content}
      </Pressable>
      {showDivider && <View style={styles.divider} />}
    </>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  rowPressed: {
    backgroundColor: c.surfaceContainerHigh,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconBoxHighlighted: {
    backgroundColor: c.accent + '18', // 10% accent tint
  },
  textColumn: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.bodyLarge,
    color: c.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  valueText: {
    ...typography.bodyMedium,
    color: c.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginLeft: 36 + spacing.base + spacing.md, // align with text, not icon
  },
});
