import { Text, TextProps, StyleSheet } from 'react-native';

export const colors = { bg: '#111824', panel: '#172331', border: '#394955', ink: '#fff6db', muted: '#9baaa7', pink: '#ff64b4', yellow: '#ffce72', green: '#b9e88a' };
export function PixelText({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.text, style]} />;
}
const styles = StyleSheet.create({ text: { fontFamily: 'PressStart2P_400Regular', fontSize: 9, lineHeight: 17, color: colors.ink } });
