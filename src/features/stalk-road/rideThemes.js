import {
  Building2, Flame, Trees, Orbit, Gamepad2, Trophy, Target, Cpu, CodeXml, Terminal,
  Music, Palette, BookOpen, Pizza, Dumbbell, Plane,
} from 'lucide-react';
import { INTEREST_THEMES } from './interestThemes';

/* ─── Orbit Express ride themes ───
   One theme drives BOTH views: the side view (SVG) and the first-person view
   (three.js). Each theme has its own track layout (coasterTrack LAYOUTS), its
   own car, scenery, station name and colours. `sky` is the colour behind both
   views; `ink` is the swatch icon colour in the picker. */

const WORLD_THEMES = [
  {
    id: 'city',
    label: 'Night city',
    note: 'Steel looper above the skyline',
    ride: 'ORBIT EXPRESS',
    car: 'Neon Bullet',
    blurb: 'loops, drops and a corkscrew over the city lights',
    Icon: Building2,
    sky: '#070b14',
    ink: '#ffd27a',
  },
  {
    id: 'fire',
    label: 'Fire',
    note: 'Lava plunges and a top-hat spike',
    ride: 'INFERNO DIVE',
    car: 'Magma Runner',
    blurb: 'plunges into the lava valley and a top-hat spike',
    Icon: Flame,
    sky: '#1c0a07',
    ink: '#ff7a2a',
  },
  {
    id: 'forest',
    label: 'Forest',
    note: 'Wooden coaster, all airtime hills',
    ride: 'TIMBER RUN',
    car: 'Timber Classic',
    blurb: 'a wooden coaster of airtime hills through the pines',
    Icon: Trees,
    sky: '#a9cfe0',
    ink: '#2f6a3a',
  },
  {
    id: 'space',
    label: 'Space',
    note: 'Giant loop and zero-g rolls',
    ride: 'ZERO-G',
    car: 'Orbit Pod',
    blurb: 'a giant loop, zero-g rolls and a double corkscrew',
    Icon: Orbit,
    sky: '#02030a',
    ink: '#a99cff',
  },
];

const ICONS = {
  Gamepad2, Trophy, Target, Cpu, CodeXml, Terminal, Music, Palette, BookOpen, Pizza, Dumbbell, Plane,
};

/* group: 'world' (hand-built worlds) | 'interest' (built from interestThemes
   specs); light = a bright sky, so the side-view labels sit on pills */
export const RIDE_THEMES = [
  ...WORLD_THEMES.map((t) => ({ ...t, group: 'world', light: t.id === 'forest' })),
  ...INTEREST_THEMES.map((t) => ({
    id: t.id,
    label: t.label,
    note: t.note,
    ride: t.ride,
    car: t.carName,
    blurb: t.blurb,
    Icon: ICONS[t.icon] || Orbit,
    sky: t.sky,
    ink: t.ink,
    group: 'interest',
    light: Boolean(t.light),
  })),
];

export const themeById = (id) => RIDE_THEMES.find((t) => t.id === id) || RIDE_THEMES[0];
