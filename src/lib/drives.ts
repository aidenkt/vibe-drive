import { ImageSourcePropType } from 'react-native';
import { Doc } from '../../convex/_generated/dataModel';
import credits from '../../assets/drives/credits.json';

export const passColors = { ink: '#14110F', paper: '#F2EADB', accent: '#FF5A1F' };
export const passFonts = { serif: 'InstrumentSerif_400Regular', mono: 'IBMPlexMono_400Regular', monoMedium: 'IBMPlexMono_500Medium' };

const photos: Record<string, { source: ImageSourcePropType; file: string }> = {
  'Torrey Pines to Del Mar': { source: require('../../assets/drives/torrey-pines.jpg'), file: 'torrey-pines.jpg' },
  'Dana Point to Crystal Cove': { source: require('../../assets/drives/crystal-cove.jpg'), file: 'crystal-cove.jpg' },
  'Cuyamaca to Julian': { source: require('../../assets/drives/julian-sr79.jpg'), file: 'julian-sr79.jpg' },
  'Rancho Santa Fe Backroads': { source: require('../../assets/drives/rancho-santa-fe.jpg'), file: 'rancho-santa-fe.jpg' },
  'San Diego Harbor Nights': { source: require('../../assets/drives/harbor-drive-night.jpg'), file: 'harbor-drive-night.jpg' },
  'Topanga Canyon to the Pacific': { source: require('../../assets/drives/topanga-canyon.jpg'), file: 'topanga-canyon.jpg' },
  'Marin Headlands via Conzelman Road': { source: require('../../assets/drives/marin-headlands.jpg'), file: 'marin-headlands.jpg' },
  'Presidio to Baker Beach': { source: require('../../assets/drives/baker-beach.jpg'), file: 'baker-beach.jpg' },
  'Highway 1 to Stinson Beach': { source: require('../../assets/drives/stinson-beach.jpg'), file: 'stinson-beach.jpg' },
  'Embarcadero and the Bay Lights': { source: require('../../assets/drives/bay-bridge-lights.jpg'), file: 'bay-bridge-lights.jpg' },
};

export const regions = ['San Diego', 'LA', 'SF'] as const;
export type RegionGroup = (typeof regions)[number];
export const regionGroup = (drive: Doc<'drives'>): RegionGroup =>
  /San Francisco/.test(drive.region) ? 'SF' : /Los Angeles/.test(drive.region) ? 'LA' : 'San Diego';

export const photoCredits = credits;
export const drivePhoto = (drive: Doc<'drives'>) => photos[drive.name]?.source;
export const serialCity = (drive: Doc<'drives'>) => drive.region.toUpperCase().replace(/ (COAST|MOUNTAINS|WATERFRONT)$/, '').replace(/^NORTH COUNTY /, '');
export const inSeedOrder = (drives: Doc<'drives'>[]) => [...drives].sort((a, b) => a._creationTime - b._creationTime);
