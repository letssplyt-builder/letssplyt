import { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PaymentHandle } from '@letssplyt/shared/profile.types';
import { BottomToast } from '../../components/BottomToast';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { SwipeableHandleRow } from '../../components/profile/SwipeableHandleRow';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';
import { initialsFromDisplayName, providerLabel } from '../../utils/profile';
import { authColors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({ navigation, route }: Props) {
  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { user, handles, isLoading, loadProfile, deleteHandle, reorderHandles, updateDisplayName } =
    useProfileStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const message = route.params?.toastMessage;
    if (!message) return;
    setToastMessage(message);
    navigation.setParams({ toastMessage: undefined });
  }, [navigation, route.params?.toastMessage]);

  useEffect(() => {
    void loadProfile().catch(() => {
      Alert.alert('Could not load profile', 'Pull to refresh by reopening this screen.');
    });
  }, [loadProfile]);

  const displayUser = user ?? authUser;
  const avatarColour = displayUser?.avatar_colour ?? '#6366F1';
  const displayName = displayUser?.display_name ?? 'User';

  const commitName = async () => {
    const trimmed = draftName.trim();
    setIsEditingName(false);
    if (!trimmed || trimmed === displayName) return;
    try {
      await updateDisplayName(trimmed);
    } catch {
      Alert.alert('Could not update name', 'Please try again.');
    }
  };

  const confirmDelete = (handle: PaymentHandle) => {
    Alert.alert('Delete payment method?', `${providerLabel(handle.provider)} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteHandle(handle.id).catch(() => {
            Alert.alert('Could not delete', 'Please try again.');
          });
        },
      },
    ]);
  };

  const openEditHandle = (handle: PaymentHandle) => {
    navigation.navigate('AddHandle', {
      handleId: handle.id,
      provider: handle.provider,
      handleValue: handle.handle_value,
    });
  };

  const renderHandle = useCallback(
    ({ item, drag, isActive }: RenderItemParams<PaymentHandle>) => (
      <ScaleDecorator>
        <SwipeableHandleRow
          handle={item}
          isDragging={isActive}
          onPress={() => openEditHandle(item)}
          onDrag={drag}
          onDelete={() => confirmDelete(item)}
        />
      </ScaleDecorator>
    ),
    [navigation],
  );

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      Alert.alert('Could not log out', 'Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      <FadeSlideIn delay={0}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigation.navigate('MainTabs', { screen: 'HomeTab', params: { screen: 'Home' } })
          }
          style={styles.back}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </FadeSlideIn>

      {isLoading && !user ? (
        <ActivityIndicator color={authColors.textOnDark} style={styles.loader} />
      ) : (
        <>
          <FadeSlideIn delay={60}>
            <View style={[styles.avatar, { backgroundColor: avatarColour }]}>
              <Text style={styles.avatarText}>{initialsFromDisplayName(displayName)}</Text>
            </View>
          </FadeSlideIn>

          <FadeSlideIn delay={120}>
            {isEditingName ? (
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                onBlur={() => void commitName()}
                autoFocus
                style={styles.nameInput}
                maxLength={50}
                placeholderTextColor={authColors.textOnDarkFaint}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Tap to edit your display name"
                onPress={() => {
                  setDraftName(displayName);
                  setIsEditingName(true);
                }}
              >
                <Text style={styles.displayName}>{displayName}</Text>
                <Text style={styles.nameHint}>Tap to edit name</Text>
              </Pressable>
            )}
          </FadeSlideIn>

          <FadeSlideIn delay={180}>
            <Text style={styles.sectionTitle}>Payment methods</Text>
            {handles.length === 0 ? (
              <Text style={styles.emptyHint}>Add how friends can pay you back after a split.</Text>
            ) : null}
          </FadeSlideIn>
        </>
      )}
    </View>
  );

  const listFooter = (
    <View style={styles.footerBlock}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('AddHandle', {})}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>+ Add payment method</Text>
      </Pressable>

      <View style={styles.trustCard}>
        <Text style={styles.trustIcon}>🔒</Text>
        <Text style={styles.trustText}>AES-256 encrypted · Never shared without your action</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isLoggingOut}
        onPress={() => void handleLogout()}
        style={styles.logoutButton}
      >
        <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out…' : 'Log out'}</Text>
      </Pressable>
    </View>
  );

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <BottomToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      <DraggableFlatList
        data={handles}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => {
          void reorderHandles(data.map((handle) => handle.id)).catch(() => {
            Alert.alert('Could not reorder', 'Please try again.');
          });
        }}
        renderItem={renderHandle}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 0,
  },
  listContent: {
    paddingHorizontal: 28,
    paddingBottom: 32,
  },
  headerBlock: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  footerBlock: {
    gap: 14,
    marginTop: 8,
  },
  back: {
    marginBottom: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: authColors.textOnDarkMuted,
  },
  loader: {
    marginTop: 48,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  displayName: {
    fontSize: 26,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
  },
  nameHint: {
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 12,
    color: authColors.textOnDarkFaint,
  },
  nameInput: {
    fontSize: 26,
    fontWeight: '800',
    color: authColors.textOnDark,
    textAlign: 'center',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.55)',
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: authColors.textOnDarkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  emptyHint: {
    fontSize: 13,
    color: authColors.textOnDarkMuted,
    marginBottom: 12,
    lineHeight: 20,
  },
  addButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: authColors.glass,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDark,
  },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authColors.glassBorder,
    backgroundColor: authColors.glass,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  trustIcon: {
    fontSize: 14,
  },
  trustText: {
    flex: 1,
    fontSize: 11,
    color: authColors.textOnDarkMuted,
    lineHeight: 16,
  },
  logoutButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: authColors.glassBorder,
    alignItems: 'center',
    backgroundColor: authColors.glass,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: authColors.textOnDarkMuted,
  },
});
