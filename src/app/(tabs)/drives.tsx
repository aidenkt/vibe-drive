import { useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../convex/_generated/api';
import { Stamp } from '../../components/DrivePass';
import { fonts, Glass, theme } from '../../components/ui';
import { drivePhoto, regionGroup, regions, RegionGroup } from '../../lib/drives';
import { usePasses } from '../../lib/usePasses';

type Pass = NonNullable<ReturnType<typeof usePasses>['passes']>[number];

function Polaroid({ pass, index, onVote }: { pass: Pass; index: number; onVote: () => void }) {
  const tilt = index % 2 === 0 ? -1.2 : 1;
  const [rotation] = useState(() => new Animated.Value(tilt));
  const settle = (to: number) => Animated.spring(rotation, { toValue: to, friction: 6, tension: 120, useNativeDriver: true }).start();
  const split = pass.split as { extraMinutes?: number; miles?: number };
  const meta = [split.miles !== undefined && `${split.miles} MI`, split.extraMinutes !== undefined && `+${split.extraMinutes} MIN`].filter(Boolean).join(' · ');
  return <Animated.View style={[styles.item, { transform: [{ rotate: rotation.interpolate({ inputRange: [-2, 2], outputRange: ['-2deg', '2deg'] }) }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${pass.drive.name} pass`} onPressIn={() => settle(0)} onPressOut={() => settle(tilt)}
      onPress={() => router.push({ pathname: '/pass', params: { driveId: pass.drive._id } })}>
      <View style={styles.shadowTight}>
        <View style={styles.shadowSoft}>
          <View style={styles.frame}>
            <View style={styles.photoWrap}>
              <Image source={drivePhoto(pass.drive)} style={styles.photo} resizeMode="cover" />
              <View style={styles.innerBorder} pointerEvents="none" />
            </View>
            <View style={styles.strip}>
              <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{pass.drive.name}</Text>
              {!!meta && <Text style={styles.meta}>{meta}</Text>}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
    {pass.drivenAt !== undefined && <View style={styles.stamp} pointerEvents="none"><Stamp size={92} drivenAt={pass.drivenAt} serial={pass.serial} /></View>}
    <View style={styles.below}>
      <Text style={styles.small}>{pass.drive.bestTime === 'any' ? 'ANY TIME' : `BEST AT ${pass.drive.bestTime.toUpperCase()}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Upvote ${pass.drive.name}, ${pass.drive.upvotes} votes`} hitSlop={10} onPress={onVote} style={styles.vote}>
        <Ionicons name="arrow-up" size={13} color={theme.ink} />
        <Text style={styles.small}>{pass.drive.upvotes}</Text>
      </Pressable>
    </View>
  </Animated.View>;
}

export default function Drives() {
  const insets = useSafeAreaInsets();
  const { passes } = usePasses();
  const [region, setRegion] = useState<RegionGroup>('SF');
  const vote = useMutation(api.drives.upvote).withOptimisticUpdate((store, { driveId }) => {
    const current = store.getQuery(api.drives.listDrives, {});
    if (current) store.setQuery(api.drives.listDrives, {}, current.map((d) => d._id === driveId ? { ...d, upvotes: d.upvotes + 1 } : d));
  });
  const driven = passes?.filter((p) => p.drivenAt !== undefined).length ?? 0;
  const shown = passes?.filter((p) => regionGroup(p.drive) === region) ?? [];
  return <View style={styles.screen}>
    <Image source={require('../../../assets/grain.png')} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.05 }]} />
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }}>
      <View style={styles.headRow}>
        <Text style={styles.title}>Drives</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/credits')} hitSlop={10}><Text style={styles.credits}>CREDITS</Text></Pressable>
      </View>
      <Text style={styles.subline}>{driven} / {passes?.length ?? 10} DRIVEN · CALIFORNIA</Text>
      <Glass style={styles.segmented}>
        {regions.map((r) => <Pressable key={r} accessibilityRole="button" accessibilityLabel={r} onPress={() => { void Haptics.selectionAsync(); setRegion(r); }}
          style={[styles.segment, region === r && styles.segmentActive]}>
          <Text style={[styles.segmentText, region === r && { color: theme.paper }]}>{r}</Text>
        </Pressable>)}
      </Glass>
      {!passes && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />}
      {shown.map((pass, i) => <Polaroid key={pass.drive._id} pass={pass} index={i} onVote={() => { void Haptics.selectionAsync(); void vote({ driveId: pass.drive._id }); }} />)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.paper },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { fontFamily: fonts.serif, fontSize: 42, lineHeight: 48, color: theme.ink },
  credits: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.5, color: 'rgba(20,17,15,0.5)', marginBottom: 10 },
  subline: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, color: 'rgba(20,17,15,0.5)', marginTop: 2 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 18, marginTop: 18, marginBottom: 28, borderWidth: 0.5, borderColor: theme.hairline },
  segment: { flex: 1, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: theme.ink },
  segmentText: { fontSize: 13, fontWeight: '600', color: theme.ink },
  item: { marginBottom: 40 },
  shadowTight: { shadowColor: theme.ink, shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  shadowSoft: { shadowColor: theme.ink, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  frame: { backgroundColor: theme.white, paddingTop: 12, paddingHorizontal: 12, paddingBottom: 0 },
  photoWrap: { aspectRatio: 4 / 3.4 },
  photo: { width: '100%', height: '100%' },
  innerBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 0.5, borderColor: 'rgba(20,17,15,0.18)' },
  strip: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 25, color: theme.ink },
  meta: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, color: 'rgba(20,17,15,0.55)' },
  stamp: { position: 'absolute', top: -22, right: -14 },
  below: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingHorizontal: 4 },
  small: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, color: 'rgba(20,17,15,0.6)' },
  vote: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
