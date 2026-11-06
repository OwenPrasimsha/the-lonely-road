/** DOM overlay: HUD, banners, crash/finish screens, fade, mute button. */
const $ = (id) => document.getElementById(id);

export function formatTime(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

const CRASH_REASONS = {
  sand: 'You left the road',
  fell: 'You fell off the road',
  flipped: 'You flipped the car',
};

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'),
      level: $('hud-level'),
      attempt: $('hud-attempt'),
      speed: $('hud-speed'),
      time: $('hud-time'),
      banner: $('banner'),
      fade: $('fade'),
      title: $('title-screen'),
      records: $('records'),
      crash: $('crash-screen'),
      crashReason: $('crash-reason'),
      taunt: $('taunt'),
      tauntId: $('taunt-id'),
      spicy: $('spicy-toggle'),
      crashMeta: $('crash-meta'),
      finish: $('finish-screen'),
      finishMessage: $('finish-message'),
      finishMessageId: $('finish-message-id'),
      finishTime: $('finish-time'),
      finishAttempts: $('finish-attempts'),
      finishBest: $('finish-best'),
      finishFewest: $('finish-fewest'),
      mute: $('mute'),
      touch: $('touch'),
      left: $('touch-left'),
      right: $('touch-right'),
    };
    this.bannerTimer = 0;
    this.actions = {};
    document.querySelectorAll('[data-action]').forEach((btn) =>
      btn.addEventListener('click', () => this.actions[btn.dataset.action]?.()),
    );
    this.el.mute.addEventListener('click', () => this.actions.mute?.());
    this.el.spicy.addEventListener('change', () => this.actions.spicy?.(this.el.spicy.checked));
    const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch-device', coarse);
  }

  on(action, fn) {
    this.actions[action] = fn;
  }

  #show(el, visible) {
    el.classList.toggle('visible', visible);
    el.setAttribute('aria-hidden', String(!visible));
  }

  showTitle(visible, records) {
    this.#show(this.el.title, visible);
    if (records && (records.bestTime != null || records.fewestAttempts != null)) {
      this.el.records.textContent = `Best time ${formatTime(records.bestTime)} · Fewest attempts ${records.fewestAttempts ?? '—'}`;
    }
  }

  showHud(visible) {
    this.el.hud.classList.toggle('visible', visible);
    this.el.touch.classList.toggle('visible', visible);
  }

  updateHud({ level, attempt, speedKmh, time }) {
    // avoid layout churn: only touch the DOM when text changes
    const set = (el, v) => {
      if (el.textContent !== v) el.textContent = v;
    };
    set(this.el.level, String(level));
    set(this.el.attempt, String(attempt));
    set(this.el.speed, String(Math.round(speedKmh)));
    set(this.el.time, formatTime(time));
  }

  banner(title, subtitle = '', seconds = 2.4) {
    this.el.banner.innerHTML = `<strong>${title}</strong>${subtitle ? `<span>${subtitle}</span>` : ''}`;
    this.el.banner.classList.add('visible');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.el.banner.classList.remove('visible'), seconds * 1000);
  }

  hideBanner() {
    clearTimeout(this.bannerTimer);
    this.el.banner.classList.remove('visible');
  }

  showCrash({ reason, taunt, attempt, level }) {
    this.el.crashReason.textContent = CRASH_REASONS[reason] ?? 'Crashed';
    this.el.taunt.textContent = taunt.en;
    this.el.tauntId.textContent = taunt.id;
    this.el.crashMeta.textContent = `Level ${level} · Attempt ${attempt}`;
    this.#show(this.el.crash, true);
    this.el.crash.querySelector('button').focus({ preventScroll: true });
  }

  hideCrash() {
    this.#show(this.el.crash, false);
  }

  showFinish({ message, time, attempts, records }) {
    this.el.finishMessage.textContent = message.en;
    this.el.finishMessageId.textContent = message.id;
    this.el.finishTime.textContent = formatTime(time);
    this.el.finishAttempts.textContent = String(attempts);
    this.el.finishBest.textContent = formatTime(records.bestTime) + (records.newBestTime ? ' (new)' : '');
    this.el.finishFewest.textContent = String(records.fewestAttempts) + (records.newFewest ? ' (new)' : '');
    this.#show(this.el.finish, true);
    this.el.finish.querySelector('button').focus({ preventScroll: true });
  }

  hideFinish() {
    this.#show(this.el.finish, false);
  }

  setSpicy(on) {
    this.el.spicy.checked = on;
  }

  setMuted(muted) {
    this.el.mute.classList.toggle('muted', muted);
    this.el.mute.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    this.el.mute.setAttribute('aria-pressed', String(muted));
  }

  /** Fade to black (true) or back in (false). Resolves when done. */
  fade(toBlack, ms = 380) {
    this.el.fade.style.transitionDuration = `${ms}ms`;
    this.el.fade.classList.toggle('visible', toBlack);
    return new Promise((r) => setTimeout(r, ms));
  }

  get crashVisible() {
    return this.el.crash.classList.contains('visible');
  }

  get finishVisible() {
    return this.el.finish.classList.contains('visible');
  }
}
