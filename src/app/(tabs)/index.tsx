import { ComponentType, Ref, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SFSymbol, SymbolView } from 'expo-symbols';
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

type Place = { lat: number; lng: number; label: string; detail?: string };
type Field = 'from' | 'to';
const SF: Place = { lat: 37.788, lng: -122.4075, label: 'San Francisco' };
const shortcuts: Place[] = [
  { label: 'Stinson Beach', lat: 37.9005, lng: -122.644 },
  { label: 'Sausalito', lat: 37.8591, lng: -122.4853 },
  { label: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { label: 'Julian', lat: 33.0787, lng: -116.6019 },
];
const duration = (minutes: number) => minutes < 60 ? `${Math.round(minutes)} min` : `${Math.floor(minutes / 60)}h ${String(Math.round(minutes) % 60).padStart(2, '0')}m`;
type WebViewHandle = { postMessage: (message: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;
type Plan = FunctionReturnType<typeof api.routes.planRoutes>;
type Item = Plan['scenicItems'][number];
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };

function SheetBackground({ style }: BottomSheetBackgroundProps) {
  return <Glass style={[style, styles.sheetBackground]}><View style={styles.sheetTint} /></Glass>;
}

function ItemRow({ item, index, muted }: { item: Item; index: number; muted?: boolean }) {
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => { Animated.timing(shown, { toValue: 1, duration: 280, delay: index * 60, useNativeDriver: true }).start(); }, [shown, index]);
  const dim = muted || item.muted;
  return <Animated.View style={[styles.itemRow, { opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
    <SymbolView name={item.icon as SFSymbol} size={18} tintColor={dim ? theme.faint : theme.ink} fallback={<Ionicons name="ellipse-outline" size={14} color={theme.faint} />} />
    <Text style={[styles.itemLabel, dim && { color: theme.faint }]}>{item.label}</Text>
    <Text style={[styles.itemPoints, dim && { color: theme.faint }]}>{item.points > 0 ? `+${item.points}` : item.points < 0 ? `−${-item.points}` : '0'}</Text>
  </Animated.View>;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const web = useRef<WebViewHandle>(null);
  const sheet = useRef<BottomSheet>(null);
  const planRun = useRef(0);
  const planRoutes = useAction(api.routes.planRoutes);
  const markDriven = useMutation(api.drives.markDriven);
  const handle = useHandle();
  const { passes } = usePasses();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [me, setMe] = useState<Place | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [from, setFrom] = useState<Place | 'me'>('me');
  const [to, setTo] = useState<Place | null>(null);
  const [active, setActive] = useState<Field | null>(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const sheetPosition = useSharedValue(0);
  const locateStyle = useAnimatedStyle(() => ({ top: sheetPosition.value - 60 }));
  const tabBar = insets.bottom + 84;
  const snapPoints = useMemo(() => [tabBar + 170, '66%', '92%'], [tabBar]);
  const origin: Place = from === 'me' ? (me ?? SF) : from;
  const fromLabel = from === 'me' ? (me ? 'My Location' : 'San Francisco') : from.label;
  const pass = plan?.drive && passes?.find((p) => p.drive._id === plan.drive!._id);

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
          (l) => setMe({ lat: l.coords.latitude, lng: l.coords.longitude, label: 'My Location' }));
        compass = await Location.watchHeadingAsync((h) => {
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading((prev) => (prev === null || Math.abs(((value - prev + 540) % 360) - 180) > 5 ? value : prev));
        });
      } catch {}
    })();
    return () => { cancelled = true; position?.remove(); compass?.remove(); };
  }, []);

  const carAt = me ?? SF;
  useEffect(() => {
    if (mapReady) web.current?.postMessage(JSON.stringify({ type: 'me', lat: carAt.lat, lng: carAt.lng, heading }));
  }, [mapReady, carAt.lat, carAt.lng, heading]);

  useEffect(() => {
    if (!active) return;
    const q = text.trim();
    const coords = q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (coords) { setResults([{ lat: Number(coords[1]), lng: Number(coords[2]), label: q, detail: 'Coordinates' }]); return; }
      if (q.length < 2) { setResults([]); return; }
      fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en&lat=${carAt.lat}&lon=${carAt.lng}`, { signal: controller.signal })
        .then((r) => r.json() as Promise<{ features?: PhotonFeature[] }>)
        .then((data) => {
          const places = (data.features ?? []).map((f) => {
            const p = f.properties;
            return { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], label: p.name ?? p.street ?? p.city ?? q,
              detail: [p.street && [p.housenumber, p.street].filter(Boolean).join(' '), p.city, p.state].filter((x) => x && x !== p.name).join(', ') };
          });
          setResults(places);
          setError(places.length ? '' : 'Couldn’t find that place.');
        })
        .catch((e: Error) => { if (e.name !== 'AbortError') setError('Search is offline. Check your connection.'); })
        .finally(() => setSearching(false));
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, active, carAt.lat, carAt.lng]);

  function route(a: Place, b: Place | null) {
    if (!b) return;
    const run = ++planRun.current;
    setBusy(true); setError(''); setPlaying(false);
    sheet.current?.snapToIndex(1);
    planRoutes({ origin: { lat: a.lat, lng: a.lng }, destination: { lat: b.lat, lng: b.lng } })
      .then((result) => {
        if (run !== planRun.current) return;
        setPlan(result); send(result);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch(() => { if (run === planRun.current) setError('Couldn’t plan that route. Try another place.'); })
      .finally(() => { if (run === planRun.current) setBusy(false); });
  }

  function edit(field: Field) {
    setActive(field); setResults([]); setError('');
    setText(field === 'from' ? (from === 'me' ? '' : from.label) : (to?.label ?? ''));
    sheet.current?.snapToIndex(2);
  }

  function pick(place: Place) {
    void Haptics.selectionAsync();
    if (active === 'from') { setFrom(place); route(place, to); } else { setTo(place); route(origin, place); }
    setActive(null); setResults([]); setText('');
  }

  function swap() {
    if (!to) return;
    void Haptics.selectionAsync();
    setTo(origin);
    setFrom(to);
    route(to, origin);
  }

  function takeRoute() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlaying(true); send({ type: 'play' });
    sheet.current?.snapToIndex(0);
  }

  function drove() {
    if (!plan?.drive || !handle) return;
    const driveId = plan.drive._id;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void markDriven({ driveId, handle })
      .then(() => router.push({ pathname: '/pass', params: { driveId, stamp: '1' } }))
      .catch(() => setError('Couldn’t save your drive. Try again.'));
  }

  const fieldRow = (field: Field, label: string, value: string, placeholder: string) => {
    const editing = active === field;
    return <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${value}`} onPress={() => edit(field)} style={styles.field}>
      <Mono style={styles.fieldLabel}>{label}</Mono>
      {editing ? <BottomSheetTextInput autoFocus value={text} onChangeText={(t) => { setText(t); setSearching(t.trim().length >= 2 && !/^-?\d/.test(t.trim())); }} placeholder={placeholder} placeholderTextColor={theme.faint}
        returnKeyType="search" onSubmitEditing={() => results[0] && pick(results[0])} style={styles.fieldInput} />
        : <Text numberOfLines={1} style={[styles.fieldValue, !value && { color: theme.faint }]}>{value || placeholder}</Text>}
    </Pressable>;
  };

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
      backgroundComponent={SheetBackground} handleIndicatorStyle={styles.grabber} keyboardBehavior="extend" style={styles.sheetShadow}>
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBar + 24 }]} keyboardShouldPersistTaps="handled">
        {playing && plan?.drive && !active ? <View style={styles.driving}>
          <View style={{ flex: 1 }}>
            <Mono style={{ color: theme.accent }}>On the scenic route · +{plan.extraMinutes} MIN</Mono>
            <Text style={styles.drivingName} numberOfLines={1}>{plan.drive.name}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="I drove it" onPress={drove} style={({ pressed }) => [styles.smallButton, pressed && { opacity: 0.85 }]}>
            <Text style={styles.smallButtonText}>I drove it</Text>
          </Pressable>
        </View> : <>
          <View style={styles.fields}>
            <View style={{ flex: 1 }}>
              {fieldRow('from', 'From', fromLabel, 'My Location')}
              <View style={styles.fieldDivider} />
              {fieldRow('to', 'To', to?.label ?? '', 'Where to?')}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Swap start and destination" onPress={swap} hitSlop={8} style={styles.swap}>
              <SymbolView name="arrow.up.arrow.down" size={16} tintColor={theme.ink} fallback={<Ionicons name="swap-vertical" size={16} color={theme.ink} />} />
            </Pressable>
          </View>
          {active ? <View style={{ marginTop: 6 }}>
            {active === 'from' && me && <Pressable onPress={() => { setFrom('me'); setActive(null); setText(''); route(me, to); }} style={styles.result}>
              <SymbolView name="location.fill" size={16} tintColor={theme.accent} fallback={<Ionicons name="navigate" size={16} color={theme.accent} />} />
              <View style={{ flex: 1 }}><Text style={styles.resultName}>My Location</Text></View>
            </Pressable>}
            {searching && <ActivityIndicator color={theme.accent} style={{ marginVertical: 10 }} />}
            {results.map((place, i) => <Pressable key={`${place.lat},${place.lng},${i}`} accessibilityRole="button" onPress={() => pick(place)} style={styles.result}>
              <Ionicons name="location-outline" size={18} color={theme.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={1}>{place.label}</Text>
                {!!place.detail && <Text style={styles.resultDetail} numberOfLines={1}>{place.detail}</Text>}
              </View>
            </Pressable>)}
            <Pressable onPress={() => { setActive(null); setText(''); setResults([]); }} hitSlop={8} style={{ alignSelf: 'flex-end', marginTop: 8 }}><Mono>Cancel</Mono></Pressable>
          </View> : <View style={styles.chips}>
            {shortcuts.map((place) => {
              const selected = to?.label === place.label;
              return <Pressable key={place.label} accessibilityRole="button" accessibilityLabel={place.label} onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTo(place); route(origin, place); }}
                style={[styles.chip, selected && styles.chipActive]}>
                <Text style={[styles.chipText, selected && { color: theme.paper }]}>{place.label}</Text>
              </Pressable>;
            })}
          </View>}
        </>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {busy && <View style={styles.loading}><ActivityIndicator color={theme.accent} /><Mono>Finding the scenic way</Mono></View>}
        {!busy && !active && plan && <>
          <View style={styles.divider} />
          <View style={styles.compare}>
            <View style={styles.compareCol}>
              <Mono>Fastest</Mono>
              <Text style={[styles.score, { color: theme.muted }]}>{plan.fastScore}</Text>
              <Text style={[styles.compareTime, { color: theme.muted }]}>{duration(plan.fastMinutes)}</Text>
              <Text style={styles.caption}>the route Google Maps gives you</Text>
            </View>
            {plan.drive ? <>
              <View style={styles.vs}><Mono style={{ color: theme.accent }}>+{plan.extraMinutes} MIN</Mono></View>
              <View style={[styles.compareCol, { alignItems: 'flex-end' }]}>
                <Mono style={{ color: theme.accent }}>Scenic</Mono>
                <Text style={[styles.score, { color: theme.accent }]}>{plan.scenicScore}</Text>
                <Text style={styles.compareTime}>{duration(plan.vibeMinutes ?? 0)}</Text>
                <Text style={styles.caption}>scenic score</Text>
              </View>
            </> : <View style={[styles.compareCol, { alignItems: 'flex-end', justifyContent: 'center' }]}>
              <Text style={styles.noDetour}>No scenic detour on this trip yet</Text>
            </View>}
          </View>
          {plan.drive && <>
            <Text style={styles.drive}>{plan.drive.name}</Text>
            {!!plan.goldenHour && <Mono style={styles.golden}>{plan.goldenHour}</Mono>}
            {plan.estimated && <Mono style={{ fontSize: 9, marginTop: 6 }}>Estimated · road data offline</Mono>}
            <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Replay the scenic route' : 'Take the scenic route'} onPress={takeRoute}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
              <Text style={styles.buttonText}>{playing ? 'Replay the scenic route' : 'Take the scenic route'}</Text>
            </Pressable>
            <View style={[styles.divider, { marginTop: 24 }]} />
            <Text style={styles.sectionTitle}>What’s good about this route</Text>
            {plan.scenicItems.map((item, i) => <ItemRow key={item.label} item={item} index={i} />)}
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Scenic score</Text><Text style={styles.totalValue}>{plan.scenicScore}</Text></View>
          </>}
          <Text style={[styles.sectionTitle, { color: theme.faint, fontSize: 15, marginTop: 22 }]}>The fast way</Text>
          {plan.fastItems.map((item, i) => <ItemRow key={item.label} item={item} index={i} muted />)}
          {plan.drive && <>
            <View style={[styles.divider, { marginTop: 24 }]} />
            <Mono>About this drive · {plan.drive.region}</Mono>
            <Image source={drivePhoto(plan.drive)} style={styles.photo} resizeMode="cover" />
            <Text style={styles.blurb}>{plan.drive.blurb}</Text>
          </>}
          {pass && <>
            <Mono style={{ marginTop: 24, marginBottom: 12 }}>Drive pass</Mono>
            <Pressable accessibilityRole="button" accessibilityLabel="Open drive pass" onPress={() => router.push({ pathname: '/pass', params: { driveId: pass.drive._id } })} style={styles.passClip}>
              <DrivePass {...pass} width={320} mini />
            </Pressable>
          </>}
        </>}
        {!busy && !active && !plan && <View style={{ marginTop: 18 }}>
          <Text style={styles.drive}>Take the long way.</Text>
          <Text style={styles.blurb}>Pick a destination and compare the fastest route with one worth driving.</Text>
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
  locate: { position: 'absolute', right: 16 },
  locateGlass: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: theme.hairline },
  fields: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(20,17,15,0.06)', paddingLeft: 14 },
  field: { flexDirection: 'row', alignItems: 'center', height: 44, gap: 10 },
  fieldLabel: { width: 40, fontSize: 10 },
  fieldValue: { flex: 1, fontSize: 17, color: theme.ink },
  fieldInput: { flex: 1, height: 44, fontSize: 17, color: theme.ink },
  fieldDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(20,17,15,0.15)', marginLeft: 50 },
  swap: { width: 44, height: 88, alignItems: 'center', justifyContent: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(20,17,15,0.12)' },
  resultName: { fontSize: 16, color: theme.ink },
  resultDetail: { fontSize: 13, color: theme.muted, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { height: 32, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 16, backgroundColor: theme.white, borderWidth: 0.5, borderColor: theme.hairline },
  chipActive: { backgroundColor: theme.ink, borderColor: theme.ink },
  chipText: { fontSize: 14, fontWeight: '500', color: theme.ink },
  driving: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 },
  drivingName: { fontFamily: fonts.serif, fontSize: 24, color: theme.ink, marginTop: 2 },
  smallButton: { height: 44, paddingHorizontal: 18, borderRadius: 14, backgroundColor: theme.ink, justifyContent: 'center' },
  smallButtonText: { color: theme.paper, fontSize: 15, fontWeight: '600' },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(20,17,15,0.15)', marginVertical: 16 },
  compare: { flexDirection: 'row', alignItems: 'stretch' },
  compareCol: { flex: 1 },
  vs: { justifyContent: 'center', paddingHorizontal: 8 },
  score: { fontFamily: fonts.serif, fontSize: 48, lineHeight: 52, marginTop: 4 },
  compareTime: { fontSize: 16, fontWeight: '600', color: theme.ink },
  caption: { fontSize: 11, color: theme.faint, marginTop: 2 },
  noDetour: { fontFamily: fonts.serif, fontSize: 22, color: theme.muted, textAlign: 'right' },
  drive: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: theme.ink, marginTop: 16 },
  blurb: { fontSize: 15, lineHeight: 21, color: theme.muted, marginTop: 10 },
  golden: { marginTop: 8, color: theme.ink, lineHeight: 16 },
  button: { marginTop: 18, height: 54, borderRadius: 16, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: theme.paper, fontSize: 17, fontWeight: '600' },
  sectionTitle: { fontFamily: fonts.serif, fontSize: 22, color: theme.ink, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(20,17,15,0.1)' },
  itemLabel: { flex: 1, fontSize: 15, color: theme.ink },
  itemPoints: { fontFamily: fonts.monoMedium, fontSize: 14, color: theme.accent },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12 },
  totalLabel: { fontSize: 15, fontWeight: '600', color: theme.ink },
  totalValue: { fontFamily: fonts.monoMedium, fontSize: 20, color: theme.accent },
  photo: { width: '100%', height: 190, borderRadius: 16, marginTop: 12 },
  passClip: { borderRadius: 20, overflow: 'hidden', alignSelf: 'center' },
  error: { fontSize: 14, color: theme.accent, marginTop: 10 },
});
