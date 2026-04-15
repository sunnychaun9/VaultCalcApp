/**
 * VaultCalc - Referral module public API
 *
 * @see ROADMAP_2K_MONTH.md Task 2.1
 */

export {
  getOrCreateReferralCode,
  getReferralLink,
  checkIncomingReferral,
  checkAndGrantShareMilestones,
  getShareRewardProgress,
  extractCodeFromReferrer,
  SHARE_REWARD_TIERS,
} from './referralService';

export type { ShareRewardProgress } from './referralService';
