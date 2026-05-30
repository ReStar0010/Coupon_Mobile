import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { colors } from '@/src/theme/colors';
import { fontFamilies } from '@/src/theme/typography';
import { spacing } from '@/src/theme/spacing';

// Single source of truth for the version label: app.json → expoConfig.version.
// `expoConfig` is null in some bare-workflow paths, so fall back to a sentinel
// rather than rendering `undefined` to the user.
const APP_VERSION = Constants.expoConfig?.version ?? '?.?.?';
import { useAuth } from '@/src/state/AuthContext';
import { updateProfile } from '@/src/services/api/profile';
import EditProfileModal from './modals/EditProfileModal';
import LogoutConfirmModal from './modals/LogoutConfirmModal';
import DeleteAccountModal from './modals/DeleteAccountModal';
import FeedbackModal from './modals/FeedbackModal';
import BlockedMerchantsModal from './modals/BlockedMerchantsModal';
import VerifyModal from './modals/VerifyModal';
import LegalTextModal from './modals/LegalTextModal';
import Coachmark from '@/src/features/onboarding/Coachmark';
import { OnboardingAnchor, ANCHOR } from '@/src/components/onboarding/onboardingAnchors';

type ModalKey =
  | 'edit-profile'
  | 'logout'
  | 'delete'
  | 'feedback-bug'
  | 'feedback-feature'
  | 'blocked'
  | 'verify-email'
  | 'verify-phone'
  | 'terms'
  | 'privacy'
  | null;

interface SettingsScreenProps {
  onNavigate: (screen: string) => void;
  gems: number;
  couPoints: number;
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function SettingsRow({
  label,
  sub,
  right,
  onPress,
  testID,
}: {
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.rowWrapper}>
      <View style={styles.rowShadow} />
      <Pressable testID={testID} style={styles.row} onPress={onPress}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel}>{label}</Text>
          {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        </View>
        {right}
      </Pressable>
    </View>
  );
}

function VerifiedBadge({ ok }: { ok: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: ok ? colors.green : colors.subtle }]}>
      <Text style={[styles.badgeText, { color: ok ? '#fff' : colors.muted }]}>
        {ok ? '✓ 已驗證' : '未驗證'}
      </Text>
    </View>
  );
}

