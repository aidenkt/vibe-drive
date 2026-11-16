import { Image, ScrollView, Text, View, Pressable, Linking, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { passColors, passFonts, photoCredits } from '../lib/drives';

export default function Credits() {
  const insets = useSafeAreaInsets();
  const momentPhotos = useQuery(api.photos.list);
  return <ScrollView style={{ flex: 1, backgroundColor: passColors.ink }} contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <Image source={require('../../assets/brand/icon-1024.png')} style={{ width: 28, height: 28, borderRadius: 7 }} />
      <Text style={{ color: passColors.paper, fontFamily: passFonts.serif, fontSize: 24 }}>Scenic Route</Text>
    </View>
    <View style={styles.head}>
      <Text style={styles.title}>Photo credits</Text>
      <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}><Text style={styles.close}>CLOSE</Text></Pressable>
    </View>
    {photoCredits.map((credit) => <Pressable key={credit.file} accessibilityRole="link" onPress={() => void Linking.openURL(credit.source)} style={styles.row}>
      <Text style={styles.drive}>{credit.drive.toUpperCase()}</Text>
      <Text style={styles.photo}>{credit.title}</Text>
      <Text style={styles.meta}>{credit.author} · {credit.license}</Text>
      <Text style={styles.source} numberOfLines={1}>{credit.source.replace('https://', '')}</Text>
    </Pressable>)}
    {momentPhotos?.map((credit) => <Pressable key={credit._id} accessibilityRole="link" onPress={() => credit.source && void Linking.openURL(credit.source)} style={styles.row}>
      <Text style={styles.drive}>MOMENT</Text>
      <Text style={styles.photo}>{credit.label}</Text>
      <Text style={styles.meta}>{credit.author} · {credit.license}</Text>
      {!!credit.source && <Text style={styles.source} numberOfLines={1}>{credit.source.replace('https://', '')}</Text>}
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 20 },
  title: { fontFamily: passFonts.serif, fontSize: 36, color: passColors.paper },
  close: { fontFamily: passFonts.monoMedium, fontSize: 12, letterSpacing: 1.5, color: passColors.accent },
  row: { borderTopWidth: 1, borderTopColor: 'rgba(242,234,219,0.18)', paddingVertical: 16 },
  drive: { fontFamily: passFonts.monoMedium, fontSize: 11, letterSpacing: 1.5, color: passColors.accent },
  photo: { fontFamily: passFonts.serif, fontSize: 22, color: passColors.paper, marginTop: 6 },
  meta: { fontFamily: passFonts.mono, fontSize: 12, color: passColors.paper, marginTop: 6 },
  source: { fontFamily: passFonts.mono, fontSize: 11, color: passColors.paper, opacity: 0.55, marginTop: 4 },
});
