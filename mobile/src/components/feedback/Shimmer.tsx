import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';

const ShimmerProgressContext = createContext<Animated.Value | null>(null);

interface ShimmerScopeProps {
  children: ReactNode;
}

export function ShimmerScope({ children }: ShimmerScopeProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [progress]);

  return (
    <ShimmerProgressContext.Provider value={progress}>{children}</ShimmerProgressContext.Provider>
  );
}

interface ShimmerBoneProps {
  style?: StyleProp<ViewStyle>;
}

export function ShimmerBone({ style }: ShimmerBoneProps) {
  const { theme } = useTheme();
  const progress = useContext(ShimmerProgressContext);
  const [width, setWidth] = useState(0);
  const highlight = theme.isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.7)';
  const base = theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)';
  const translateX = useMemo(
    () =>
      progress
        ? progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-Math.max(width, 1), Math.max(width, 1)],
          })
        : 0,
    [progress, width],
  );

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.bone, { backgroundColor: base, borderRadius: theme.radiusSm }, style]}
    >
      {progress && width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.sweep, { transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={['transparent', highlight, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ width: width * 0.55, height: '100%' }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    overflow: 'hidden',
  },
  sweep: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
});
