import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';
import type { PaymentHandle } from '@letssplyt/shared/profile.types';
import { BottomToast } from '../../components/BottomToast';
import { AuthGradientLayout } from '../../components/auth/AuthGradientLayout';
import { FadeSlideIn } from '../../components/auth/FadeSlideIn';
import { ScreenTopBar } from '../../components/navigation/ScreenTopBar';
import { SwipeableHandleRow } from '../../components/profile/SwipeableHandleRow';
import { useAppInsets } from '../../hooks/useAppInsets';
import type { SettingsStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { useProfileStore } from '../../store/profileStore';
import { useTheme } from '../../theme/ThemeContext';
import type { Theme } from '../../theme/types';
import { initialsFromDisplayName, providerLabel } from '../../utils/profile';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Profile'>;

const LIST_HORIZONTAL_PADDING = 56;
const DRAG_HANDLE_WIDTH = 52;

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    layout: {
      paddingHorizontal: 0,
    },
    listContent: {
      paddingHorizontal: 28,
    },
    headerBlock: {
      paddingTop: 4,
      paddingBottom: 8,
    },
    footerBlock: {
      gap: 14,
      marginTop: 8,
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
      shadowColor: '#000000',
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
      color: theme.ink,
      textAlign: 'center',
      fontFamily: theme.fontDisplay,
    },
    nameHint: {
      marginTop: 4,
      marginBottom: 20,
      textAlign: 'center',
      fontSize: 12,
      color: theme.ink3,
      fontFamily: theme.fontBody,
    },
    nameInput: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.ink,
      textAlign: 'center',
      marginBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: theme.line,
      paddingVertical: 4,
      fontFamily: theme.fontDisplay,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: 10,
      fontFamily: theme.fontBody,
    },
    emptyHint: {
      fontSize: 13,
      color: theme.ink2,
      marginBottom: 12,
      lineHeight: 20,
      fontFamily: theme.fontBody,
    },
    addButton: {
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: theme.radiusSm,
      borderWidth: 1.5,
      borderColor: theme.line,
      backgroundColor: theme.surface,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.ink,
      fontFamily: theme.fontBody,
    },
    trustCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: theme.radiusSm,
      borderWidth: 1,
      borderColor: theme.line,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    trustIcon: {
      fontSize: 14,
    },
    trustText: {
      flex: 1,
      fontSize: 11,
      color: theme.ink2,
      lineHeight: 16,
      fontFamily: theme.fontBody,
    },
  });
}

export function ProfileScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const authUser = useAuthStore((state) => state.user);
  const { user, handles, isLoading, loadProfile, deleteHandle, reorderHandles, updateDisplayName } =
    useProfileStore();
  const { screenScrollBottomPadding } = useAppInsets();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const swipeHintPlayedRef = useRef(false);
  const firstHandleId = handles[0]?.id;
  const { width: windowWidth } = useWindowDimensions();
  const dragHitSlop = useMemo(
    () => ({
      right: -(windowWidth - LIST_HORIZONTAL_PADDING - DRAG_HANDLE_WIDTH),
    }),
    [windowWidth],
  );

  useEffect(() => {
    const message = route.params?.toastMessage;
    if (!message) return;
    setToastMessage(message);
    navigation.setParams({ toastMessage: undefined });
  }, [navigation, route.params?.toastMessage]);

  useEffect(() => {
    void loadProfile().catch(() => {
      const hasProfile = Boolean(useProfileStore.getState().user ?? useAuthStore.getState().user);
      if (!hasProfile) {
        Alert.alert('Could not load profile', 'Check your connection and try again.');
      }
    });
  }, [loadProfile]);

  const displayUser = user;
  const avatarColour = displayUser?.avatar_colour ?? authUser?.avatar_colour ?? '#6366F1';
  const displayName = displayUser?.display_name ?? authUser?.display_name ?? 'User';

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
          playMountHint={!swipeHintPlayedRef.current && item.id === firstHandleId}
          onSwipeHintPlayed={() => {
            swipeHintPlayedRef.current = true;
          }}
        />
      </ScaleDecorator>
    ),
    [firstHandleId, navigation],
  );

  const listHeader = (
    <View style={styles.headerBlock}>
      {isLoading && !user && !authUser ? (
        <ActivityIndicator color={theme.ink} style={styles.loader} />
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
                placeholderTextColor={theme.ink3}
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
    </View>
  );

  return (
    <AuthGradientLayout contentStyle={styles.layout}>
      <ScreenTopBar title="Profile" onBack={() => navigation.popToTop()} />
      <BottomToast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      <DraggableFlatList
        data={handles}
        keyExtractor={(item) => item.id}
        activationDistance={20}
        dragHitSlop={dragHitSlop}
        onDragEnd={({ data }) => {
          void reorderHandles(data.map((handle) => handle.id)).catch(() => {
            Alert.alert('Could not reorder', 'Please try again.');
          });
        }}
        renderItem={renderHandle}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: screenScrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </AuthGradientLayout>
  );
}
