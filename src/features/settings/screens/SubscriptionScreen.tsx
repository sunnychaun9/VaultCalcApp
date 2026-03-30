/**
 * VaultCalc - Subscription Screen (PREMIUM-001, PREMIUM-002)
 *
 * Subscription screen showing plan tiers, pricing, and feature lists.
 * Wired to Google Play Billing for real purchases.
 *
 * @see 07-Monetization-Model.md Section 6
 * @see FEATURE_INDEX.md PREMIUM-001, PREMIUM-002
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, type ColorTokens, typography, spacing, layout } from '@shared/theme';
import { useSettingsStore } from '@store/settingsStore';
import {
  getBillingService,
  useFeatureGate,
  type BillingProductInfo,
} from '@services/billing';
import { alert } from '@store/alertStore';

type PlanType = 'yearly' | 'monthly' | 'lifetime' | 'remove_ads';

const PREMIUM_FEATURES = [
  'Remove All Ads',
  'Ad-Free Experience Forever',
  'Support Development',
] as const;

/** Map plan type to product ID */
const PLAN_PRODUCT_MAP: Record<PlanType, string> = {
  monthly: 'vaultcalc_premium_monthly',
  yearly: 'vaultcalc_premium_yearly',
  lifetime: 'vaultcalc_premium_lifetime',
  remove_ads: 'vaultcalc_remove_ads',
};

/** Fallback prices when Play Store query fails */
const FALLBACK_PRICES: Record<string, string> = {
  vaultcalc_premium_monthly: '$4.99',
  vaultcalc_premium_yearly: '$29.99',
  vaultcalc_premium_lifetime: '$79.99',
  vaultcalc_remove_ads: '$2.99',
};

function getProductPrice(products: BillingProductInfo[], productId: string): string {
  const product = products.find((p) => p.productId === productId);
  return product?.price || FALLBACK_PRICES[productId] || '';
}

function getOfferToken(products: BillingProductInfo[], productId: string): string | null {
  const product = products.find((p) => p.productId === productId);
  return product?.offerToken ?? null;
}

