const KEY = 'st-pending-topic';

/** A topic typed on the landing page, carried through sign-up. */
export function savePendingTopic(topic: string) {
  try {
    sessionStorage.setItem(KEY, topic.slice(0, 200));
  } catch {
    // storage unavailable: the learner just types it again
  }
}

export function takePendingTopic(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
