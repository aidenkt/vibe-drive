import { Stack } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '../components/ui';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export default function Layout() {
  const [loaded, error] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, IBMPlexMono_400Regular, IBMPlexMono_500Medium });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: theme.white }} />;
  if (!convex) return <View style={{ flex: 1, backgroundColor: theme.white, justifyContent: 'center', padding: 24 }}><Text>Set EXPO_PUBLIC_CONVEX_URL to start your drive.</Text></View>;
  return <GestureHandlerRootView style={{ flex: 1 }}><ConvexProvider client={convex}>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.white } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pass" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
    </Stack>
  </ConvexProvider></GestureHandlerRootView>;
}