export default function SettingsScreen({
  onNavigate,
  gems,
  couPoints,
}: SettingsScreenProps): React.JSX.Element {
  const { user, refreshAuth } = useAuth();
  const [modal, setModal] = useState<ModalKey>(null);

  const profileName = user?.displayName ?? '';
  const profileEmail = user?.email ?? '';
  const profilePhone = user?.phone ?? '';
  // Email verification is tracked server-side; for now derive from a falsy email.
  // Phone verification comes straight from the UserProfile.
  const emailVerified = Boolean(profileEmail);
  const phoneVerified = user?.phoneVerified ?? false;

  async function handleSaveProfile(n: string, e: string, p: string): Promise<void> {
    const phoneChanged = p !== profilePhone;
    const emailChanged = e !== profileEmail;
    // Display-name + avatar are the only fields the profile endpoint supports;
    // email and phone changes go through dedicated verification flows.
    try {
      await updateProfile({ displayName: n });
      await refreshAuth();
    } catch {
      // Surface failures inside EditProfileModal (it owns its own inline error).
      return;
    }
    if (emailChanged) {
      setModal('verify-email');
    } else if (phoneChanged) {
      setModal('verify-phone');
    }
  }

  function handleVerifyClose(): void {
    void refreshAuth();
    setModal(null);
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => onNavigate('home')}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.screenTitle}>設定</Text>
        </View>

        {/* Profile card */}
        <View style={styles.section}>
          <OnboardingAnchor id={ANCHOR.settingsProfile} style={styles.profileCardWrapper}>
            <View style={styles.profileCardShadow} />
            <View style={styles.profileCard}>
              <View style={styles.profileInfo}>
                <Text testID="profile-name" style={styles.profileName}>
                  {profileName || '尚未設定'}
                </Text>
                <Text testID="profile-email" style={styles.profileMeta}>
                  {profileEmail || '尚未設定'}
                </Text>
                <Text style={styles.profileMeta}>{profilePhone || '尚未設定'}</Text>
                <View style={styles.pointsBadgeRow}>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsBadgeText}>{couPoints} pt</Text>
                  </View>
                  <View style={styles.gemsBadge}>
                    <Text style={styles.gemsBadgeText}>{gems} 💎</Text>
                  </View>
                </View>
              </View>
              <View style={styles.editBtnWrapper}>
                <View style={styles.editBtnShadow} />
                <Pressable style={styles.editBtn} onPress={() => setModal('edit-profile')}>
                  <Text style={styles.editBtnText}>編輯</Text>
                </Pressable>
              </View>
            </View>
          </OnboardingAnchor>
        </View>

        {/* Account verification */}
        <View style={styles.section}>
          <SectionLabel label="帳號驗證" />
          <SettingsRow
            label="電子信箱驗證"
            sub={profileEmail || '尚未設定'}
            right={
              <View style={styles.verifyRight}>
                <VerifiedBadge ok={emailVerified} />
                {!emailVerified && (
                  <Pressable style={styles.verifyBtn} onPress={() => setModal('verify-email')}>
                    <Text style={styles.verifyBtnText}>驗證</Text>
                  </Pressable>
                )}
              </View>
            }
            onPress={emailVerified ? undefined : () => setModal('verify-email')}
          />
          <SettingsRow
            label="手機號碼驗證"
            sub={profilePhone || '尚未設定'}
            right={
              <View style={styles.verifyRight}>
                <VerifiedBadge ok={phoneVerified} />
                {!phoneVerified && (
                  <Pressable style={styles.verifyBtn} onPress={() => setModal('verify-phone')}>
                    <Text style={styles.verifyBtnText}>驗證</Text>
                  </Pressable>
                )}
              </View>
            }
            onPress={phoneVerified ? undefined : () => setModal('verify-phone')}
          />
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <SectionLabel label="隱私與資料" />
          <SettingsRow
            testID="btn-blocked"
            label="封鎖商家"
            sub="管理不想看到的商家"
            right={<Text style={styles.chevron}>›</Text>}
            onPress={() => setModal('blocked')}
          />
        </View>

        {/* Feedback */}
        <View style={styles.section}>
          <SectionLabel label="回饋" />
          <SettingsRow
            label="🐞 回報問題"
            sub="透過信箱告訴我們你遇到的 Bug"
            right={<Text style={styles.chevron}>›</Text>}
            onPress={() => setModal('feedback-bug')}
          />
          <SettingsRow
            label="💡 功能建議"
            sub="建議你希望看到的新功能"
            right={<Text style={styles.chevron}>›</Text>}
            onPress={() => setModal('feedback-feature')}
          />
        </View>

        {/* About */}
        <View style={styles.section}>
          <SectionLabel label="關於" />
          <View style={styles.aboutCard}>
            <View style={styles.aboutRowWrapper}>
              <View style={styles.aboutCardShadow} />
              <View style={styles.aboutCardInner}>
                <View style={styles.aboutRow}>
                  <Text style={styles.aboutKey}>版本</Text>
                  <Text style={styles.aboutVal}>{`v${APP_VERSION}`}</Text>
                </View>
                <View style={styles.aboutDivider} />
                <Pressable style={styles.aboutRow} onPress={() => setModal('terms')}>
                  <Text style={styles.aboutKey}>服務條款</Text>
                  <Text style={[styles.aboutVal, styles.aboutLink]}>閱讀</Text>
                </Pressable>
                <View style={styles.aboutDivider} />
                <Pressable style={styles.aboutRow} onPress={() => setModal('privacy')}>
                  <Text style={styles.aboutKey}>隱私政策</Text>
                  <Text style={[styles.aboutVal, styles.aboutLink]}>閱讀</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <View style={styles.logoutWrapper}>
            <View style={styles.logoutShadow} />
            <Pressable
              testID="btn-logout"
              style={styles.logoutBtn}
              onPress={() => setModal('logout')}
            >
              <Text style={styles.logoutText}>登出帳號</Text>
            </Pressable>
          </View>
          <Pressable
            testID="btn-delete-account"
            onPress={() => setModal('delete')}
            style={styles.deleteLink}
          >
            <Text style={styles.deleteLinkText}>刪除帳號</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modals */}
      <EditProfileModal
        visible={modal === 'edit-profile'}
        name={profileName}
        email={profileEmail}
        phone={profilePhone}
        onSave={handleSaveProfile}
        onClose={() => setModal(null)}
      />
      <LogoutConfirmModal
        visible={modal === 'logout'}
        onLogout={() => {
          setModal(null);
          onNavigate('home');
        }}
        onClose={() => setModal(null)}
      />
      <DeleteAccountModal
        testID="delete-modal"
        visible={modal === 'delete'}
        onClose={() => setModal(null)}
      />
      <FeedbackModal
        visible={modal === 'feedback-bug' || modal === 'feedback-feature'}
        type={modal === 'feedback-feature' ? 'feature' : 'bug'}
        onClose={() => setModal(null)}
      />
      <BlockedMerchantsModal visible={modal === 'blocked'} onClose={() => setModal(null)} />
      <VerifyModal
        visible={modal === 'verify-email' || modal === 'verify-phone'}
        field={modal === 'verify-phone' ? 'phone' : 'email'}
        currentVal={modal === 'verify-phone' ? profilePhone : profileEmail}
        onClose={handleVerifyClose}
      />
      <LegalTextModal visible={modal === 'terms'} type="terms" onClose={() => setModal(null)} />
      <LegalTextModal visible={modal === 'privacy'} type="privacy" onClose={() => setModal(null)} />
      <Coachmark screen="settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
    paddingTop: 2,
  },
  backBtn: {
    width: 34,
    height: 34,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    color: colors.fg,
  },
  screenTitle: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: colors.fg,
    letterSpacing: -0.5,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
    marginTop: 4,
  },
  profileCardWrapper: {
    position: 'relative',
  },
  profileCardShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  profileCard: {
    backgroundColor: colors.yellow,
    borderWidth: 2.5,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 20,
    color: colors.fg,
    letterSpacing: -0.5,
  },
  profileMeta: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: 'rgba(51,51,51,0.65)',
    marginTop: 2,
  },
  pointsBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.fg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 3,
  },
  pointsBadgeText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 10,
    color: colors.yellow,
    fontWeight: '700',
  },
  gemsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.purpleLight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 3,
  },
  gemsBadgeText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 10,
    color: colors.fg,
    fontWeight: '700',
  },
  editBtnWrapper: {
    position: 'relative',
    marginLeft: 10,
    flexShrink: 0,
  },
  editBtnShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.fg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
  },
  editBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 12,
    color: colors.yellow,
  },
  rowWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  rowShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    color: colors.fg,
    letterSpacing: -0.1,
  },
  rowSub: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 16,
    color: colors.muted,
    fontFamily: fontFamilies.bold,
  },
  verifyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: fontFamilies.monoSemiBold,
    fontSize: 10,
    fontWeight: '700',
  },
  verifyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.yellow,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 3,
  },
  verifyBtnText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    color: colors.fg,
  },
  aboutCard: {
    marginBottom: 8,
  },
  aboutRowWrapper: {
    position: 'relative',
  },
  aboutCardShadow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  aboutCardInner: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  aboutDivider: {
    height: 1.5,
    backgroundColor: colors.subtle,
    marginHorizontal: 0,
  },
  aboutKey: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    color: colors.fg,
  },
  aboutVal: {
    fontFamily: fontFamilies.monoRegular,
    fontSize: 12,
    color: colors.muted,
  },
  aboutLink: {
    color: colors.purple,
    fontFamily: fontFamilies.monoSemiBold,
    fontWeight: '700',
  },
  logoutWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  logoutShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: '100%',
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  logoutBtn: {
    backgroundColor: colors.red,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    fontFamily: fontFamilies.extraBold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: -0.1,
  },
  deleteLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  deleteLinkText: {
    fontFamily: fontFamilies.bold,
    fontSize: 13,
    color: colors.red,
  },
});
