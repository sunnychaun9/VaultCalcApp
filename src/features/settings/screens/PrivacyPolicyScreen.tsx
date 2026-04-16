/**
 * VaultCalc - Privacy Policy Screen
 *
 * In-app privacy policy display with option to open external URL.
 * Required for Play Store compliance — must clearly disclose
 * data collection, usage, and third-party sharing.
 *
 * @see Play Store Data Safety section requirements
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { IconButton } from '@shared/components/Icon';
import { useTranslation } from '@shared/i18n';

// TODO: Replace with your actual hosted privacy policy URL before release
const PRIVACY_POLICY_URL = 'https://vaultcalcapp.com/privacy-policy';

interface PolicySection {
  titleKey: string;
  content: string;
}

const POLICY_SECTIONS: PolicySection[] = [
  {
    titleKey: 'privacy_policy.section_overview',
    content:
      'VaultCalc ("we", "us", or "our") is a privacy-focused file vault application. We are committed to protecting your personal information. This Privacy Policy explains what data we access, why, and how it is handled.',
  },
  {
    titleKey: 'privacy_policy.section_device_data',
    content:
      'Your encrypted files, PINs, patterns, and vault contents are stored exclusively on your device. We never transmit, collect, or have access to your vault contents. All encryption and decryption happens locally using AES-256-GCM with keys derived via Argon2id, protected by the Android Keystore.',
  },
  {
    titleKey: 'privacy_policy.section_camera',
    content:
      'The app requests camera permission for the optional Intruder Detection feature. When enabled, the front camera captures a photo after failed unlock attempts to help you identify unauthorized access. These photos are stored only on your device and are never uploaded or shared. You can disable this feature and delete captured photos at any time in Settings.',
  },
  {
    titleKey: 'privacy_policy.section_storage',
    content:
      'Storage permission is required to import files (photos, videos, documents) into your encrypted vault and to export them when you choose. The app only accesses files you explicitly select. Imported files are encrypted immediately and the originals can optionally be deleted.',
  },
  {
    titleKey: 'privacy_policy.section_location',
    content:
      'If you enable Intruder Location Logging in Settings, the app records approximate location (coarse) when a failed unlock attempt occurs. This data is stored only on your device to help you determine where unauthorized access was attempted. Location is never collected during normal app use. This feature is off by default and can be disabled at any time.',
  },
  {
    titleKey: 'privacy_policy.section_google_drive',
    content:
      'If you connect your Google account for cloud backup, your encrypted vault data is uploaded to your personal Google Drive. We authenticate via Google Sign-In and only access Drive files created by VaultCalc. We do not access any other files in your Drive. Your Google account email is stored locally to display connection status.',
  },
  {
    titleKey: 'privacy_policy.section_advertising',
    content:
      'The free version displays ads served by Google AdMob. AdMob may collect device identifiers and usage data according to Google\'s privacy policy. We use the Google User Messaging Platform (UMP) to obtain your consent where required by law (e.g., GDPR). Premium subscribers do not see ads, and no ad-related data is collected for them.',
  },
  {
    titleKey: 'privacy_policy.section_purchases',
    content:
      'Premium subscriptions are processed by Google Play Billing. We do not collect or store payment information. Purchase status is verified through the Play Billing API.',
  },
  {
    titleKey: 'privacy_policy.section_not_collected',
    content:
      'We do not collect, transmit, or sell:\n\n• Your vault contents (photos, videos, documents, notes)\n• Your PIN, pattern, or biometric data\n• Your contacts, call logs, or messages\n• Browsing history or app usage analytics\n• Any personally identifiable information beyond what is described above',
  },
  {
    titleKey: 'privacy_policy.section_third_party',
    content:
      'The app integrates the following third-party services, each governed by their own privacy policies:\n\n• Google AdMob — ad serving (free tier only)\n• Google Play Billing — subscription management\n• Google Drive API — optional cloud backup\n• Google Sign-In — optional account authentication',
  },
  {
    titleKey: 'privacy_policy.section_sharing',
    content:
      'We do not sell, trade, or rent your personal data to third parties. Data is only shared with third-party services as described above, and only to provide the features you explicitly enable.',
  },
  {
    titleKey: 'privacy_policy.section_children',
    content:
      'VaultCalc is not directed at children under 13. We do not knowingly collect personal information from children.',
  },
  {
    titleKey: 'privacy_policy.section_changes',
    content:
      'We may update this Privacy Policy from time to time. Changes will be reflected in the app and on our website with an updated effective date.',
  },
  {
    titleKey: 'privacy_policy.section_contact',
    content:
      'If you have questions about this Privacy Policy, contact us at:\nprivacy@vaultcalcapp.com',
  },
];

export function PrivacyPolicyScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation();
  const { onActivity } = useActivityTracker();
  const { t } = useTranslation();

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleOpenExternal = useCallback(() => {
    onActivity();
    Linking.openURL(PRIVACY_POLICY_URL);
  }, [onActivity]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          name="arrow-left"
          onPress={handleBack}
          color={themeColors.textPrimary}
          accessibilityLabel="Go back"
          containerStyle={styles.backButton}
        />
        <Text style={styles.headerTitle}>{t('privacy_policy.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.effectiveDate}>
          {t('privacy_policy.effective_date')}
        </Text>

        {POLICY_SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </View>
        ))}

        {/* External link */}
        <Pressable
          onPress={handleOpenExternal}
          style={({ pressed }) => [
            styles.externalButton,
            pressed && styles.externalButtonPressed,
          ]}
          accessibilityRole="link"
          accessibilityLabel="View privacy policy online"
        >
          <Text style={styles.externalButtonText}>{t('privacy_policy.view_online')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      height: layout.topBarHeight,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      ...typography.titleLarge,
      color: c.textPrimary,
    },
    placeholder: {
      width: 40,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.base,
      paddingTop: spacing.md,
      paddingBottom: spacing['3xl'],
    },
    effectiveDate: {
      ...typography.bodySmall,
      color: c.textTertiary,
      marginBottom: spacing.xl,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.titleMedium,
      color: c.textPrimary,
      marginBottom: spacing.xs,
    },
    sectionContent: {
      ...typography.bodyMedium,
      color: c.textSecondary,
      lineHeight: 22,
    },
    externalButton: {
      alignSelf: 'center',
      marginTop: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing.md,
      borderRadius: layout.buttonBorderRadius,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      backgroundColor: c.surfaceContainer,
    },
    externalButtonPressed: {
      opacity: 0.7,
    },
    externalButtonText: {
      ...typography.labelLarge,
      color: c.accent,
    },
  });
