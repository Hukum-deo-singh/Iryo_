import { useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { usePrefs } from '@/context/PrefsContext';
import { authIntro } from '@/context/authIntro';

import { DoorIntro } from './DoorIntro';

interface Props {
  kind: 'login' | 'signup';
  title: string;
  children: React.ReactNode;
}

/** Plays the door intro once per visit, unless animations are off, then shows the page. */
export function AuthIntroGate({ kind, title, children }: Props) {
  const { prefs } = usePrefs();
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(() => prefs.motion && !reduce && !authIntro.hasSeen(kind));

  if (playing) return <DoorIntro kind={kind} title={title} onDone={() => setPlaying(false)} />;
  return <>{children}</>;
}
