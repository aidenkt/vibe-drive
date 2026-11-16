import { ComponentRef, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { api } from '../../convex/_generated/api';
import { DrivePass } from '../components/DrivePass';
import { passColors, passFonts } from '../lib/drives';
import { usePasses } from '../lib/usePasses';

export default function PassScreen() {
  const { driveId, stamp } = useLocalSearchParams<{ driveId: string; stamp?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { handle, passes } = usePasses();
  const markDriven = useMutation(api.drives.markDriven);
  const passRef = useRef<ComponentRef<typeof View>>(null);
  const [animate, setAnimate] = useState(stamp === '1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pass = passes?.find((p) => p.drive._id === driveId);
  const passWidth = Math.min(width - 32, (height - insets.top - insets.bottom - 150) * 9 / 16);

  async function drove() {
    if (!pass || !handle) return;
    setBusy(true); setError('');
    try { await markDriven({ driveId: pass.drive._id, handle }); setAnimate(true); }
    catch { setError('Could not save your drive. Try again.'); }
    finally { setBusy(false); }
  }

  async function share() {
    setBusy(true); setError('');
    try {
      const uri = await captureRef(passRef, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing unavailable');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your Drive Pass' });
    } catch { setError('Could not share the pass. Try again.'); }
    finally { setBusy(false); }
  }

  return <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
    <View style={[styles.bar, { width: passWidth }]}>
      <Text style={styles.label}>DRIVE PASS</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={12}><Text style={styles.close}>CLOSE</Text></Pressable>
    </View>
    {pass ? <DrivePass ref={passRef} {...pass} width={passWidth} animateStamp={animate} /> : <ActivityIndicator color={passColors.accent} style={{ flex: 1 }} />}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {pass && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void (pass.drivenAt ? share() : drove())} style={[styles.button, { width: passWidth }, pass.drivenAt ? styles.share : null]}>
      {busy ? <ActivityIndicator color={pass.drivenAt ? passColors.ink : passColors.paper} /> : <Text style={[styles.buttonText, pass.drivenAt ? { color: passColors.ink } : null]}>{pass.drivenAt ? 'Share' : 'I drove it'}</Text>}
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: passColors.ink, alignItems: 'center' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontFamily: passFonts.monoMedium, fontSize: 11, letterSpacing: 1.5, color: passColors.paper, opacity: 0.6 },
  close: { fontFamily: passFonts.monoMedium, fontSize: 11, letterSpacing: 1.5, color: passColors.paper },
  button: { marginTop: 'auto', height: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: passColors.accent, borderRadius: 27 },
  share: { backgroundColor: passColors.accent },
  buttonText: { fontFamily: passFonts.monoMedium, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: passColors.accent },
  error: { fontFamily: passFonts.mono, fontSize: 12, color: passColors.accent, marginTop: 10 },
});
