import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

export const theme = {
  ink: '#14110F',
  paper: '#F2EADB',
  white: '#FFFFFF',
  accent: '#FF5A1F',
  muted: 'rgba(20,17,15,0.55)',
  faint: 'rgba(20,17,15,0.35)',
  hairline: 'rgba(0,0,0,0.08)',
};
export const fonts = { serif: 'InstrumentSerif_400Regular', mono: 'IBMPlexMono_400Regular', monoMedium: 'IBMPlexMono_500Medium' };

export function Mono({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.mono, style]} />;
}

export function Sheet({ children, radius = 24, style, contentStyle }: { children: ReactNode; radius?: number; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle> }) {
  return <View style={[styles.shadow, { borderRadius: radius }, style]}>
    <BlurView tint="light" intensity={60} style={[styles.blur, { borderRadius: radius }, contentStyle]}>{children}</BlurView>
  </View>;
}

const styles = StyleSheet.create({
  mono: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.muted },
  shadow: { shadowColor: theme.ink, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  blur: { overflow: 'hidden', borderWidth: 0.5, borderColor: theme.hairline, backgroundColor: 'rgba(255,255,255,0.55)' },
});
