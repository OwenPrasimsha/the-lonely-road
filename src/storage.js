/** localStorage wrapper that never throws (private mode, blocked storage...). */
const KEY = 'lonely-road:v1';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: records just won't persist */
  }
}

export function loadRecords() {
  const d = read();
  return { bestTime: d.bestTime ?? null, fewestAttempts: d.fewestAttempts ?? null, muted: !!d.muted, spicy: d.spicy ?? true }; // Mode Pedas on by default
}

/** Saves a finished run. Returns which records were beaten. */
export function saveRun(time, attempts) {
  const d = read();
  const newBestTime = d.bestTime == null || time < d.bestTime;
  const newFewest = d.fewestAttempts == null || attempts < d.fewestAttempts;
  if (newBestTime) d.bestTime = time;
  if (newFewest) d.fewestAttempts = attempts;
  write(d);
  return { newBestTime, newFewest, bestTime: d.bestTime, fewestAttempts: d.fewestAttempts };
}

export function saveMuted(muted) {
  write({ ...read(), muted });
}

export function saveSpicy(spicy) {
  write({ ...read(), spicy });
}
