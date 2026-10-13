/** Remembers which door intros already played during this signed-out visit. */
const seen = { login: false, signup: false };

export const authIntro = {
  hasSeen: (kind: 'login' | 'signup') => seen[kind],
  markSeen: (kind: 'login' | 'signup') => {
    seen[kind] = true;
  },
  reset: () => {
    seen.login = false;
    seen.signup = false;
  },
};
