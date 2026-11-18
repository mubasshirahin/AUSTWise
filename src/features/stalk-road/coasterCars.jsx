/* ─── Orbit Express cars (side view) ───
   One car per ride theme, drawn in its local frame: the track centre is at
   y = 0, the car sits above it (negative y) and faces +x. The outer <g> is
   what the frame loop moves; `.sr-riders` lifts its arms when the train flies
   (`.sr-arms-up` on the train). Flat fills only — the theme CSS colours them. */

import { INTEREST_BY_ID } from './interestThemes';
import { InterestCarBody } from './interestScenery';

function Bogie({ spoked = false }) {
  return (
    <>
      <rect x="-19" y="-9" width="38" height="5" rx="1.5" className="sr-car-bogie" />
      {[-13, 13].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="-3.6" r="3.8" className="sr-car-wheel" />
          {spoked
            ? <path d={`M${cx - 3} -3.6h6M${cx} -6.6v6`} className="sr-car-spoke" />
            : <circle cx={cx} cy="-3.6" r="1.3" className="sr-car-hub" />}
          <circle cx={cx} cy="6.4" r="2.2" className="sr-car-wheel sr-car-upstop" />
        </g>
      ))}
    </>
  );
}

function Riders({ y = 0 }) {
  return (
    <g className="sr-riders" transform={y ? `translate(0 ${y})` : undefined}>
      <line x1="-8" y1="-26" x2="-13" y2="-39" className="sr-arm" />
      <line x1="-6" y1="-26" x2="-1" y2="-39" className="sr-arm" />
      <line x1="8" y1="-26" x2="3" y2="-39" className="sr-arm" />
      <line x1="10" y1="-26" x2="15" y2="-39" className="sr-arm" />
      <circle cx="-7" cy="-28.5" r="4.4" className="sr-rider" />
      <circle cx="9" cy="-28.5" r="4.4" className="sr-rider sr-rider-b" />
    </g>
  );
}

/* Night city — Neon Bullet: low wedge, wrap-around windscreen, headlamp */
function NeonBullet({ front }) {
  return (
    <>
      <Bogie />
      <rect x="-15" y="-36" width="4" height="12" rx="2" className="sr-car-headrest" />
      <rect x="1" y="-36" width="4" height="12" rx="2" className="sr-car-headrest" />
      <Riders />
      <path
        d={front
          ? 'M-22 -8 L-22 -21 Q-22 -25 -18 -25 L4 -25 Q9 -25 12 -22 L25 -13 Q27 -10 25 -8 Z'
          : 'M-22 -8 L-22 -21 Q-22 -25 -18 -25 L18 -25 Q22 -25 22 -21 L22 -8 Z'}
        className="sr-car-shell"
      />
      <path d={front ? 'M-22 -12 H25' : 'M-22 -12 H22'} className="sr-car-trim" />
      <rect x="-18" y="-21" width={front ? 20 : 36} height="5" rx="2" className="sr-car-seat" />
      <path d="M-2 -20 l5 -4 M14 -20 l5 -4" className="sr-car-lapbar" />
      {front && <path d="M5 -25 L11 -30 L15 -30 L13 -23 Z" className="sr-car-glass" />}
      {front && <circle cx="22" cy="-11.5" r="2" className="sr-car-lamp" />}
      {!front && <rect x="-23" y="-17" width="2" height="4" rx="1" className="sr-car-tail" />}
    </>
  );
}

