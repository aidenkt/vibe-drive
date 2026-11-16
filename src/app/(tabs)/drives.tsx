import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../convex/_generated/api';
import { DrivePass } from '../../components/DrivePass';
import { fonts, Mono, theme } from '../../components/ui';
import { usePasses } from '../../lib/usePasses';

export default function Drives() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { passes } = usePasses();
  const vote = useMutation(api.drives.upvote).withOptimisticUpdate((store, { driveId }) => {
    const current = store.getQuery(api.drives.listDrives, {});
    if (current) store.setQuery(api.drives.listDrives, {}, current.map((d) => d._id === driveId ? { ...d, upvotes: d.upvotes + 1 } : d));
  });
  const driven = passes?.filter((p) => p.drivenAt !== undefined).length ?? 0;
  const passWidth = width - 40;
  return <ScrollView style={styles.screen} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: 40 }}>
    <View style={styles.head}>
      <Mono style={{ color: theme.accent }}>{driven} / {passes?.length ?? 6} DRIVEN</Mono>
      <Pressable accessibilityRole="link" onPress={() => router.push('/credits')} hitSlop={10}><Mono>Photo credits</Mono></Pressable>
    </View>
    <Text style={styles.title}>Drives near you</Text>
    <Text style={styles.sub}>Collect a pass for every scenic drive you finish.</Text>
    {!passes && <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />}
    {passes?.map((pass) => <View key={pass.drive._id} style={styles.item}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${pass.drive.name} pass`} onPress={() => router.push({ pathname: '/pass', params: { driveId: pass.drive._id } })}
        style={({ pressed }) => [styles.passShadow, pressed && { transform: [{ scale: 0.985 }] }]}>
        <View style={styles.passClip}><DrivePass {...pass} width={passWidth} mini /></View>
      </Pressable>
      <View style={styles.meta}>
        <Mono>{pass.drive.bestTime === 'any' ? 'Any time' : `Best at ${pass.drive.bestTime}`}</Mono>
        <Pressable accessibilityRole="button" accessibilityLabel={`Upvote ${pass.drive.name}, ${pass.drive.upvotes} votes`} hitSlop={8}
          onPress={() => { void Haptics.selectionAsync(); void vote({ driveId: pass.drive._id }); }} style={styles.vote}>
          <Ionicons name="arrow-up" size={14} color={theme.ink} />
          <Text style={styles.voteText}>{pass.drive.upvotes}</Text>
        </Pressable>
      </View>
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.white },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, color: theme.ink, marginTop: 10 },
  sub: { fontSize: 15, color: theme.muted, marginTop: 4, marginBottom: 24 },
  item: { marginBottom: 28 },
  passShadow: { borderRadius: 20, shadowColor: theme.ink, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  passClip: { borderRadius: 20, overflow: 'hidden' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingHorizontal: 4 },
  vote: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 0.5, borderColor: theme.hairline, backgroundColor: theme.white },
  voteText: { fontFamily: fonts.monoMedium, fontSize: 13, color: theme.ink },
});
