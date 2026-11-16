import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { inSeedOrder } from './drives';
import { useHandle } from './handle';

export function usePasses() {
  const handle = useHandle();
  const drives = useQuery(api.drives.listDrives);
  const splits = useQuery(api.drives.listSplits);
  const driven = useQuery(api.drives.listDriven, handle ? { handle } : 'skip');
  if (!drives || !splits) return { handle, passes: undefined };
  const ordered = inSeedOrder(drives);
  const passes = ordered.map((drive, index) => {
    const split = splits.find((s) => s.driveId === drive._id);
    const chord = [drive.waypoints[0], drive.waypoints[drive.waypoints.length - 1]].map((p) => [p.lat, p.lng]);
    return {
      drive,
      serial: index + 1,
      total: ordered.length,
      split: split ?? { fast: chord, vibe: drive.waypoints.map((p) => [p.lat, p.lng]) },
      drivenAt: driven?.find((d) => d.driveId === drive._id)?.drivenAt,
    };
  });
  return { handle, passes };
}
