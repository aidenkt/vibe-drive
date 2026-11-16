import { Stack } from 'expo-router';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colors, PixelText } from '../components/ui';

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
const convex = url ? new ConvexReactClient(url) : null;

export default function Layout() {
  const [loaded, error] = useFonts({ PressStart2P_400Regular, InstrumentSerif_400Regular, IBMPlexMono_400Regular, IBMPlexMono_500Medium });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!convex) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}><PixelText>Set EXPO_PUBLIC_CONVEX_URL to start your drive.</PixelText></View>;
  return <ConvexProvider client={convex}>
    <StatusBar style="light" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pass" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="credits" options={{ presentation: 'modal' }} />
    </Stack>
  </ConvexProvider>;
}
