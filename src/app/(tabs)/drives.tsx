import { useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { colors, PixelText } from '../../components/ui';

export default function Drives() {
  const insets = useSafeAreaInsets();
  const drives = useQuery(api.drives.listDrives);
  const vote = useMutation(api.drives.upvote).withOptimisticUpdate((store, { driveId }) => {
    const current = store.getQuery(api.drives.listDrives, {});
    if (current) store.setQuery(api.drives.listDrives, {}, current.map(d => d._id === driveId ? { ...d, upvotes: d.upvotes + 1 } : d).sort((a, b) => b.upvotes - a.upvotes));
  });
  const [error, setError] = useState('');
  return <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 24, paddingBottom: 32 }}>
    <PixelText style={styles.eyebrow}>THE LOCAL SAVE FILE</PixelText>
    <PixelText style={styles.title}>DRIVES{ '\n' }NEAR YOU</PixelText>
    <PixelText style={styles.sub}>6 SIDE QUESTS. ZERO WRONG TURNS.</PixelText>
    {error ? <PixelText style={styles.error}>{error}</PixelText> : null}
    {!drives && <ActivityIndicator color={colors.pink} />}
    {drives?.map((drive, index) => <View key={drive._id} style={[styles.card, { borderTopColor: drive.color }]}>
      <View style={styles.row}><PixelText style={{ fontSize: 8, color: drive.color }}>0{index + 1} / {drive.bestTime.toUpperCase()}</PixelText><PixelText style={styles.region}>{drive.region}</PixelText></View>
      <PixelText style={styles.name}>{drive.name}</PixelText>
      <PixelText style={styles.blurb}>{drive.blurb}</PixelText>
      <View style={styles.bottom}><PixelText style={styles.save}>CURATED FOR THE LONG WAY</PixelText><Pressable accessibilityRole="button" accessibilityLabel={`Upvote ${drive.name}, ${drive.upvotes} votes`} onPress={() => { setError(''); void vote({ driveId: drive._id }).catch(() => setError('Vote failed. Try again.')); }} style={styles.vote}><PixelText style={{ color: colors.pink, fontSize: 9 }}>↑ {drive.upvotes}</PixelText></Pressable></View>
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, eyebrow: { color: colors.green, fontSize: 7 }, title: { fontSize: 23, lineHeight: 37, marginTop: 16, color: colors.yellow }, sub: { color: colors.muted, fontSize: 6, marginTop: 12, marginBottom: 28 }, card: { borderWidth: 2, borderTopWidth: 5, borderColor: colors.border, backgroundColor: colors.panel, padding: 16, marginBottom: 16 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, region: { color: colors.muted, fontSize: 6 }, name: { fontSize: 11, lineHeight: 21, marginTop: 18 }, blurb: { fontSize: 8, lineHeight: 17, color: colors.muted, marginTop: 10 }, bottom: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, save: { color: colors.muted, fontSize: 5 }, vote: { borderWidth: 2, borderColor: colors.pink, paddingVertical: 10, paddingHorizontal: 12 }, error: { color: colors.pink, fontSize: 8, marginBottom: 12 } });
