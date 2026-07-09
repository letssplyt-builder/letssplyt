import type { ReactElement, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AuthGradientLayout } from '../auth/AuthGradientLayout';
import { ScreenTopBar, type ScreenTopBarProps } from '../navigation/ScreenTopBar';
import { SCREEN_HORIZONTAL_PADDING } from '../../constants/layout';

type ThemedScreenLayoutProps = {
  topBar?: ScreenTopBarProps;
  children: ReactNode;
  footer?: ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  /** When false, children render in a flex View instead of ScrollView. */
  scroll?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollStyle?: StyleProp<ViewStyle>;
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  bottomSafeArea?: 'tabBar' | 'system';
};

export function ThemedScreenLayout({
  topBar,
  children,
  footer,
  footerStyle,
  scroll = true,
  refreshControl,
  scrollStyle,
  scrollContentContainerStyle,
  bodyStyle,
  bottomSafeArea = 'tabBar',
}: ThemedScreenLayoutProps) {
  const body = scroll ? (
    <ScrollView
      style={[styles.scroll, scrollStyle]}
      contentContainerStyle={[styles.scrollContent, scrollContentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, bodyStyle]}>{children}</View>
  );

  return (
    <AuthGradientLayout
      contentStyle={styles.layout}
      footer={footer}
      footerStyle={footerStyle}
      bottomSafeArea={bottomSafeArea}
    >
      {topBar ? <ScreenTopBar {...topBar} /> : null}
      {body}
    </AuthGradientLayout>
  );
}

const styles = StyleSheet.create({
  layout: {
    paddingHorizontal: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
  body: {
    flex: 1,
    paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
  },
});
