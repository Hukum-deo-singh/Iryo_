import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Sound and haptic feedback. Both can be switched off in Profile. All failures are swallowed. */
type SoundName = 'tap' | 'toggle' | 'success' | 'error' | 'knock' | 'door' | 'pop';

const SOURCES: Record<SoundName, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  toggle: require('../../assets/sounds/toggle.wav'),
  success: require('../../assets/sounds/success.wav'),
  error: require('../../assets/sounds/error.wav'),
  knock: require('../../assets/sounds/knock.wav'),
  door: require('../../assets/sounds/door.wav'),
  pop: require('../../assets/sounds/pop.wav'),
};

let soundOn = true;
let hapticsOn = true;
let ready = false;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

export function configureFeedback(settings: { sound: boolean; haptics: boolean }): void {
  soundOn = settings.sound;
  hapticsOn = settings.haptics;
}

async function prepare(): Promise<void> {
  if (ready) return;
  ready = true;
  try {
    // Respect the phone's silent switch and never interrupt the user's music.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  } catch {
    // Audio is optional.
  }
}

function play(name: SoundName): void {
  if (!soundOn) return;
  void prepare();
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      player.volume = 0.7;
      players[name] = player;
    }
    void player.seekTo(0);
    player.play();
  } catch {
    // Ignore audio errors.
  }
}

function haptic(kind: 'light' | 'success' | 'error'): void {
  if (!hapticsOn || Platform.OS === 'web') return;
  try {
    if (kind === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else
      void Haptics.notificationAsync(
        kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
      );
  } catch {
    // Ignore haptic errors.
  }
}

export const fx = {
  tap: () => {
    play('tap');
    haptic('light');
  },
  toggle: () => {
    play('toggle');
    haptic('light');
  },
  pop: () => play('pop'),
  success: () => {
    play('success');
    haptic('success');
  },
  error: () => {
    play('error');
    haptic('error');
  },
  knock: () => {
    play('knock');
    haptic('light');
  },
  door: () => play('door'),
};
