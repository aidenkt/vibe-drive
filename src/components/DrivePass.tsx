import { ComponentRef, forwardRef, useEffect, useId, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText, TextPath } from 'react-native-svg';
import { Doc } from '../../convex/_generated/dataModel';
import { drivePhoto, passColors, passFonts, serialCity } from '../lib/drives';
import { RouteSplit } from './RouteSplit';

export type PassSplit = { fast: number[][]; vibe: number[][]; extraMinutes?: number; miles?: number; goldenHourAt?: string; vibeScore?: number };
type Props = {
  drive: Doc<'drives'>;
  serial: number;
  total: number;
  split: PassSplit;
  width: number;
  drivenAt?: number;
  animateStamp?: boolean;
  mini?: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');
function postmark(at: number) {
  const d = new Date(at);
  const hours = d.getHours() % 12 || 12;
  return `DRIVEN · ${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${String(d.getFullYear()).slice(2)} · ${hours}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'} · `;
}

export function Stamp({ size, drivenAt, serial, animate }: { size: number; drivenAt: number; serial: number; animate?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [progress] = useState(() => new Animated.Value(animate ? 0 : 1));
  useEffect(() => {
    if (animate) Animated.spring(progress, { toValue: 1, friction: 5, tension: 70, delay: 250, useNativeDriver: true }).start();
  }, [animate, progress]);
  const ring = 37;
  return <Animated.View style={{
    width: size, height: size,
    opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
    transform: [
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1] }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '-6deg'] }) },
    ],
  }}>
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Defs><Path id={`ring${id}`} d={`M48,${48 + ring} a${ring},${ring} 0 1,1 0.01,0`} /></Defs>
      <Circle cx={48} cy={48} r={45} fill="none" stroke={passColors.accent} strokeWidth={3} />
      <Circle cx={48} cy={48} r={29} fill="none" stroke={passColors.accent} strokeWidth={1.5} />
      <SvgText fill={passColors.accent} fontFamily={passFonts.monoMedium} fontSize={8.6} letterSpacing={0.6}>
        <TextPath href={`#ring${id}`}>{postmark(drivenAt)}</TextPath>
      </SvgText>
      <SvgText x={48} y={58} textAnchor="middle" fill={passColors.accent} fontFamily={passFonts.serif} fontSize={30}>{pad(serial)}</SvgText>
    </Svg>
  </Animated.View>;
}

export const DrivePass = forwardRef<ComponentRef<typeof View>, Props>(function DrivePass({ drive, serial, total, split, width, drivenAt, animateStamp, mini }, ref) {
  const s = width / 360;
  const height = width * (mini ? 1.2 : 16 / 9);
  const photoHeight = height * (mini ? 0.5 : 0.6);
  const plateHeight = height - photoHeight;
  const gradientId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const stampSize = (mini ? 76 : 96) * s;
  const splitHeight = (mini ? 64 : 92) * s;
  const data = [split.vibeScore !== undefined && `SCENIC ${split.vibeScore}`, split.extraMinutes !== undefined && `+${split.extraMinutes} MIN`, split.goldenHourAt && `GOLDEN HOUR ${split.goldenHourAt}`].filter(Boolean).join(' · ');
  return <View ref={ref} collapsable={false} style={{ width, height, backgroundColor: passColors.ink, overflow: 'hidden' }}>
    <View style={{ height: photoHeight, overflow: 'hidden' }}>
      <Image source={drivePhoto(drive)} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: passColors.paper, opacity: 0.1, mixBlendMode: 'saturation' }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: passColors.accent, opacity: 0.09, mixBlendMode: 'soft-light' }]} />
      <Image source={require('../../assets/grain.png')} resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: 0.08 }]} />
      <Svg width={width} height={40 * s} style={{ position: 'absolute', bottom: 0 }}>
        <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={passColors.ink} stopOpacity={0} /><Stop offset="1" stopColor={passColors.ink} stopOpacity={1} /></LinearGradient></Defs>
        <Rect width={width} height={40 * s} fill={`url(#${gradientId})`} />
      </Svg>
      {!mini && <View style={{ position: 'absolute', top: 80 * s, left: 20 * s, flexDirection: 'row', alignItems: 'center', gap: 8 * s }}>
        <Image source={require('../../assets/brand/icon-1024.png')} style={{ width: 28 * s, height: 28 * s, borderRadius: 7 * s }} />
        <Text style={[styles.serial, { position: 'relative', fontSize: 11 * s, letterSpacing: 2 * s }]}>SCENIC ROUTE</Text>
      </View>}
      <Text style={[styles.serial, { top: (mini ? 16 : 84) * s, right: 20 * s, fontSize: 10 * s, letterSpacing: 1.5 * s }]}>
        NO. {pad(serial)} / {pad(total)} · {serialCity(drive)}
      </Text>
    </View>
    <View style={{ height: plateHeight, backgroundColor: passColors.ink, paddingHorizontal: 24 * s, paddingTop: (mini ? 10 : 18) * s, paddingBottom: (mini ? 16 : 26) * s }}>
      <RouteSplit fast={split.fast} vibe={split.vibe} extraMinutes={split.extraMinutes} width={width - 48 * s} height={splitHeight} scale={s} />
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.name, { fontSize: (mini ? 30 : 44) * s, lineHeight: (mini ? 32 : 46) * s }]}>{drive.name}</Text>
        {!mini && !!data && <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.data, { fontSize: 12 * s, letterSpacing: 1.5 * s, marginTop: 10 * s }]}>{data}</Text>}
      </View>
    </View>
    {drivenAt !== undefined && <View style={{ position: 'absolute', top: photoHeight - stampSize / 2, right: 22 * s }}>
      <Stamp size={stampSize} drivenAt={drivenAt} serial={serial} animate={animateStamp} />
    </View>}
  </View>;
});

const styles = StyleSheet.create({
  serial: { position: 'absolute', color: passColors.paper, fontFamily: passFonts.mono, textShadowColor: passColors.ink, textShadowRadius: 6 },
  name: { color: passColors.paper, fontFamily: passFonts.serif },
  data: { color: passColors.paper, fontFamily: passFonts.mono, textTransform: 'uppercase' },
});