export function SubscriptionScreen(): React.JSX.Element {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { onActivity } = useActivityTracker();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');
  const [products, setProducts] = useState<BillingProductInfo[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const setPremiumStatus = useSettingsStore((s) => s.setPremiumStatus);
  const setPremiumPurchase = useSettingsStore((s) => s.setPremiumPurchase);

  const { isPremium } = useFeatureGate('removeAds');

  // Initialize billing and load products on mount
  useEffect(() => {
    let cancelled = false;
    const billing = getBillingService();

    async function init() {
      const initResult = await billing.initialize();
      if (cancelled) return;

      if (initResult.success) {
        const productsResult = await billing.loadProducts();
        if (!cancelled && productsResult.success && productsResult.data) {
          setProducts(productsResult.data);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Resolved prices (Play Store or fallback)
  const yearlyPrice = getProductPrice(products, PLAN_PRODUCT_MAP.yearly);
  const monthlyPrice = getProductPrice(products, PLAN_PRODUCT_MAP.monthly);
  const lifetimePrice = getProductPrice(products, PLAN_PRODUCT_MAP.lifetime);
  const removeAdsPrice = getProductPrice(products, PLAN_PRODUCT_MAP.remove_ads);

  // Calculate monthly equivalent for yearly plan
  const yearlyProduct = products.find((p) => p.productId === PLAN_PRODUCT_MAP.yearly);
  const yearlyMonthly = yearlyProduct
    ? `${yearlyProduct.currencyCode === 'USD' ? '$' : ''}${(yearlyProduct.priceMicros / 12 / 1_000_000).toFixed(2)}/month`
    : '$2.50/month';

  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleSelectPlan = useCallback((plan: PlanType) => {
    onActivity();
    setSelectedPlan(plan);
  }, [onActivity]);

  const handleStartTrial = useCallback(async () => {
    onActivity();
    if (isPremium || isPurchasing) return;

    const billing = getBillingService();
    const productId = PLAN_PRODUCT_MAP[selectedPlan];
    const offerToken = getOfferToken(products, productId);

    setIsPurchasing(true);
    const result = await billing.purchaseProduct(productId, offerToken);
    setIsPurchasing(false);

    if (result.success && result.purchase) {
      setPremiumStatus('premium');
      setPremiumPurchase(result.purchase.productId, result.purchase.purchaseToken);
      alert('Welcome to Premium!', 'Your purchase was successful. Enjoy all premium features!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } else if (result.cancelled) {
      // User cancelled — no-op
    } else if (result.error) {
      alert('Purchase Failed', result.error);
    }
  }, [onActivity, isPremium, isPurchasing, selectedPlan, products, setPremiumStatus, setPremiumPurchase, navigation]);

  const handleRestore = useCallback(async () => {
    onActivity();
    if (isRestoring) return;

    const billing = getBillingService();
    setIsRestoring(true);
    const result = await billing.restorePurchases();
    setIsRestoring(false);

    if (result.success && result.data) {
      const activePurchase = billing.getActivePremiumPurchase(result.data);
      if (activePurchase) {
        setPremiumStatus('premium');
        setPremiumPurchase(activePurchase.productId, activePurchase.purchaseToken);
        alert('Purchases Restored', 'Your premium access has been restored.');
      } else {
        alert('No Purchases Found', 'No active premium purchases were found for this account.');
      }
    } else {
      alert('Restore Failed', 'Unable to check for existing purchases. Please try again.');
    }
  }, [onActivity, isRestoring, setPremiumStatus, setPremiumPurchase]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Premium</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            {isPremium ? "You're Premium!" : 'VaultCalc Premium'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isPremium
              ? 'You have access to all premium features'
              : 'Unlock the full power of your private vault'}
          </Text>
        </View>

        {/* Feature list card */}
        <View style={styles.sectionCard}>
          {PREMIUM_FEATURES.map((feature, index) => (
            <React.Fragment key={feature}>
              {index > 0 && <View style={styles.rowDivider} />}
              <View style={styles.featureRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.featureLabel}>{feature}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {!isPremium && (
          <>
            {/* Plan cards row */}
            <View style={styles.planCardsRow}>
              {/* Yearly plan */}
              <Pressable
                onPress={() => handleSelectPlan('yearly')}
                style={[
                  styles.planCard,
                  selectedPlan === 'yearly' && styles.planCardSelected,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select yearly plan, ${yearlyPrice} per year`}
              >
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>BEST VALUE</Text>
                  </View>
                </View>
                <Text style={styles.planTitle}>Yearly</Text>
                <Text style={styles.planPrice}>{yearlyPrice}/year</Text>
                <Text style={styles.planSubPrice}>{yearlyMonthly}</Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>Save 50%</Text>
                </View>
              </Pressable>

              {/* Monthly plan */}
              <Pressable
                onPress={() => handleSelectPlan('monthly')}
                style={[
                  styles.planCard,
                  selectedPlan === 'monthly' && styles.planCardSelected,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select monthly plan, ${monthlyPrice} per month`}
              >
                <View style={styles.badgeRow}>
                  <View style={styles.badgeSpacer} />
                </View>
                <Text style={styles.planTitle}>Monthly</Text>
                <Text style={styles.planPrice}>{monthlyPrice}/month</Text>
              </Pressable>
            </View>

            {/* Lifetime card */}
            <Pressable
              onPress={() => handleSelectPlan('lifetime')}
              style={[
                styles.lifetimeCard,
                selectedPlan === 'lifetime' && styles.planCardSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Select lifetime plan, ${lifetimePrice} one-time`}
            >
              <View style={styles.lifetimeContent}>
                <View>
                  <Text style={styles.planTitle}>Lifetime</Text>
                  <Text style={styles.lifetimeSubtitle}>One-time purchase</Text>
                </View>
                <Text style={styles.lifetimePrice}>{lifetimePrice}</Text>
              </View>
            </Pressable>

            {/* Remove Ads — just want ad-free? One-time purchase */}
            <View style={styles.removeAdsDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or just remove ads</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={() => handleSelectPlan('remove_ads')}
              style={[
                styles.lifetimeCard,
                selectedPlan === 'remove_ads' && styles.planCardSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Remove ads for ${removeAdsPrice}`}
            >
              <View style={styles.lifetimeContent}>
                <View>
                  <Text style={styles.planTitle}>Remove Ads</Text>
                  <Text style={styles.lifetimeSubtitle}>One-time purchase</Text>
                </View>
                <Text style={styles.lifetimePrice}>{removeAdsPrice}</Text>
              </View>
            </Pressable>

            {/* CTA button */}
            <Pressable
              onPress={handleStartTrial}
              disabled={isPurchasing}
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && !isPurchasing && styles.ctaButtonPressed,
                isPurchasing && styles.ctaButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={selectedPlan === 'remove_ads' ? 'Remove Ads' : 'Start 7-day free trial'}
            >
              {isPurchasing ? (
                <ActivityIndicator color={themeColors.textOnAccent} />
              ) : (
                <Text style={styles.ctaButtonText}>
                  {selectedPlan === 'remove_ads' ? `Remove Ads — ${removeAdsPrice}` : 'Start 7-Day Free Trial'}
                </Text>
              )}
            </Pressable>

            {/* Footer links */}
            <Text style={styles.footerText}>
              Cancel anytime in Google Play settings
            </Text>
            <Pressable
              onPress={handleRestore}
              disabled={isRestoring}
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
            >
              <Text style={styles.restoreLink}>
                {isRestoring ? 'Restoring...' : 'Restore purchases'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: ColorTokens) => StyleSheet.create({
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
  backButtonText: {
    fontSize: 24,
    color: c.textPrimary,
  },
  title: {
    ...typography.titleLarge,
    color: c.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['3xl'],
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  heroTitle: {
    ...typography.headlineMedium,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...typography.bodyLarge,
    color: c.textSecondary,
    textAlign: 'center',
  },

  // Feature list
  sectionCard: {
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginLeft: layout.cardPadding,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.cardPadding,
    minHeight: layout.minTouchTarget,
  },
  checkmark: {
    ...typography.bodyLarge,
    color: c.success,
    marginRight: spacing.md,
  },
  featureLabel: {
    ...typography.bodyLarge,
    color: c.textPrimary,
  },

  // Plan cards row
  planCardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planCard: {
    flex: 1,
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    padding: layout.cardPadding,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: c.accent,
    backgroundColor: c.surfaceContainerLow,
  },
  badgeRow: {
    height: 20,
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: c.accent,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    ...typography.labelSmall,
    color: c.textOnAccent,
  },
  badgeSpacer: {
    height: 20,
  },
  planTitle: {
    ...typography.titleMedium,
    color: c.textPrimary,
    marginBottom: spacing.xs,
  },
  planPrice: {
    ...typography.bodyMedium,
    color: c.textPrimary,
    fontWeight: '600',
  },
  planSubPrice: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: spacing.xxs,
  },
  saveBadge: {
    marginTop: spacing.sm,
    backgroundColor: c.success,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  saveBadgeText: {
    ...typography.labelSmall,
    color: c.textOnAccent,
  },

  // Lifetime card
  lifetimeCard: {
    backgroundColor: c.surfaceContainer,
    borderRadius: layout.cardBorderRadius,
    padding: layout.cardPadding,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lifetimeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lifetimeSubtitle: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: spacing.xxs,
  },
  lifetimePrice: {
    ...typography.titleMedium,
    color: c.textPrimary,
    fontWeight: '600',
  },

  // Remove Ads divider
  removeAdsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: c.textTertiary,
  },

  // CTA
  ctaButton: {
    backgroundColor: c.accent,
    height: layout.buttonHeight,
    borderRadius: layout.buttonBorderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaButtonText: {
    ...typography.labelLarge,
    color: c.textOnAccent,
  },

  // Footer
  footerText: {
    ...typography.bodySmall,
    color: c.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  restoreLink: {
    ...typography.bodySmall,
    color: c.accent,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
