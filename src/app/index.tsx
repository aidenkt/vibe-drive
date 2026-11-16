import { useRef, useState , ComponentType, Ref } from 'react';
import { View, Pressable, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { WebView as RNWebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { api } from '../../convex/_generated/api';
import { mapHtml } from '../components/mapHtml';
import { colors, PixelText } from '../components/ui';

const destinations = { 'LOS ANGELES': { lat: 34.0522, lng: -118.2437 }, JULIAN: { lat: 33.0787, lng: -116.6019 } };
const duration = (minutes: number) => `${Math.floor(minutes / 60)}:${String(Math.round(minutes) % 60).padStart(2, '0')}`;
type WebViewHandle = { postMessage: (message: string) => void };
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;
type Plan = FunctionReturnType<typeof api.routes.planRoutes>;

export default function Home() {
  const insets = useSafeAreaInsets();
  const web = useRef<WebViewHandle>(null);
  const planRoutes = useAction(api.routes.planRoutes);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [playing, setPlaying] = useState(false);
  const send = (value: unknown) => web.current?.postMessage(JSON.stringify(value));
  async function choose(name: keyof typeof destinations) {
    if (busy) return;
    setBusy(true); setError(''); setSelected(name); setQuery(name); setPlaying(false);
    try {
      const result = await planRoutes({ origin: { lat: 32.7157, lng: -117.1611 }, destination: destinations[name] });
      setPlan(result); send(result);
    } catch { setError('Connection lost. Tap a destination to retry.'); }
    finally { setBusy(false); }
  }
  function search() {
    const text = query.trim().toUpperCase();
    if (text.includes('JULIAN')) void choose('JULIAN');
    else if (text.includes('LOS ANGELES') || text === 'LA') void choose('LOS ANGELES');
    else setError('Demo destinations: Los Angeles or Julian.');
  }
  return <View style={styles.screen}>
    <WebView ref={web} source={{ html: mapHtml }} style={styles.map} originWhitelist={['*']} javaScriptEnabled scrollEnabled={false} onMessage={(event: WebViewMessageEvent) => { if (event.nativeEvent.data.includes('ready') && plan) send(plan); }} />
    <View style={[styles.top, { top: insets.top + 12 }]}>
      <View style={styles.brand}><PixelText style={styles.logo}>VIBE DRIVE</PixelText><PixelText style={styles.level}>SOCAL / LVL 01</PixelText></View>
      <View style={styles.search}><PixelText style={{ color: colors.pink }}>↗</PixelText><TextInput accessibilityLabel="Where to?" placeholder="WHERE TO?" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" style={styles.input} /></View>
      <View style={styles.shortcuts}>{(Object.keys(destinations) as (keyof typeof destinations)[]).map(name => <Pressable accessibilityRole="button" accessibilityLabel={name} disabled={busy} key={name} onPress={() => void choose(name)} style={[styles.quick, selected === name && styles.active]}><PixelText style={{ fontSize: 8, color: selected === name ? colors.bg : colors.ink }}>{name === 'JULIAN' ? '↗ ' : '↑ '}{name}</PixelText></Pressable>)}</View>
    </View>
    <View style={styles.bottom}>
      {error ? <View style={styles.notice}><PixelText style={{ color: colors.yellow, fontSize: 8 }}>{error}</PixelText></View> : null}
      {busy ? <View style={styles.card}><ActivityIndicator color={colors.pink} /><PixelText style={styles.loading}>FINDING THE GOOD WAY...</PixelText></View> : plan ? <View style={styles.card}>
        <View style={styles.cardEyebrow}><PixelText style={{ color: colors.green, fontSize: 7 }}>✦ SCENIC ROUTE UNLOCKED</PixelText><PixelText style={{ color: colors.muted, fontSize: 7 }}>01 / 06</PixelText></View>
        <View style={styles.times}><View style={styles.fast}><PixelText style={styles.label}>FAST</PixelText><PixelText style={styles.fastTime}>{duration(plan.fastMinutes)}</PixelText></View><View style={styles.vibe}><View style={styles.vibeHead}><PixelText style={{ color: colors.pink, fontSize: 9 }}>VIBE</PixelText><PixelText style={styles.extra}>+{plan.extraMinutes} MIN</PixelText></View><PixelText style={styles.vibeTime}>{duration(plan.vibeMinutes)}</PixelText></View></View>
        <PixelText style={styles.driveName}>{plan.drive.name}</PixelText>
        <PixelText style={styles.blurb}>{plan.drive.blurb}</PixelText>
        <View style={styles.sun}><PixelText style={{ color: colors.yellow, fontSize: 7, lineHeight: 13 }}>{plan.goldenHour}</PixelText></View>
        {plan.estimated && <PixelText style={styles.estimate}>ESTIMATED ROUTES · ROAD DATA OFFLINE</PixelText>}
        <Pressable accessibilityRole="button" accessibilityLabel="TAKE THE VIBE ROUTE" style={styles.go} onPress={() => { setPlaying(true); send({ type: 'play' }); }}><PixelText style={styles.goText}>{playing ? 'REPLAY THE VIBE ROUTE' : 'TAKE THE VIBE ROUTE'}  →</PixelText></Pressable>
      </View> : <View style={styles.card}><PixelText style={styles.intro}>LESS RUSH.{ '\n' }MORE WOW.</PixelText><PixelText style={styles.blurb}>The best part isn’t getting there.</PixelText><PixelText style={{ fontSize: 7, color: colors.green, marginTop: 12 }}>PICK A DESTINATION. FIND YOUR DETOUR. ↑</PixelText></View>}
      <PixelText style={styles.footer}>BUILT FOR THE DRIVE, NOT THE ARRIVAL.</PixelText>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, map: { flex: 1, backgroundColor: '#b9d3bd' }, top: { position: 'absolute', left: 16, right: 16 }, brand: { backgroundColor: colors.bg, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: colors.border }, logo: { fontSize: 13, color: colors.yellow }, level: { fontSize: 6, color: colors.muted }, search: { marginTop: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 52, backgroundColor: colors.bg, borderColor: colors.ink, borderWidth: 2 }, input: { flex: 1, height: 48, paddingLeft: 12, fontFamily: 'PressStart2P_400Regular', fontSize: 10, color: colors.ink }, shortcuts: { flexDirection: 'row', gap: 8, marginTop: 8 }, quick: { backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 12 }, active: { backgroundColor: colors.yellow, borderColor: colors.yellow }, bottom: { position: 'absolute', bottom: 8, left: 16, right: 16 }, card: { padding: 16, borderColor: colors.border, borderWidth: 2, backgroundColor: colors.bg }, cardEyebrow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, times: { flexDirection: 'row', borderBottomColor: colors.border, borderBottomWidth: 2, paddingBottom: 12, marginBottom: 12 }, fast: { width: '36%', borderRightWidth: 2, borderColor: colors.border }, vibe: { flex: 1, paddingLeft: 16 }, label: { fontSize: 8, color: colors.muted }, fastTime: { fontSize: 19, lineHeight: 28, color: colors.muted, marginTop: 8 }, vibeTime: { fontSize: 24, lineHeight: 30, color: colors.pink, marginTop: 6 }, vibeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, extra: { fontSize: 7, color: colors.yellow, backgroundColor: '#343026', padding: 4 }, driveName: { fontSize: 9, lineHeight: 17, color: colors.ink }, blurb: { fontSize: 7, lineHeight: 14, color: colors.muted, marginTop: 6 }, sun: { borderLeftWidth: 3, borderColor: colors.yellow, paddingLeft: 9, marginVertical: 12 }, go: { backgroundColor: colors.pink, paddingVertical: 17, alignItems: 'center', borderWidth: 2, borderColor: '#ffb5d8' }, goText: { color: colors.bg, fontSize: 8 }, intro: { fontSize: 22, lineHeight: 35, color: colors.yellow }, footer: { textAlign: 'center', fontSize: 5, marginTop: 6, color: colors.ink, backgroundColor: colors.bg }, notice: { padding: 12, backgroundColor: colors.bg, marginBottom: 8, borderWidth: 2, borderColor: colors.yellow }, loading: { textAlign: 'center', marginTop: 12, fontSize: 8 }, estimate: { color: colors.muted, fontSize: 5, marginBottom: 8 }
});
