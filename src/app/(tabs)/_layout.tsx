import { NativeTabs } from 'expo-router/native-tabs';
import { theme } from '../../components/ui';

export default function TabsLayout() {
  return <NativeTabs tintColor={theme.accent}>
    <NativeTabs.Trigger name="index">
      <NativeTabs.Trigger.Icon sf="map" />
      <NativeTabs.Trigger.Label>Map</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="drives">
      <NativeTabs.Trigger.Icon sf="car.rear" />
      <NativeTabs.Trigger.Label>Drives</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>
  </NativeTabs>;
}
