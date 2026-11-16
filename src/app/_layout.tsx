import { Tabs } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors, PixelText } from '../components/ui';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export default function Layout() {
  const [loaded, error] = useFonts({ PressStart2P_400Regular });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!convex) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}><PixelText>Set EXPO_PUBLIC_CONVEX_URL to start your drive.</PixelText></View>;
  return <ConvexProvider client={convex}>
    <StatusBar style="light" />
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, borderTopWidth: 2, height: 84, paddingTop: 8 }, tabBarActiveTintColor: colors.pink, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontFamily: 'PressStart2P_400Regular', fontSize: 8 }, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'EXPLORE', tabBarIcon: ({ color }) => <PixelText style={{ color, fontSize: 17 }}>✦</PixelText> }} />
      <Tabs.Screen name="drives" options={{ title: 'DRIVES', tabBarIcon: ({ color }) => <PixelText style={{ color, fontSize: 17 }}>≡</PixelText> }} />
    </Tabs>
  </ConvexProvider>;
}
