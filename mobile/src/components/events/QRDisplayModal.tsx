import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGradientLayout } from '../auth/AuthGradientLayout';
import { ScreenTopBar } from '../navigation/ScreenTopBar';
import { PrimaryButton } from '../PrimaryButton';
import { useTheme } from '../../theme/ThemeContext';
import { ThemedSurface } from '../../theme/ThemedSurface';

interface JoinedParticipant {
  id: string;
  displayName: string;
}

interface QRDisplayModalProps {
  visible: boolean;
  title: string;
  joinUrl: string;
  tokenExpiresAt: string;
  isRegenerating?: boolean;
  participants?: JoinedParticipant[];
  lockEnabled?: boolean;
  lockLoading?: boolean;
  onClose: () => void;
  onRegenerate: () => void;
  onLockAndSplit?: () => void;
}

function isTokenExpired(expiresAt: string): boolean {
  const expires = new Date(expiresAt).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

export function QRDisplayModal({
  visible,
  title,
  joinUrl,
  tokenExpiresAt,
  isRegenerating,
  participants = [],
  lockEnabled = false,
  lockLoading = false,
  onClose,
  onRegenerate,
  onLockAndSplit,
}: QRDisplayModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [copied, setCopied] = useState(false);
  const expired = isTokenExpired(tokenExpiresAt);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    await Share.share({ message: joinUrl, url: joinUrl });
  };

  const openChip = !expired ? (
    <View style={[styles.openChip, { backgroundColor: theme.accentSoft }]}>
      <View style={[styles.openDot, { backgroundColor: theme.good }]} />
      <Text style={[styles.openChipText, { color: theme.good }]}>Open</Text>
    </View>
  ) : null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <AuthGradientLayout
        bottomSafeArea="system"
        safeAreaEdges={['left', 'right', 'bottom']}
        contentStyle={[styles.container, { paddingTop: insets.top }]}
        footer={
          <View style={styles.footerActions}>
            {expired ? (
              <PrimaryButton
                label="↻ Regenerate QR & link"
                loading={isRegenerating}
                onPress={onRegenerate}
                style={styles.action}
              />
            ) : onLockAndSplit ? (
              <PrimaryButton
                label="Everyone's here — Lock & split"
                loading={lockLoading}
                disabled={!lockEnabled || lockLoading}
                onPress={onLockAndSplit}
                style={styles.action}
              />
            ) : (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void handleCopy()}
                  style={[styles.outlineButton, { borderColor: theme.line }]}
                >
                  <Text style={[styles.outlineButtonText, { color: theme.ink }]}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Text>
                </Pressable>
                <PrimaryButton label="Share" onPress={() => void handleShare()} style={styles.actionHalf} />
              </View>
            )}
          </View>
        }
      >
        <ScreenTopBar
          title={title}
          subtitle="Scan to join this event"
          onBack={onClose}
          trailing={openChip}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {expired ? (
            <ThemedSurface style={[styles.expiredCard, { backgroundColor: theme.warnSoft, borderColor: theme.warn }]}>
              <Text style={[styles.expiredIcon, { color: theme.warn }]}>⚠</Text>
              <Text style={[styles.expiredText, { color: theme.warn }]}>QR expired</Text>
              <Text style={styles.expiredHint}>Regenerate to share a fresh link</Text>
            </ThemedSurface>
          ) : (
            <ThemedSurface strong style={styles.qrCard}>
              <View style={[styles.qrFrame, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }]}>
                <QRCode value={joinUrl} size={200} backgroundColor="transparent" color={theme.ink} />
              </View>
              <Text style={styles.linkText} numberOfLines={2}>
                {joinUrl}
              </Text>
            </ThemedSurface>
          )}

          {participants.length > 0 ? (
            <View style={styles.joinedSection}>
              <Text style={styles.joinedTitle}>Joined · {participants.length}</Text>
              {participants.map((participant) => (
                <ThemedSurface key={participant.id} style={styles.joinedRow}>
                  <Text style={styles.joinedName}>{participant.displayName}</Text>
                </ThemedSurface>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </AuthGradientLayout>
    </Modal>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 0,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 24,
    },
    openChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 100,
      flexShrink: 0,
    },
    openDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    openChipText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: theme.fontBody,
      flexShrink: 0,
    },
    qrCard: {
      padding: 20,
      alignItems: 'center',
      marginBottom: 20,
    },
    qrFrame: {
      padding: 16,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      marginBottom: 14,
    },
    linkText: {
      fontSize: 12,
      color: theme.ink2,
      textAlign: 'center',
      fontFamily: theme.fontBody,
    },
    expiredCard: {
      padding: 24,
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 1,
    },
    expiredIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    expiredText: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
    expiredHint: {
      fontSize: 13,
      color: theme.ink2,
      marginTop: 4,
      fontFamily: theme.fontBody,
    },
    joinedSection: {
      width: '100%',
      gap: 8,
      marginTop: 4,
    },
    joinedTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontFamily: theme.fontBody,
    },
    joinedRow: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: theme.radiusSm,
    },
    joinedName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    footerActions: {
      gap: 10,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    action: {
      flex: 1,
    },
    actionHalf: {
      flex: 1,
    },
    outlineButton: {
      flex: 1,
      height: 56,
      borderRadius: 28,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineButtonText: {
      fontSize: 16,
      fontWeight: '700',
      fontFamily: theme.fontBody,
    },
  });
}
