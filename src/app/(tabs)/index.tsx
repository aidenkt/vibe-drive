import { ComponentType, Ref, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction, useMutation } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { WebView as RNWebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { api } from '../../../convex/_generated/api';
import { mapHtml } from '../../components/mapHtml';
import { fonts, Mono, Sheet, theme } from '../../components/ui';
import { useHandle } from '../../lib/handle';

const destinations = { 'Los Angeles': { lat: 34.0522, lng: -118.2437 }, Julian: { lat: 33.0787, lng: -116.6019 } };
type Destination = keyof typeof destinations;
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes) % 60).padStart(2, '0')}m`;
type WebViewHandle = { postMessage: (message: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;
type Plan = FunctionReturnType<typeof api.routes.planRoutes>;

export default function Home() {
  const insets = useSafeAreaInsets();
  const web = useRef<WebViewHandle>(null);
  const planRoutes = useAction(api.routes.planRoutes);
  const markDriven = useMutation(api.drives.markDriven);
  const handle = useHandle();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Destination | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rise] = useState(() => new Animated.Value(0));
  const sheetKey = busy ? 'busy' : plan ? plan.drive._id + plan.vibeMinutes : 'intro';

  useEffect(() => {
    rise.setValue(0);
    Animated.spring(rise, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }).start();
  }, [sheetKey, rise]);

  const send = (value: unknown) => web.current?.postMessage(JSON.stringify(value));

  async function choose(name: Destination) {
    if (busy) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(true); setError(''); setSelected(name); setQuery(name); setPlaying(false);
    try {
      const result = await planRoutes({ origin: { lat: 32.7157, lng: -117.1611 }, destination: destinations[name] });
      setPlan(result); send(result);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { setError('Couldn’t reach the route planner. Tap a destination to retry.'); }
    finally { setBusy(false); }
  }

  function search() {
    const text = query.trim().toLowerCase();
    if (text.includes('julian')) void choose('Julian');
    else if (text.includes('los angeles') || text === 'la') void choose('Los Angeles');
    else setError('Try Los Angeles or Julian for the demo.');
  }

  function primary() {
    if (!plan) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!playing) { setPlaying(true); send({ type: 'play' }); return; }
    if (!handle) return;
    void markDriven({ driveId: plan.drive._id, handle })
      .then(() => router.push({ pathname: '/pass', params: { driveId: plan.drive._id, stamp: '1' } }))
      .catch(() => setError('Couldn’t save your drive. Try again.'));
  }

  return <View style={styles.screen}>
    <WebView ref={web} source={{ html: mapHtml }} style={styles.map} originWhitelist={['*']} javaScriptEnabled scrollEnabled={false}
      onMessage={(event: WebViewMessageEvent) => { if (event.nativeEvent.data.includes('ready') && plan) send(plan); }} />
    <View style={[styles.top, { top: insets.top + 8 }]}>
      <Sheet radius={24} contentStyle={styles.search}>
        <Ionicons name="search" size={18} color={theme.muted} />
        <TextInput accessibilityLabel="Where to?" placeholder="Where to?" placeholderTextColor={theme.muted} value={query} onChangeText={setQuery}
          onSubmitEditing={search} returnKeyType="search" style={styles.input} />
      </Sheet>
      <View style={styles.chips}>
        {(Object.keys(destinations) as Destination[]).map((name) => {
          const active = selected === name;
          return <Pressable key={name} accessibilityRole="button" accessibilityLabel={name} disabled={busy} onPress={() => void choose(name)}>
            {active ? <View style={[styles.chip, styles.chipActive]}><Text style={[styles.chipText, { color: theme.paper }]}>{name}</Text></View>
              : <Sheet radius={16} contentStyle={styles.chip}><Text style={styles.chipText}>{name}</Text></Sheet>}
          </Pressable>;
        })}
      </View>
    </View>
    <Animated.View style={[styles.bottom, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
      {!!error && <Sheet radius={16} style={{ marginBottom: 8 }} contentStyle={{ padding: 12 }}><Text style={styles.error}>{error}</Text></Sheet>}
      <Sheet contentStyle={styles.sheet}>
        {busy ? <View style={styles.loading}><ActivityIndicator color={theme.accent} /><Mono>Finding the good way</Mono></View>
          : plan ? <>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: theme.faint }]} />
              <Text style={[styles.rowText, { color: theme.muted }]}>Fast · {duration(plan.fastMinutes)}</Text>
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <Text style={styles.rowText}>Vibe · {duration(plan.vibeMinutes)}</Text>
              <Mono style={styles.extra}>+{plan.extraMinutes} MIN</Mono>
            </View>
            <View style={styles.divider} />
            <Text style={styles.drive}>{plan.drive.name}</Text>
            <Text style={styles.blurb}>{plan.drive.blurb}</Text>
            <Mono style={styles.golden}>{plan.goldenHour}</Mono>
            {plan.estimated && <Mono style={{ fontSize: 9, marginTop: 6 }}>Estimated · road data offline</Mono>}
            <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'I drove it' : 'Take the vibe route'} onPress={primary} style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}>
              <Text style={styles.buttonText}>{playing ? 'I drove it' : 'Take the vibe route'}</Text>
            </Pressable>
            {playing && <Pressable accessibilityRole="button" onPress={() => send({ type: 'play' })} hitSlop={8} style={{ alignSelf: 'center', marginTop: 10 }}><Mono>Replay route</Mono></Pressable>}
          </> : <>
            <Mono>Scenic routing · SoCal</Mono>
            <Text style={[styles.drive, { marginTop: 6 }]}>Take the long way.</Text>
            <Text style={styles.blurb}>Pick a destination and compare the fast route with one worth driving.</Text>
          </>}
      </Sheet>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.white },
  map: { flex: 1, backgroundColor: theme.white },
  top: { position: 'absolute', left: 16, right: 16 },
  search: { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 16, gap: 10 },
  input: { flex: 1, height: 48, fontSize: 17, color: theme.ink },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: { height: 34, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 16 },
  chipActive: { backgroundColor: theme.ink },
  chipText: { fontSize: 14, fontWeight: '500', color: theme.ink },
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  sheet: { padding: 20 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  rowText: { fontSize: 17, fontWeight: '600', color: theme.ink },
  extra: { marginLeft: 'auto', color: theme.accent, fontSize: 13 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.hairline, marginVertical: 16 },
  drive: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, color: theme.ink },
  blurb: { fontSize: 14, lineHeight: 20, color: theme.muted, marginTop: 6 },
  golden: { marginTop: 12, color: theme.ink, lineHeight: 16 },
  button: { marginTop: 18, height: 54, borderRadius: 16, backgroundColor: theme.ink, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: theme.paper, fontSize: 17, fontWeight: '600' },
  error: { fontSize: 14, color: theme.ink },
});
