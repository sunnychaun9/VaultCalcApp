/**
 * VaultCalc - Subscription Screen (PREMIUM-001, PREMIUM-002)
 *
 * High-conversion premium paywall with:
 * - Gradient hero with shield icon
 * - Animated feature list with staggered entrance
 * - Monthly/Yearly plan cards with "Most Popular" badge
 * - Urgency banner ("Limited time offer")
 * - Trust signals and social proof
 * - Large "Start Free Trial" CTA with glow
 *
 * Psychology: urgency (limited offer) + trust (secure & private) +
 * anchoring (yearly savings shown) + social proof (badge)
 *
 * @see 07-Monetization-Model.md Section 6
 * @see FEATURE_INDEX.md PREMIUM-001, PREMIUM-002
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VaultStackParamList } from '@typedefs/navigation';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useActivityTracker } from '@features/auth';
import { useThemeColors, colors, type ColorTokens, spacing } from '@shared/theme';
import { Icon, IconButton } from '@shared/components/Icon';
import { useSettingsStore } from '@store/settingsStore';
import {
  getBillingService,
  useFeatureGate,
  type BillingProductInfo,
} from '@services/billing';
import { alert } from '@store/alertStore';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { trackEvent, type PlanParam } from '@services/analytics';
import { useTranslation } from '@shared/i18n';

// ── Types & Constants ─────────────────────────────────────────

type PlanType = 'yearly' | 'monthly' | 'lifetime' | 'remove_ads';

const PREMIUM_FEATURES = [
  { icon: 'eye-off' as const, labelKey: 'subscription.feature_no_ads', descKey: 'subscription.feature_no_ads_desc' },
  { icon: 'scan' as const, labelKey: 'subscription.feature_intruder', descKey: 'subscription.feature_intruder_desc' },
  { icon: 'shield' as const, labelKey: 'subscription.feature_cloud', descKey: 'subscription.feature_cloud_desc' },
  { icon: 'lock' as const, labelKey: 'subscription.feature_storage', descKey: 'subscription.feature_storage_desc' },
  { icon: 'eye-off' as const, labelKey: 'subscription.feature_decoy', descKey: 'subscription.feature_decoy_desc' },
] as const;

const PLAN_PRODUCT_MAP: Record<PlanType, string> = {
  monthly: 'vaultcalc_premium_monthly',
  yearly: 'vaultcalc_premium_yearly',
  lifetime: 'vaultcalc_premium_lifetime',
  remove_ads: 'vaultcalc_remove_ads',
};

const FALLBACK_PRICES: Record<string, string> = {
  vaultcalc_premium_monthly: '$2.99',
  vaultcalc_premium_yearly: '$9.99',
  vaultcalc_premium_lifetime: '$19.99',
  vaultcalc_remove_ads: '$1.99',
};

// ── Helpers ───────────────────────────────────────────────────

function getProductPrice(products: BillingProductInfo[], productId: string): string {
  const product = products.find((p) => p.productId === productId);
  return product?.price || FALLBACK_PRICES[productId] || '';
}

function getOfferToken(products: BillingProductInfo[], productId: string): string | null {
  const product = products.find((p) => p.productId === productId);
  return product?.offerToken ?? null;
}

// ── Gradient Background ───────────────────────────────────────

function HeroGradient(): React.JSX.Element {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1E3A5F" stopOpacity="1" />
            <Stop offset="0.5" stopColor="#0F172A" stopOpacity="1" />
            <Stop offset="1" stopColor="#0A0F1A" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGrad)" />
      </Svg>
    </View>
  );
}

// ── Animated Feature Row ──────────────────────────────────────

function FeatureRow({ icon, labelKey, descKey, index }: {
  icon: typeof PREMIUM_FEATURES[number]['icon'];
  labelKey: string;
  descKey: string;
  index: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const translateX = useSharedValue(30);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = 400 + index * 120;
    translateX.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 200 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
  }, [index, translateX, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[featureStyles.row, animStyle]}>
      <View style={featureStyles.iconCircle}>
        <Icon name={icon} size={18} color="#60A5FA" />
      </View>
      <View style={featureStyles.textCol}>
        <Text style={featureStyles.label}>{t(labelKey)}</Text>
        <Text style={featureStyles.desc}>{t(descKey)}</Text>
      </View>
      <Icon name="check" size={16} color="#22C55E" strokeWidth={3} />
    </Animated.View>
  );
}

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F1F5F9',
    letterSpacing: 0.1,
  },
  desc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});

// ── Main Component ────────────────────────────────────────────

export function SubscriptionScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const isDark = themeColors === colors.dark;
  const styles = useMemo(() => createStyles(themeColors, isDark), [themeColors, isDark]);
  const navigation = useNavigation<NativeStackNavigationProp<VaultStackParamList>>();
  const { onActivity } = useActivityTracker();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');
  // Track whether the user converted so we only fire paywall_dismissed on non-conversion unmount
  const convertedRef = useRef(false);

  // Fire paywall_shown on mount. The `trigger` param is best-effort: we
  // can't cleanly know why the screen was opened from here, so we bucket
  // the common cases (settings tap vs auto-prompt) by checking whether
  // a paywall was pending when we opened.
  useEffect(() => {
    const pending = useSettingsStore.getState().paywallPending;
    trackEvent('paywall_shown', {
      trigger: pending ? 'post_import_threshold' : 'settings_tap',
    });
    return () => {
      if (!convertedRef.current) {
        trackEvent('paywall_dismissed', { plan_viewed: selectedPlan as PlanParam });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [products, setProducts] = useState<BillingProductInfo[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showMorePlans, setShowMorePlans] = useState(false);

  const setPremiumStatus = useSettingsStore((s) => s.setPremiumStatus);
  const setPremiumPurchase = useSettingsStore((s) => s.setPremiumPurchase);
  const { isPremium } = useFeatureGate('removeAds');

  // ── Entrance animations ──
  const heroScale = useSharedValue(0.9);
  const heroOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(30);

  useEffect(() => {
    heroScale.value = withSpring(1, { damping: 16, stiffness: 120 });
    heroOpacity.value = withTiming(1, { duration: 500 });
    contentOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    ctaTranslateY.value = withDelay(800, withSpring(0, { damping: 16, stiffness: 180 }));
  }, [heroScale, heroOpacity, contentOpacity, ctaTranslateY]);

  const heroAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heroScale.value }],
    opacity: heroOpacity.value,
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const ctaAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ctaTranslateY.value }],
    opacity: interpolate(ctaTranslateY.value, [30, 0], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Billing ──
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

  const yearlyPrice = getProductPrice(products, PLAN_PRODUCT_MAP.yearly);
  const monthlyPrice = getProductPrice(products, PLAN_PRODUCT_MAP.monthly);
  const lifetimePrice = getProductPrice(products, PLAN_PRODUCT_MAP.lifetime);
  const removeAdsPrice = getProductPrice(products, PLAN_PRODUCT_MAP.remove_ads);

  const yearlyProduct = products.find((p) => p.productId === PLAN_PRODUCT_MAP.yearly);
  const yearlyMonthly = yearlyProduct
    ? `${yearlyProduct.currencyCode === 'USD' ? '$' : ''}${(yearlyProduct.priceMicros / 12 / 1_000_000).toFixed(2)}/mo`
    : '$0.83/mo';

  // ── Handlers ──
  const handleBack = useCallback(() => {
    onActivity();
    navigation.goBack();
  }, [onActivity, navigation]);

  const handleSelectPlan = useCallback((plan: PlanType) => {
    onActivity();
    setSelectedPlan(plan);
    trackEvent('paywall_plan_selected', { plan: plan as PlanParam });
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
      convertedRef.current = true;
      trackEvent('paywall_purchased', { plan: selectedPlan as PlanParam });
      setPremiumStatus('premium');
      setPremiumPurchase(result.purchase.productId, result.purchase.purchaseToken);
      alert(t('subscription.success_title'), t('subscription.success_body'), [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ]);
    } else if (result.cancelled) {
      // User cancelled — no-op
    } else if (result.error) {
      alert(t('subscription.purchase_failed'), result.error);
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
        alert(t('subscription.restore_success_title'), t('subscription.restore_success_body'));
      } else {
        alert(t('subscription.restore_empty_title'), t('subscription.restore_empty_body'));
      }
    } else {
      alert(t('subscription.restore_failed_title'), t('subscription.restore_failed_body'));
    }
  }, [onActivity, isRestoring, setPremiumStatus, setPremiumPurchase]);

  const ctaLabel = selectedPlan === 'remove_ads'
    ? t('subscription.cta_remove_ads', { price: removeAdsPrice })
    : selectedPlan === 'lifetime'
      ? t('subscription.cta_buy_lifetime', { price: lifetimePrice })
      : selectedPlan === 'yearly'
        ? t('subscription.cta_start_trial')
        : t('subscription.cta_subscribe', { price: monthlyPrice });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" translucent={false} />
      <HeroGradient />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Close button */}
        <View style={styles.headerRow}>
          <IconButton
            name="x"
            onPress={handleBack}
            color="rgba(255,255,255,0.7)"
            accessibilityLabel="Close"
          />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero */}
          <Animated.View style={[styles.hero, heroAnimStyle]}>
            <View style={styles.shieldGlow}>
              <Icon name="shield-check" size={52} color="#60A5FA" />
            </View>
            <Text style={styles.heroTitle}>
              {isPremium ? t('subscription.active_title') : t('subscription.hero_title')}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isPremium
                ? t('subscription.active_subtitle')
                : t('subscription.hero_subtitle')}
            </Text>
          </Animated.View>

          {/* Urgency banner — only within first 72 hours of install */}
          {!isPremium && (() => {
            const firstLaunch = useSettingsStore.getState().firstLaunchTimestamp;
            const isNew = firstLaunch && (Date.now() - firstLaunch) < 72 * 60 * 60 * 1000;
            return isNew ? (
              <Animated.View style={[styles.urgencyBanner, contentAnimStyle]}>
                <Icon name="clock" size={14} color="#F59E0B" />
                <Text style={styles.urgencyText}>{t('subscription.urgency_banner', { percent: 72 })}</Text>
              </Animated.View>
            ) : null;
          })()}

          {/* Feature list */}
          <View style={styles.featureCard}>
            {PREMIUM_FEATURES.map((feature, index) => (
              <FeatureRow
                key={feature.labelKey}
                icon={feature.icon}
                labelKey={feature.labelKey}
                descKey={feature.descKey}
                index={index}
              />
            ))}
          </View>

          {!isPremium && (
            <Animated.View style={contentAnimStyle}>
              {/* Plan cards */}
              <View style={styles.planRow}>
                {/* Yearly — "Most Popular" */}
                <Pressable
                  onPress={() => handleSelectPlan('yearly')}
                  style={[
                    styles.planCard,
                    selectedPlan === 'yearly' && styles.planCardSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select yearly plan, ${yearlyPrice} per year`}
                >
                  {/* Most Popular badge */}
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{t('subscription.most_popular')}</Text>
                  </View>
                  <Text style={styles.planTitle}>{t('subscription.plan_yearly')}</Text>
                  <Text style={styles.planPrice}>{yearlyPrice}</Text>
                  <Text style={styles.planPer}>{t('subscription.per_year')}</Text>
                  <View style={styles.savePill}>
                    <Text style={styles.savePillText}>{t('subscription.plan_yearly_save', { percent: 72 })}</Text>
                  </View>
                  <Text style={styles.planEquiv}>{yearlyMonthly}</Text>
                  {selectedPlan === 'yearly' && (
                    <View style={styles.checkBadge}>
                      <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>

                {/* Monthly */}
                <Pressable
                  onPress={() => handleSelectPlan('monthly')}
                  style={[
                    styles.planCard,
                    selectedPlan === 'monthly' && styles.planCardSelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select monthly plan, ${monthlyPrice} per month`}
                >
                  <View style={styles.popularBadgeSpacer} />
                  <Text style={styles.planTitle}>{t('subscription.plan_monthly')}</Text>
                  <Text style={styles.planPrice}>{monthlyPrice}</Text>
                  <Text style={styles.planPer}>{t('subscription.per_month')}</Text>
                  {selectedPlan === 'monthly' && (
                    <View style={styles.checkBadge}>
                      <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </Pressable>
              </View>

              {/* More options toggle */}
              <Pressable
                onPress={() => setShowMorePlans(prev => !prev)}
                style={styles.moreOptionsToggle}
                accessibilityRole="button"
                accessibilityLabel={showMorePlans ? 'Hide additional plans' : 'Show additional plans'}
              >
                <Text style={styles.moreOptionsText}>
                  {showMorePlans ? t('subscription.fewer_options') : t('subscription.more_options')}
                </Text>
                <Icon
                  name="chevron-right"
                  size={14}
                  color="#64748B"
                  style={{ transform: [{ rotate: showMorePlans ? '90deg' : '0deg' }] }}
                />
              </Pressable>

              {showMorePlans && (
                <>
                  {/* Lifetime */}
                  <Pressable
                    onPress={() => handleSelectPlan('lifetime')}
                    style={[
                      styles.lifetimeCard,
                      selectedPlan === 'lifetime' && styles.planCardSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Select lifetime plan, ${lifetimePrice} one-time`}
                  >
                    <View style={styles.lifetimeRow}>
                      <View style={styles.lifetimeTextCol}>
                        <Text style={styles.planTitle}>{t('subscription.plan_lifetime')}</Text>
                        <Text style={styles.lifetimeSub}>{t('subscription.plan_lifetime_desc')}</Text>
                      </View>
                      {selectedPlan === 'lifetime' && (
                        <View style={styles.inlineCheckBadge}>
                          <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                      <Text style={styles.lifetimePrice}>{lifetimePrice}</Text>
                    </View>
                  </Pressable>

                  {/* Remove Ads */}
                  <Pressable
                    onPress={() => handleSelectPlan('remove_ads')}
                    style={[
                      styles.lifetimeCard,
                      selectedPlan === 'remove_ads' && styles.planCardSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ads for ${removeAdsPrice}`}
                  >
                    <View style={styles.lifetimeRow}>
                      <View style={styles.lifetimeTextCol}>
                        <Text style={styles.planTitle}>{t('subscription.plan_remove_ads')}</Text>
                        <Text style={styles.lifetimeSub}>{t('subscription.plan_remove_ads_desc')}</Text>
                      </View>
                      {selectedPlan === 'remove_ads' && (
                        <View style={styles.inlineCheckBadge}>
                          <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                      <Text style={styles.lifetimePrice}>{removeAdsPrice}</Text>
                    </View>
                  </Pressable>
                </>
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* Sticky CTA footer */}
        {!isPremium && (
          <Animated.View style={[styles.ctaFooter, ctaAnimStyle]}>
            <Pressable
              onPress={handleStartTrial}
              disabled={isPurchasing}
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && !isPurchasing && styles.ctaPressed,
                isPurchasing && styles.ctaDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>{ctaLabel}</Text>
              )}
            </Pressable>

            {/* Trust signals */}
            <View style={styles.trustRow}>
              <Icon name="lock" size={12} color="#64748B" />
              <Text style={styles.trustText}>{t('subscription.trust_badge_secure')}</Text>
              <Text style={styles.trustDot}>{'\u00B7'}</Text>
              <Text style={styles.trustText}>{t('subscription.trust_badge_cancel')}</Text>
            </View>
            <Text style={styles.socialProof}>{t('subscription.social_proof')}</Text>

            <Pressable
              onPress={handleRestore}
              disabled={isRestoring}
              accessibilityRole="button"
              accessibilityLabel="Restore purchases"
            >
              <Text style={styles.restoreLink}>
                {isRestoring ? t('subscription.restore_loading') : t('subscription.restore')}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const ACCENT = '#3B82F6';
const ACCENT_LIGHT = '#60A5FA';

const createStyles = (_c: ColorTokens, _isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  shieldGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  // Urgency banner
  urgencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
    letterSpacing: 0.1,
  },

  // Feature card
  featureCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
    marginBottom: 24,
    overflow: 'hidden',
  },

  // Plan cards
  planRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  planCardSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  popularBadge: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 12,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  popularBadgeSpacer: {
    height: 22,
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  planPer: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 8,
  },
  planEquiv: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  savePill: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22C55E',
    letterSpacing: 0.3,
  },
  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Lifetime card
  lifetimeCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.08)',
  },
  lifetimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lifetimeTextCol: {
    flex: 1,
    minWidth: 0,
  },
  inlineCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lifetimeSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  lifetimePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F1F5F9',
  },

  // "More options" toggle
  moreOptionsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginBottom: 4,
  },
  moreOptionsText: {
    fontSize: 13,
    color: '#64748B',
  },

  // CTA footer
  ctaFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.08)',
    backgroundColor: 'rgba(10, 15, 26, 0.95)',
  },
  ctaButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_LIGHT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  ctaPressed: {
    backgroundColor: '#2563EB',
    transform: [{ scale: 0.97 }],
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
    marginBottom: 4,
  },
  trustText: {
    fontSize: 11,
    color: '#64748B',
  },
  trustDot: {
    fontSize: 11,
    color: '#475569',
  },
  socialProof: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  restoreLink: {
    fontSize: 12,
    color: ACCENT_LIGHT,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
