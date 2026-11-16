import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../components/ui';

export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: theme.accent,
    tabBarInactiveTintColor: theme.faint,
    tabBarStyle: { backgroundColor: theme.white, borderTopColor: theme.hairline, borderTopWidth: 0.5 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
    sceneStyle: { backgroundColor: theme.white },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Map', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color as string} /> }} />
    <Tabs.Screen name="drives" options={{ title: 'Drives', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'albums' : 'albums-outline'} size={24} color={color as string} /> }} />
  </Tabs>;
}
