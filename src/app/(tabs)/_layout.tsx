import { Tabs } from 'expo-router';
import { colors, PixelText } from '../../components/ui';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, borderTopWidth: 2, height: 84, paddingTop: 8 }, tabBarActiveTintColor: colors.pink, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontFamily: 'PressStart2P_400Regular', fontSize: 8 }, sceneStyle: { backgroundColor: colors.bg } }}>
    <Tabs.Screen name="index" options={{ title: 'EXPLORE', tabBarIcon: ({ color }) => <PixelText style={{ color, fontSize: 17 }}>✦</PixelText> }} />
    <Tabs.Screen name="drives" options={{ title: 'DRIVES', tabBarIcon: ({ color }) => <PixelText style={{ color, fontSize: 17 }}>≡</PixelText> }} />
  </Tabs>;
}
