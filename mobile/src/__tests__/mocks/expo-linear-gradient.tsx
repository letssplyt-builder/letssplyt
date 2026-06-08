import React from 'react';
import { View, type ViewProps } from 'react-native';

type Props = ViewProps & {
  children?: React.ReactNode;
};

export function LinearGradient({ children, style, ...rest }: Props) {
  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
}
