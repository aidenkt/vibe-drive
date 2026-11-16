import { ComponentType, Ref, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation, useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { SFSymbol, SymbolView } from 'expo-symbols';
import Reanimated, { FadeInDown, FadeOutUp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
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
type Moment = Plan['moments'][number];
const kindColor: Record<string, string> = { water: '#4fb3d9', bridge: '#ff5a1f', landmark: '#14110F', viewpoint: '#c58b3a', forest: '#3f7d4e', curves: '#8E8E93', beach: '#e9c46a', city: '#6f6a64' };
const clock = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ms)).replace(/\s?[AP]M$/, '');
const momentTag = (eta: number, sunset: number): 'golden' | 'sunset' | null => eta >= sunset - 60 * 60_000 && eta < sunset - 10 * 60_000 ? 'golden' : eta >= sunset - 10 * 60_000 && eta <= sunset + 15 * 60_000 ? 'sunset' : null;
const nowMs = () => Date.now();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SANTA_CRUZ: Place = { label: 'Santa Cruz', detail: 'California', lat: 36.9743626, lng: -122.0294673 };
type MomentPhoto = { label: string; url: string | null; author: string; license: string };
type Step = Plan['steps'][number];
const kindIcon: Record<string, string> = { water: 'water.waves', bridge: 'road.lanes', landmark: 'building.columns', viewpoint: 'binoculars', forest: 'tree', curves: 'road.lanes.curved.right', beach: 'beach.umbrella', city: 'building.2' };
const turnIcon = (step?: Step) => {
  if (!step) return 'arrow.up';
  if (step.type === 'arrive') return 'mappin.circle.fill';
  if (step.type === 'merge') return 'arrow.triangle.merge';
  if (step.type === 'fork') return step.modifier.includes('left') ? 'arrow.triangle.branch' : 'arrow.triangle.branch';
  if (step.type === 'roundabout' || step.type === 'rotary') return 'arrow.triangle.turn.up.right.circle';
  if (step.modifier === 'uturn') return 'arrow.uturn.down';
  if (step.modifier.includes('slight left')) return 'arrow.up.left';
  if (step.modifier.includes('slight right')) return 'arrow.up.right';
  if (step.modifier.includes('left')) return 'arrow.turn.up.left';
  if (step.modifier.includes('right')) return 'arrow.turn.up.right';
  return 'arrow.up';
};
const turnText = (step?: Step) => !step ? 'Continue' : step.type === 'arrive' ? 'Arrive' : step.name || (step.type.includes('ramp') ? 'Take the ramp' : 'Continue');
const miles = (meters: number) => meters < 160 ? `${Math.max(50, Math.round(meters * 3.28084 / 50) * 50)} ft` : `${(meters / 1609.34).toFixed(meters < 16093 ? 1 : 0)} mi`;

function Polaroid({ photo, label, width }: { photo?: MomentPhoto; label: string; width: number }) {
  const [shown] = useState(() => new Animated.Value(0));
  if (!photo?.url) return null;
  return <View style={{ alignSelf: 'flex-start', marginTop: 10 }}>
    <View style={[styles.polaroid, { width }]}>
      <Animated.Image source={{ uri: photo.url }} style={{ width: width - 16, height: (width - 16) * 0.68, backgroundColor: '#eee', opacity: shown }}
        onLoad={() => Animated.timing(shown, { toValue: 1, duration: 300, useNativeDriver: true }).start()} />
      <Text numberOfLines={1} style={styles.polaroidLabel}>{label}</Text>
    </View>
    <Text numberOfLines={1} style={[styles.credit, { width }]}>{photo.author} · {photo.license}</Text>
  </View>;
}
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

