import { ComponentType, Ref, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SymbolView } from 'expo-symbols';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import BottomSheet, { BottomSheetBackgroundProps, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { WebView as RNWebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { api } from '../../../convex/_generated/api';
import { mapHtml } from '../../components/mapHtml';
import { DrivePass } from '../../components/DrivePass';
import { fonts, Glass, Mono, theme } from '../../components/ui';
import { drivePhoto } from '../../lib/drives';
import { useHandle } from '../../lib/handle';
import { usePasses } from '../../lib/usePasses';

type Point = { lat: number; lng: number };
const origins = {
  SF: { label: 'From SF', point: { lat: 37.788, lng: -122.4075 }, destinations: { 'Stinson Beach': { lat: 37.9005, lng: -122.644 }, Sausalito: { lat: 37.8591, lng: -122.4853 } } },
  SD: { label: 'From San Diego', point: { lat: 32.7157, lng: -117.1611 }, destinations: { 'Los Angeles': { lat: 34.0522, lng: -118.2437 }, Julian: { lat: 33.0787, lng: -116.6019 } } },
} as const satisfies Record<string, { label: string; point: Point; destinations: Record<string, Point> }>;
type OriginKey = keyof typeof origins;
const km = (a: Point, b: Point) => {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes) % 60).padStart(2, '0')}m`;
type WebViewHandle = { postMessage: (message: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;
type Plan = FunctionReturnType<typeof api.routes.planRoutes>;

function SheetBackground({ style }: BottomSheetBackgroundProps) {
  return <Glass style={[style, styles.sheetBackground]}><View style={styles.sheetTint} /></Glass>;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const web = useRef<WebViewHandle>(null);
  const sheet = useRef<BottomSheet>(null);
  const planRoutes = useAction(api.routes.planRoutes);
  const markDriven = useMutation(api.drives.markDriven);
  const handle = useHandle();
  const { passes } = usePasses();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [originKey, setOriginKey] = useState<OriginKey>('SF');
  const [me, setMe] = useState<Point | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const sheetPosition = useSharedValue(0);
  const locateStyle = useAnimatedStyle(() => ({ top: sheetPosition.value - 60 }));
  const origin = origins[originKey];
  const nearOrigin = me && km(me, origin.point) < 50 ? me : null;
  const carAt = nearOrigin ?? origin.point;
  const [playing, setPlaying] = useState(false);
  const tabBar = insets.bottom + 84;
  const snapPoints = useMemo(() => [tabBar + 170, '70%', '92%'], [tabBar]);
  const pass = plan && passes?.find((p) => p.drive._id === plan.drive._id);

  const send = (value: unknown) => web.current?.postMessage(JSON.stringify(value));

  useEffect(() => {
    let position: Location.LocationSubscription | undefined;
    let compass: Location.LocationSubscription | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        position = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
          (l) => setMe({ lat: l.coords.latitude, lng: l.coords.longitude }));
        compass = await Location.watchHeadingAsync((h) => {
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading((prev) => (prev === null || Math.abs(((value - prev + 540) % 360) - 180) > 5 ? value : prev));
        });
      } catch {}
    })();
    return () => { cancelled = true; position?.remove(); compass?.remove(); };
  }, []);

  useEffect(() => {
    if (mapReady) web.current?.postMessage(JSON.stringify({ type: 'me', lat: carAt.lat, lng: carAt.lng, heading }));
  }, [mapReady, carAt.lat, carAt.lng, heading]);

  async function choose(name: string) {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true); setError(''); setSelected(name); setQuery(name); setPlaying(false);
    sheet.current?.snapToIndex(1);
    try {
      const result = await planRoutes({ origin: carAt, destination: (origin.destinations as Record<string, Point>)[name] });
      setPlan(result); send(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { setError('Couldn’t reach the route planner. Tap a destination to retry.'); }
    finally { setBusy(false); }
  }

  function search() {
    const text = query.trim().toLowerCase();
    const match = Object.keys(origin.destinations).find((name) => name.toLowerCase().includes(text) && text.length > 1);
    if (match) void choose(match);
    else setError(`Try ${Object.keys(origin.destinations).join(' or ')}.`);
  }

  function takeRoute() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlaying(true); send({ type: 'play' });
    sheet.current?.snapToIndex(0);
  }

  function drove() {
    if (!plan || !handle) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void markDriven({ driveId: plan.drive._id, handle })
      .then(() => router.push({ pathname: '/pass', params: { driveId: plan.drive._id, stamp: '1' } }))
      .catch(() => setError('Couldn’t save your drive. Try again.'));
  }

  return <View style={styles.screen}>
    <WebView ref={web} source={{ html: mapHtml }} style={styles.map} originWhitelist={['*']} javaScriptEnabled scrollEnabled={false}
      onMessage={(event: WebViewMessageEvent) => { if (!event.nativeEvent.data.includes('ready')) return; setMapReady(true); if (plan) send(plan); }} />
    <Reanimated.View style={[styles.locate, locateStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Locate me" onPress={() => { void Haptics.selectionAsync(); send({ type: 'locate' }); }}>
        <Glass style={styles.locateGlass}>
          <SymbolView name="location.fill" size={18} tintColor={theme.accent} fallback={<Ionicons name="navigate" size={18} color={theme.accent} />} />
        </Glass>
      </Pressable>
    </Reanimated.View>
    <BottomSheet ref={sheet} index={0} snapPoints={snapPoints} animatedPosition={sheetPosition} enableDynamicSizing={false} enablePanDownToClose={false}
      backgroundComponent={SheetBackground} handleIndicatorStyle={styles.grabber}
      keyboardBehavior="extend" style={styles.sheetShadow}>
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBar + 24 }]} keyboardShouldPersistTaps="handled">
        {playing && plan ? <View style={styles.driving}>
          <View style={{ flex: 1 }}>
            <Mono style={{ color: theme.accent }}>On the vibe route · +{plan.extraMinutes} MIN</Mono>
            <Text style={styles.drivingName} numberOfLines={1}>{plan.drive.name}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="I drove it" onPress={drove} style={({ pressed }) => [styles.smallButton, pressed && { opacity: 0.85 }]}>
            <Text style={styles.smallButtonText}>I drove it</Text>
          </Pressable>
        </View> : <>
          <Glass style={styles.segmented}>
            {(Object.keys(origins) as OriginKey[]).map((key) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={origins[key].label}
              onPress={() => { void Haptics.selectionAsync(); setOriginKey(key); setSelected(null); setQuery(''); setPlan(null); setPlaying(false); setError(''); }}
              style={[styles.segment, originKey === key && styles.segmentActive]}>
              <Text style={[styles.segmentText, originKey === key && { color: theme.paper }]}>{origins[key].label}</Text>
            </Pressable>)}
          </Glass>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={theme.muted} />
            <BottomSheetTextInput accessibilityLabel="Where to?" placeholder="Where to?" placeholderTextColor={theme.muted} value={query}
              onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" style={styles.input} />
          </View>
          <View style={styles.chips}>
            {Object.keys(origin.destinations).map((name) => {
              const active = selected === name;
              return <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} disabled={busy} onPress={() => void choose(name)}
                style={[styles.chip, active && styles.chipActive]}>
                <Ionicons name={/Julian|Stinson/.test(name) ? 'trail-sign-outline' : 'business-outline'} size={14} color={active ? theme.paper : theme.ink} />
                <Text style={[styles.chipText, active && { color: theme.paper }]}>{name}</Text>
              </Pressable>;
            })}
          </View>
        </>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {busy && <View style={styles.loading}><ActivityIndicator color={theme.accent} /><Mono>Finding the good way</Mono></View>}
        {!busy && plan && <>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: theme.faint }]} />
            <Text style={[styles.rowText, { color: theme.muted }]}>Fast · {duration(plan.fastMinutes)}</Text>
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <Text style={styles.rowText}>Vibe · {duration(plan.vibeMinutes)}</Text>
            <Mono style={styles.extra}>+{plan.extraMinutes} MIN</Mono>
          </View>
          <Text style={styles.drive}>{plan.drive.name}</Text>
          <Mono style={styles.golden}>{plan.goldenHour}</Mono>
          {plan.estimated && <Mono style={{ fontSize: 9, marginTop: 6 }}>Estimated · road data offline</Mono>}
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Replay the vibe route' : 'Take the vibe route'} onPress={takeRoute}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
            <Text style={styles.buttonText}>{playing ? 'Replay the vibe route' : 'Take the vibe route'}</Text>
          </Pressable>
          <View style={[styles.divider, { marginTop: 24 }]} />
          <Mono>About this drive · {plan.drive.region}</Mono>
          <Image source={drivePhoto(plan.drive)} style={styles.photo} resizeMode="cover" />
          <Text style={styles.blurb}>{plan.drive.blurb}</Text>
          {pass && <>
            <Mono style={{ marginTop: 24, marginBottom: 12 }}>Drive pass</Mono>
            <Pressable accessibilityRole="button" accessibilityLabel="Open drive pass" onPress={() => router.push({ pathname: '/pass', params: { driveId: pass.drive._id } })}
              style={styles.passClip}>
              <DrivePass {...pass} width={320} mini />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pass', params: { driveId: pass.drive._id } })} style={[styles.button, styles.secondary]}>
              <Text style={[styles.buttonText, { color: theme.ink }]}>{pass.drivenAt ? 'Share your pass' : 'Open drive pass'}</Text>
            </Pressable>
          </>}
        </>}
        {!busy && !plan && <View style={{ marginTop: 20 }}>
          <Text style={styles.drive}>Take the long way.</Text>
          <Text style={styles.blurb}>Pick a destination and compare the fast route with one worth driving.</Text>
        </View>}
      </BottomSheetScrollView>
    </BottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.white },
  map: { flex: 1, backgroundColor: theme.white },
  sheetBackground: { borderRadius: 28, borderWidth: 0.5, borderColor: theme.hairline, overflow: 'hidden' },
  sheetTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)' },
  sheetShadow: { shadowColor: theme.ink, shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } },
  grabber: { backgroundColor: 'rgba(20,17,15,0.25)', width: 40 },
  content: { paddingHorizontal: 18 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 18, marginBottom: 10, borderWidth: 0.5, borderColor: theme.hairline },
  segment: { flex: 1, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: theme.ink },
  segmentText: { fontSize: 13, fontWeight: '600', color: theme.ink },
  locate: { position: 'absolute', right: 16 },
  locateGlass: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.hairline },
  search: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 14, gap: 8, borderRadius: 14, backgroundColor: 'rgba(20,17,15,0.06)' },
  input: { flex: 1, height: 44, fontSize: 17, color: theme.ink },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: theme.white, borderWidth: 0.5, borderColor: theme.hairline },
  chipActive: { backgroundColor: theme.ink, borderColor: theme.ink },
  chipText: { fontSize: 14, fontWeight: '500', color: theme.ink },
  driving: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 },
  drivingName: { fontFamily: fonts.serif, fontSize: 24, color: theme.ink, marginTop: 2 },
  smallButton: { height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: theme.ink, justifyContent: 'center' },
  smallButtonText: { color: theme.paper, fontSize: 15, fontWeight: '600' },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(20,17,15,0.15)', marginVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  rowText: { fontSize: 17, fontWeight: '600', color: theme.ink },
  extra: { marginLeft: 'auto', color: theme.accent, fontSize: 13 },
  drive: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: theme.ink, marginTop: 14 },
  blurb: { fontSize: 15, lineHeight: 21, color: theme.muted, marginTop: 10 },
  golden: { marginTop: 8, color: theme.ink, lineHeight: 16 },
  button: { marginTop: 18, height: 54, borderRadius: 16, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(20,17,15,0.2)' },
  buttonText: { color: theme.paper, fontSize: 17, fontWeight: '600' },
  photo: { width: '100%', height: 190, borderRadius: 16, marginTop: 12 },
  passClip: { borderRadius: 20, overflow: 'hidden', alignSelf: 'center' },
  error: { fontSize: 14, color: theme.accent, marginTop: 10 },
});