/* Fire — Magma Runner: armoured wedge, glowing-orange vents, front horns */
function MagmaRunner({ front }) {
  return (
    <>
      <Bogie />
      <rect x="-15" y="-36" width="4" height="12" rx="1" className="sr-car-headrest" />
      <rect x="1" y="-36" width="4" height="12" rx="1" className="sr-car-headrest" />
      <Riders />
      <path
        d={front
          ? 'M-22 -8 L-23 -20 L-18 -26 L5 -26 L12 -22 L27 -12 L25 -8 Z'
          : 'M-22 -8 L-23 -20 L-18 -26 L18 -26 L23 -20 L22 -8 Z'}
        className="sr-car-shell"
      />
      <path d="M-16 -11 l4 -6 M-9 -11 l4 -6 M-2 -11 l4 -6" className="sr-car-vent" />
      {!front && <path d="M5 -11 l4 -6 M12 -11 l4 -6" className="sr-car-vent" />}
      <rect x="-18" y="-22" width={front ? 20 : 36} height="4" rx="1" className="sr-car-seat" />
      <path d="M-2 -20 l5 -4 M14 -20 l5 -4" className="sr-car-lapbar" />
      {front && <path d="M18 -17 L31 -21 L24 -12 Z M20 -10 L32 -9 L24 -7 Z" className="sr-car-horn" />}
      {front && <rect x="21" y="-14" width="4" height="2.4" rx="1" className="sr-car-lamp" />}
      {!front && <path d="M-23 -15 l-6 2 l6 2 Z" className="sr-car-exhaust" />}
    </>
  );
}

/* Forest — Timber Classic: rounded wooden body, plank seams, brass trim */
function TimberClassic({ front }) {
  return (
    <>
      <Bogie spoked />
      <Riders />
      <path
        d={front
          ? 'M-22 -8 L-22 -20 Q-22 -26 -16 -26 L6 -26 Q19 -26 25 -15 L25 -8 Z'
          : 'M-22 -8 L-22 -20 Q-22 -26 -16 -26 L16 -26 Q22 -26 22 -20 L22 -8 Z'}
        className="sr-car-shell"
      />
      <path d={front ? 'M-21 -13 H24 M-21 -18 H23' : 'M-21 -13 H21 M-21 -18 H21'} className="sr-car-plank" />
      <path d={front ? 'M-22 -22.5 H14' : 'M-22 -22.5 H22'} className="sr-car-brass" />
      <rect x="-18" y="-24" width={front ? 20 : 36} height="3" rx="1.5" className="sr-car-seat" />
      <path d="M-2 -21 q3 -5 6 -4 M14 -21 q3 -5 6 -4" className="sr-car-lapbar" />
      {front && <circle cx="22" cy="-12" r="2.6" className="sr-car-brass-lamp" />}
      {front && <circle cx="22" cy="-12" r="1.3" className="sr-car-lamp" />}
    </>
  );
}

/* Space — Orbit Pod: capsule with a canopy dome, portholes, rear thruster */
function OrbitPod({ front }) {
  return (
    <>
      <Bogie />
      <Riders y={2} />
      <path d="M-17 -22 Q-17 -40 0 -40 Q17 -40 18 -22 Z" className="sr-car-canopy" />
      <path
        d={front
          ? 'M-21 -8 Q-24 -15 -19 -22 L12 -22 Q24 -20 27 -12 Q27 -8 23 -8 Z'
          : 'M-21 -8 Q-24 -15 -19 -22 L19 -22 Q24 -15 21 -8 Z'}
        className="sr-car-shell"
      />
      {[-12, -4, 4, 12].map((cx) => <circle key={cx} cx={cx} cy="-15" r="1.6" className="sr-car-port" />)}
      <path d="M-17 -40 V-22 M18 -22 Q10 -36 0 -40" className="sr-car-frame" />
      {front && <path d="M16 -21 L22 -18 L25 -12 L19 -13 Z" className="sr-car-glass" />}
      {front && <circle cx="24" cy="-10.5" r="1.6" className="sr-car-lamp" />}
      {!front && (
        <>
          <path d="M-20 -13 L-28 -6 L-21 -9 Z" className="sr-car-fin" />
          <rect x="-25" y="-20" width="4" height="6" rx="1" className="sr-car-nozzle" />
          <path d="M-25 -19 L-34 -17 L-25 -15 Z" className="sr-car-flame" />
        </>
      )}
    </>
  );
}

const CARS = { city: NeonBullet, fire: MagmaRunner, forest: TimberClassic, space: OrbitPod };

export default function CoasterCar({ front, innerRef, theme = 'city' }) {
  const spec = INTEREST_BY_ID[theme];
  const Body = CARS[theme] || NeonBullet;
  return (
    <g ref={innerRef} className="sr-car-g">
      <g className="sr-car-body">
        {spec ? <InterestCarBody front={front} spec={spec} /> : <Body front={front} />}
      </g>
    </g>
  );
}