function TimelineRow({ moment, eta, tag, last, onPress, photo }: { moment: Moment; eta: number; tag: 'golden' | 'sunset' | null; last: boolean; onPress: () => void; photo?: MomentPhoto }) {
  const color = kindColor[moment.kind] ?? theme.ink;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${moment.label} at ${clock(eta)}`} onPress={onPress} style={({ pressed }) => [styles.tlRow, pressed && { opacity: 0.6 }]}>
    <Text style={styles.tlTime}>{clock(eta)}</Text>
    <View style={styles.tlRail}>
      <View style={[styles.tlLine, last && { bottom: '50%' }]} />
      <View style={[styles.tlDot, { backgroundColor: color }]} />
    </View>
    <View style={styles.tlBody}>
      <Text style={styles.tlLabel}>{moment.label}</Text>
      <Text style={styles.tlNote}>{moment.note}</Text>
      <View style={styles.tlTags}>
        <Text style={[styles.tlKind, { color }]}>+{moment.points} {moment.kind}</Text>
        {tag && <View style={[styles.tlChip, { backgroundColor: tag === 'golden' ? '#f2c14e' : theme.accent }]}><Text style={styles.tlChipText}>{tag === 'golden' ? 'GOLDEN HOUR' : 'SUNSET'}</Text></View>}
      </View>
      <Polaroid photo={photo} label={moment.label} width={170} />
    </View>
  </Pressable>;
}

const CAPTION = 'TAKE THE LONG WAY';
function DemoCover() {
  const [icon] = useState(() => new Animated.Value(0));
  const [title] = useState(() => new Animated.Value(0));
  const [line] = useState(() => new Animated.Value(0));
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    Animated.spring(icon, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 120 }).start();
    Animated.timing(title, { toValue: 1, duration: 500, delay: 500, useNativeDriver: true }).start();
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      Animated.timing(line, { toValue: 1, duration: 900, useNativeDriver: false }).start(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
      timer = setInterval(() => setTyped((n) => { if (n >= CAPTION.length) { clearInterval(timer); return n; } return n + 1; }), 900 / CAPTION.length);
    }, 1100);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [icon, title, line]);
  return <>
    <Animated.Image source={require('../../../assets/brand/icon-1024.png')}
      style={{ width: 120, height: 120, borderRadius: 27, opacity: icon, transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }} />
    <Animated.Text style={[styles.coverTitle, { opacity: title, transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>Scenic Route</Animated.Text>
    <Animated.View style={[styles.coverLine, { width: line.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }]} />
    <Text style={styles.coverCaption}>{CAPTION.slice(0, typed)}</Text>
  </>;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const web = useRef<WebViewHandle>(null);
  const sheet = useRef<BottomSheet>(null);
  const paramDemo = useLocalSearchParams<{ demo?: string }>().demo === '1';
  const [demoOn, setDemoOn] = useState(paramDemo);
  const demo = demoOn;
  const navigation = useNavigation();
  const taps = useRef<number[]>([]);
  const startDemo = useRef<() => void>(() => {});
  const scroller = useRef<{ scrollTo: (o: { y: number; animated?: boolean }) => void } | null>(null);
  const preloaded = useRef<(() => void) | null>(null);
  const momentPhoto = useAction(api.photos.momentPhoto);
  const [cover] = useState(() => new Animated.Value(paramDemo ? 1 : 0));
  const [covered, setCovered] = useState(paramDemo);
  startDemo.current = () => { if (demoOn) return; cover.setValue(1); setCovered(true); setDemoOn(true); };
  const tripleTap = () => { const now = Date.now(); taps.current = [...taps.current.filter((t) => now - t < 900), now]; if (taps.current.length >= 3) { taps.current = []; startDemo.current(); } };
  useEffect(() => navigation.addListener('tabPress' as never, () => tripleTap()), [navigation]);
  const live = useRef<{ plan: Plan | null; nav: { done: boolean } | null; handle: string | null }>({ plan: null, nav: null, handle: null });
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
  const [plannedAt, setPlannedAt] = useState(0);
  const [goldenStart, setGoldenStart] = useState(false);
  const [nav, setNav] = useState<{ p: number; m: number; done: boolean; startedAt: number } | null>(null);
  const momentPhotos = useQuery(api.photos.byLabels, plan?.moments.length ? { labels: plan.moments.map((m) => m.label) } : 'skip');
  const photoFor = (label: string) => momentPhotos?.find((p) => p.label === label);
  useEffect(() => { momentPhotos?.forEach((p) => { if (p.url) void Image.prefetch(p.url); }); }, [momentPhotos]);
  const sheetPosition = useSharedValue(0);
  const locateStyle = useAnimatedStyle(() => ({ top: sheetPosition.value - 60 }));
  const tabBar = insets.bottom + 84;
  const snapPoints = useMemo(() => [tabBar + 170, '66%', '92%'], [tabBar]);
  const origin: Place = from === 'me' ? (me ?? SF) : from;
  const fromLabel = from === 'me' ? (me ? 'My Location' : 'San Francisco') : from.label;
  const pass = plan?.drive && passes?.find((p) => p.drive._id === plan.drive!._id);

  const suggestions = (passes ?? []).filter(({ drive }) => drive.waypoints.length > 1)
    .map((p) => ({ ...p, km: Math.hypot(p.drive.waypoints[0].lat - origin.lat, (p.drive.waypoints[0].lng - origin.lng) * Math.cos(origin.lat * Math.PI / 180)) }))
    .sort((a, b) => a.km - b.km).slice(0, 6);
  const send = (value: unknown) => web.current?.postMessage(JSON.stringify(value));
  const depart = goldenStart && plan?.leaveAt ? plan.leaveAt : plannedAt;
  const timeline = (plan?.moments ?? []).map((moment) => {
    const eta = depart + moment.offsetMinutes * 60_000;
    return { moment, eta, tag: momentTag(eta, moment.sunsetAt) };
  });
  const timelineKey = JSON.stringify(timeline.map((t) => [t.moment.lat, t.moment.lng, t.tag]));
  useEffect(() => {
    if (!mapReady) return;
    const moments = JSON.parse(timelineKey) as [number, number, string | null][];
    web.current?.postMessage(JSON.stringify({ type: 'moments', moments: moments.map(([lat, lng, tag], i) => ({ lat, lng, tag, kind: plan?.moments[i]?.kind, color: kindColor[plan?.moments[i]?.kind ?? ''] ?? '#14110F' })) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, timelineKey]);

  useEffect(() => {
    let position: Location.LocationSubscription | undefined;
    let compass: Location.LocationSubscription | undefined;
    let cancelled = false;
    if (demo) return;
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
  }, [demo]);

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
        setPlan(result); setPlannedAt(Date.now()); setGoldenStart(false); send(result);
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

  useEffect(() => { live.current = { plan, nav, handle: handle ?? null }; });

  useEffect(() => {
    if (!demo || !mapReady) return;
    let stop = false;
    void (async () => {
      const coverStart = nowMs();
      const pre = await planRoutes({ origin: { lat: SF.lat, lng: SF.lng }, destination: { lat: SANTA_CRUZ.lat, lng: SANTA_CRUZ.lng } }).catch(() => null);
      if (stop) return;
      if (pre) {
        const photos = await Promise.all(pre.moments.map((m) => momentPhoto({ label: m.label, lat: m.lat, lng: m.lng, wiki: m.wiki }).catch(() => null)));
        await Promise.all(photos.map((p) => (p?.url ? Image.prefetch(p.url).catch(() => false) : false)));
        await new Promise<void>((resolve) => {
          preloaded.current = resolve;
          send({ type: 'preload', vibe: pre.vibe ?? pre.fast, fast: pre.fast, moments: pre.moments.map((m) => [m.lat, m.lng]), start: [SF.lat, SF.lng] });
          setTimeout(resolve, 90_000);
        });
      }
      await wait(Math.max(0, 2500 - (nowMs() - coverStart)));
      if (stop) return;
      await new Promise<void>((resolve) => Animated.timing(cover, { toValue: 0, duration: 600, useNativeDriver: true }).start(() => resolve()));
      setCovered(false);
      await wait(2000); if (stop) return;
      setActive('to'); setText(''); sheet.current?.snapToIndex(2);
      for (const letter of 'Santa Cruz') { await wait(140); setText((t) => t + letter); }
      await wait(1600); if (stop) return;
      setActive(null); setText(''); setResults([]); setTo(SANTA_CRUZ);
      if (pre) { setPlan(pre); setPlannedAt(nowMs()); send(pre); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } else route(SF, SANTA_CRUZ);
      for (let i = 0; i < 60 && !live.current.plan; i++) await wait(250);
      sheet.current?.snapToIndex(1);
      await wait(3500); if (stop) return;
      sheet.current?.snapToIndex(2);
      await wait(800);
      for (let y = 0; y <= 1800; y += 150) { scroller.current?.scrollTo({ y, animated: true }); await wait(450); }
      scroller.current?.scrollTo({ y: 0, animated: true });
      await wait(600); if (stop) return;
      setPlaying(true); setNav({ p: 0, m: -1, done: false, startedAt: nowMs() }); send({ type: 'play', seconds: 34 });
      sheet.current?.close();
      for (let i = 0; i < 200 && !live.current.nav?.done; i++) await wait(250);
      await wait(3000); if (stop) return;
      const current = live.current.plan;
      setNav(null); setPlaying(false);
      if (current?.drive && live.current.handle) {
        await markDriven({ driveId: current.drive._id, handle: live.current.handle }).catch(() => undefined);
        router.push({ pathname: '/pass', params: { driveId: current.drive._id, stamp: '1' } });
        await wait(5000);
        router.back();
      }
      await wait(800); if (stop) return;
      send({ type: 'stop' }); setPlan(null); setTo(null);
      sheet.current?.snapToIndex(1);
      await wait(4000); if (stop) return;
      router.navigate('/drives');
    })();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, mapReady]);

  function takeRoute() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlaying(true); setNav({ p: 0, m: -1, done: false, startedAt: nowMs() }); send({ type: 'play' });
    sheet.current?.close();
  }

  function endRoute() {
    void Haptics.selectionAsync();
    setPlaying(false); setNav(null); send({ type: 'stop' });
    sheet.current?.snapToIndex(1);
  }

  function onMapMessage(event: WebViewMessageEvent) {
    let data: { type?: string; p?: number; m?: number; done?: boolean };
    try { data = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (data.type === 'tripletap') { startDemo.current(); return; }
    if (data.type === 'ready') { setMapReady(true); if (plan) send(plan); return; }
    if (data.type === 'preloaded') { preloaded.current?.(); preloaded.current = null; return; }
    if (data.type !== 'nav') return;
    setNav((prev) => {
      if (!prev) return prev;
      const m = data.m ?? -1;
      if (m >= 0 && m !== prev.m) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      if (data.done && !prev.done) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { ...prev, p: data.p ?? prev.p, m, done: !!data.done };
    });
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
      onMessage={onMapMessage} />
    <Reanimated.View style={[styles.locate, locateStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Locate me" onPress={() => { void Haptics.selectionAsync(); send({ type: 'locate' }); }}>
        <Glass style={styles.locateGlass}>
          <SymbolView name="location.fill" size={18} tintColor={theme.accent} fallback={<Ionicons name="navigate" size={18} color={theme.accent} />} />
        </Glass>
      </Pressable>
    </Reanimated.View>
    <BottomSheet ref={sheet} index={0} snapPoints={snapPoints} animatedPosition={sheetPosition} enableDynamicSizing={false} enablePanDownToClose={false}
      backgroundComponent={SheetBackground} handleIndicatorStyle={styles.grabber} keyboardBehavior="extend" style={styles.sheetShadow}>
      <BottomSheetScrollView ref={scroller as never} contentContainerStyle={[styles.content, { paddingBottom: tabBar + 24 }]} keyboardShouldPersistTaps="handled">
        {<>
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
          <View style={styles.routeRow}>
            <View style={[styles.routeSwatch, { backgroundColor: '#8E8E93' }]} />
            <Text style={[styles.routeName, { color: theme.muted }]}>Google Maps</Text>
            <Text style={[styles.routeTime, { color: theme.muted }]}>{duration(plan.fastMinutes)}</Text>
          </View>
          {plan.drive ? <View style={styles.routeRow}>
            <View style={[styles.routeSwatch, { backgroundColor: theme.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeName, { color: theme.accent }]}>Scenic Route</Text>
              <Mono style={{ fontSize: 10, marginTop: 2 }}>Scenic score {plan.scenicScore}</Mono>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.routeTime}>{duration(plan.vibeMinutes ?? 0)}</Text>
              <Mono style={{ color: theme.accent, fontSize: 11, marginTop: 2 }}>+{plan.extraMinutes} min</Mono>
            </View>
          </View> : <Text style={styles.noDetour}>No scenic detour on this trip yet</Text>}
          {plan.drive && <>
            <Text style={styles.drive}>{plan.drive.name}</Text>
            {!!plan.goldenHour && <Pressable accessibilityRole="button" accessibilityLabel="Leave at golden hour" onPress={() => { void Haptics.selectionAsync(); setGoldenStart((g) => !g); }}>
              <Mono style={[styles.golden, goldenStart && { color: '#b8860b' }]}>{goldenStart ? '✓ ' : ''}{plan.goldenHour}</Mono>
            </Pressable>}
            {plan.estimated && <Mono style={{ fontSize: 9, marginTop: 6 }}>Estimated · road data offline</Mono>}
            <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Replay the scenic route' : 'Take the scenic route'} onPress={takeRoute}
              style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
              <Text style={styles.buttonText}>{playing ? 'Replay the scenic route' : 'Take the scenic route'}</Text>
            </Pressable>
            <View style={[styles.divider, { marginTop: 24 }]} />
            <Text style={styles.sectionTitle}>Drive timeline</Text>
            <Mono style={{ marginBottom: 10 }}>Leave {clock(depart)} · arrive {clock(depart + (plan.vibeMinutes ?? 0) * 60_000)} · Sunset {clock(plan.sunsetAt ?? 0)}</Mono>
            {timeline.map((t, i) => <TimelineRow key={`${t.moment.label}${i}`} {...t} photo={photoFor(t.moment.label)} last={i === timeline.length - 1}
              onPress={() => { void Haptics.selectionAsync(); sheet.current?.snapToIndex(0); send({ type: 'fly', index: i }); }} />)}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Scenic score <Text style={styles.totalValue}>{plan.scenicScore}</Text></Text>
              <Text style={[styles.totalLabel, { color: theme.faint }]}>Fastest <Text style={[styles.totalValue, { color: theme.faint }]}>{plan.fastScore}</Text></Text>
            </View>
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
        {!active && !busy && !!suggestions.length && <View style={{ marginTop: 16 }}>
          <Mono style={{ marginBottom: 10 }}>Suggestions</Mono>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={272} decelerationRate="fast" contentContainerStyle={{ gap: 12, paddingRight: 18, paddingBottom: 14 }}>
            {suggestions.map(({ drive, split }) => <Pressable key={drive._id} accessibilityRole="button" accessibilityLabel={drive.name}
              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); const end = drive.waypoints[drive.waypoints.length - 1]; const place = { lat: end.lat, lng: end.lng, label: drive.name }; setTo(place); route(origin, place); }}
              style={({ pressed }) => [styles.suggestion, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Image source={drivePhoto(drive)} style={styles.suggestionPhoto} resizeMode="cover" />
              <Text numberOfLines={1} style={styles.suggestionName}>{drive.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Mono style={{ fontSize: 10 }}>{'extraMinutes' in split ? `+${split.extraMinutes} min · ${split.miles} mi` : drive.region}</Mono>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[...new Set((drive.moments ?? []).map((m) => m.kind))].slice(0, 4).map((kind) => <View key={kind} style={[styles.kindDot, { backgroundColor: kindColor[kind] ?? theme.ink }]} />)}
                </View>
              </View>
            </Pressable>)}
          </ScrollView>
        </View>}
        {!busy && !active && !plan && <View style={{ marginTop: 18 }}>
          <Text style={styles.drive}>Take the long way.</Text>
          <Text style={styles.blurb}>Pick a destination and compare the fastest route with one worth driving.</Text>
        </View>}
      </BottomSheetScrollView>
    </BottomSheet>
    {nav && plan?.drive && (() => {
      const meters = plan.meters ?? 0;
      const traveled = nav.p * meters;
      const next = plan.steps.find((st) => st.along > traveled);
      const moment = nav.m >= 0 ? timeline[nav.m] : undefined;
      const warm = !!moment?.tag;
      const minutesLeft = Math.max(0, Math.round((1 - nav.p) * (plan.vibeMinutes ?? 0)));
      return <>
        <View style={[styles.navTop, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Glass style={styles.banner}>
            <View style={styles.bannerInk} />
            <SymbolView name={turnIcon(next) as SFSymbol} size={40} tintColor={theme.white} fallback={<Ionicons name="arrow-up" size={40} color={theme.white} />} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerDistance}>{next ? miles(next.along - traveled) : miles((1 - nav.p) * meters)}</Text>
              <Text style={styles.bannerStreet} numberOfLines={1}>{turnText(next)}</Text>
            </View>
          </Glass>
          {moment && !nav.done && <Reanimated.View key={moment.moment.label} entering={FadeInDown.springify().damping(16)} exiting={FadeOutUp.duration(200)}
            style={[styles.momentCard, warm && styles.momentWarm]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.momentIcon, { backgroundColor: kindColor[moment.moment.kind] ?? theme.ink }]}>
                <SymbolView name={(kindIcon[moment.moment.kind] ?? 'star') as SFSymbol} size={16} tintColor={theme.white} fallback={<Ionicons name="star" size={14} color={theme.white} />} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.momentTitle} numberOfLines={1}>{moment.moment.label}</Text>
                <Text style={styles.momentNote} numberOfLines={2}>{moment.moment.note}</Text>
              </View>
              {moment.tag && <View style={[styles.tlChip, { backgroundColor: moment.tag === 'golden' ? '#f2c14e' : theme.accent }]}><Text style={styles.tlChipText}>{moment.tag === 'golden' ? 'GOLDEN HOUR' : 'SUNSET'}</Text></View>}
            </View>
            <Polaroid photo={photoFor(moment.moment.label)} label={moment.moment.label} width={190} />
          </Reanimated.View>}
        </View>
        {!nav.done && <Glass style={[styles.navBottom, { bottom: tabBar + 8 }]}>
          <View style={styles.navStat}><Text style={styles.navValue}>{clock(nav.startedAt + (plan.vibeMinutes ?? 0) * 60_000)}</Text><Mono style={{ fontSize: 9 }}>arrival</Mono></View>
          <View style={styles.navStat}><Text style={styles.navValue}>{minutesLeft}</Text><Mono style={{ fontSize: 9 }}>min</Mono></View>
          <View style={styles.navStat}><Text style={styles.navValue}>{((1 - nav.p) * meters / 1609.34).toFixed(1)}</Text><Mono style={{ fontSize: 9 }}>mi</Mono></View>
          <Pressable accessibilityRole="button" accessibilityLabel="End route" onPress={endRoute} style={styles.endButton}><Text style={styles.endText}>End</Text></Pressable>
        </Glass>}
        {nav.done && <View style={styles.arrival}>
          <Reanimated.View entering={FadeInDown.springify().damping(14)} style={styles.arrivalCard}>
            <Mono style={{ color: theme.accent }}>{plan.drive.name}</Mono>
            <Text style={styles.arrivalTitle}>You took the scenic route</Text>
            <Text style={styles.blurb}>+{plan.extraMinutes} min on purpose · scenic score {plan.scenicScore}</Text>
            {pass && <View style={[styles.passClip, { marginTop: 16 }]}><DrivePass {...pass} width={260} mini /></View>}
            <Pressable accessibilityRole="button" accessibilityLabel="I drove it" onPress={() => { setNav(null); setPlaying(false); drove(); }} style={({ pressed }) => [styles.button, { alignSelf: 'stretch' }, pressed && { opacity: 0.85 }]}>
              <Text style={styles.buttonText}>I drove it</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share" onPress={() => { setNav(null); setPlaying(false); router.push({ pathname: '/pass', params: { driveId: plan.drive!._id } }); }} style={{ marginTop: 14 }}>
              <Text style={[styles.chipText, { color: theme.accent }]}>Share the pass</Text>
            </Pressable>
          </Reanimated.View>
        </View>}
      </>;
    })()}
    {covered && <Animated.View style={[styles.cover, { opacity: cover }]}>
      <DemoCover />
    </Animated.View>}
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
  tlRow: { flexDirection: 'row', minHeight: 64 },
  tlTime: { width: 44, fontFamily: fonts.monoMedium, fontSize: 13, color: theme.ink, paddingTop: 2 },
  tlRail: { width: 22, alignItems: 'center' },
  tlLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(20,17,15,0.15)' },
  tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4, borderWidth: 2, borderColor: theme.white },
  tlBody: { flex: 1, paddingLeft: 8, paddingBottom: 16 },
  tlLabel: { fontSize: 16, fontWeight: '600', color: theme.ink },
  tlNote: { fontSize: 14, color: theme.muted, marginTop: 2 },
  tlTags: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  tlKind: { fontFamily: fonts.monoMedium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  tlChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tlChipText: { fontFamily: fonts.monoMedium, fontSize: 10, color: theme.white, letterSpacing: 0.8 },
  photo: { width: '100%', height: 190, borderRadius: 16, marginTop: 12 },
  passClip: { borderRadius: 20, overflow: 'hidden', alignSelf: 'center' },
  polaroid: { backgroundColor: theme.white, padding: 8, paddingBottom: 0, transform: [{ rotate: '-2deg' }], shadowColor: theme.ink, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  polaroidLabel: { height: 28, lineHeight: 28, fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 15, color: theme.ink, paddingHorizontal: 2 },
  credit: { fontSize: 9, color: theme.faint, marginTop: 6 },
  navTop: { position: 'absolute', left: 12, right: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, overflow: 'hidden' },
  bannerInk: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,17,15,0.82)' },
  bannerDistance: { fontSize: 32, fontWeight: '700', color: theme.white },
  bannerStreet: { fontSize: 20, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  momentCard: { marginTop: 10, padding: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', shadowColor: theme.ink, shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  momentWarm: { backgroundColor: '#fff3d6', borderWidth: 1, borderColor: '#f2c14e' },
  momentIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  momentTitle: { fontSize: 17, fontWeight: '600', color: theme.ink },
  momentNote: { fontSize: 14, color: theme.muted, marginTop: 2 },
  navBottom: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.85)' },
  navStat: { flex: 1, alignItems: 'center' },
  navValue: { fontSize: 22, fontWeight: '700', color: theme.ink },
  endButton: { height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: '#e5483a', justifyContent: 'center' },
  endText: { color: theme.white, fontSize: 17, fontWeight: '700' },
  arrival: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,17,15,0.35)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  arrivalCard: { alignSelf: 'stretch', alignItems: 'center', padding: 22, borderRadius: 28, backgroundColor: theme.paper },
  arrivalTitle: { fontFamily: fonts.serif, fontSize: 32, color: theme.ink, textAlign: 'center', marginTop: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(20,17,15,0.1)' },
  routeSwatch: { width: 6, height: 32, borderRadius: 3 },
  routeName: { flex: 1, fontSize: 17, fontWeight: '600' },
  routeTime: { fontSize: 20, fontWeight: '700', color: theme.ink },
  suggestion: { width: 260, backgroundColor: theme.white, padding: 10, paddingBottom: 14, borderRadius: 4, shadowColor: theme.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  suggestionPhoto: { width: 240, height: 140, backgroundColor: '#eee' },
  suggestionName: { fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 22, color: theme.ink, marginTop: 8 },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#14110F', alignItems: 'center', justifyContent: 'center' },
  coverTitle: { fontFamily: fonts.serif, fontSize: 44, color: '#F2EADB', marginTop: 22 },
  coverLine: { height: 1.5, backgroundColor: '#FF5A1F', marginTop: 10 },
  coverCaption: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 3, color: 'rgba(242,234,219,0.6)', marginTop: 12, height: 16 },
  error: { fontSize: 14, color: theme.accent, marginTop: 10 },
});
