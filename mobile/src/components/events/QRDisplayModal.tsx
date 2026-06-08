import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGradientLayout } from '../auth/AuthGradientLayout';
import { PrimaryButton } from '../PrimaryButton';
import { authColors } from '../../theme/colors';

interface QRDisplayModalProps {
  visible: boolean;
  title: string;
  joinUrl: string;
  tokenExpiresAt: string;
  isRegenerating?: boolean;
  onClose: () => void;
  onRegenerate: () => void;
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
  onClose,
  onRegenerate,
}: QRDisplayModalProps) {
  const insets = useSafeAreaInsets();
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

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <AuthGradientLayout contentStyle={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Scan to join the group</Text>

        <View style={[styles.qrWrap, expired && styles.qrExpired]}>
          {expired ? (
            <Text style={styles.expiredText}>QR expired</Text>
          ) : (
            <QRCode value={joinUrl} size={220} backgroundColor="transparent" color={authColors.textOnDark} />
          )}
        </View>

        {expired ? (
          <PrimaryButton
            label="Regenerate"
            loading={isRegenerating}
            onPress={onRegenerate}
            variant="inverse"
            style={styles.action}
          />
        ) : (
          <View style={styles.actions}>
            <PrimaryButton
              label={copied ? 'Copied!' : 'Copy link'}
              onPress={() => void handleCopy()}
              variant="inverse"
              style={styles.actionHalf}
            />
            <PrimaryButton
              label="Share"
              onPress={() => void handleShare()}
              style={styles.actionHalf}
            />
          </View>
        )}
      </AuthGradientLayout>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  close: {
    position: 'absolute',
    top: 8,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: authColors.glass,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 18,
    color: authColors.textOnDarkMuted,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
    marginBottom: 6,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 14,
    color: authColors.textOnDarkMuted,
    marginBottom: 28,
  },
  qrWrap: {
    backgroundColor: authColors.glassStrong,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    marginBottom: 28,
    minHeight: 268,
    minWidth: 268,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrExpired: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  expiredText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FCD34D',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  action: {
    width: '100%',
  },
  actionHalf: {
    flex: 1,
  },
});
