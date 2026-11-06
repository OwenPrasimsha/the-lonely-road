/**
 * Crash-screen taunts, escalating with the number of failed attempts on the
 * current level. Each line has an English main text and an Indonesian
 * second line. `{n}` is replaced with the attempt number.
 *
 * `spicy` lines are only used when "Mode Pedas" is switched on.
 */
export const TAUNT_TIERS = [
  {
    minAttempts: 1, // mild
    messages: [
      { en: 'Level 1 was the easy one.', id: 'Itu masih level gampang lho, bro.' },
      { en: 'The road was right there.', id: 'Jalan segede gitu, masih lewat?' },
      { en: 'Almost. Not really.', id: 'Dikit lagi. Boong deng.' },
      { en: 'Happens to everyone. Mostly.', id: 'Santai, semua orang juga gitu. Kayaknya.' },
      { en: 'Just a warm-up. Sure.', id: 'Oke, anggep aja pemanasan.' },
      { en: 'The road goes that way. Forward.', id: 'Jalannya lurus, bro. Lurus.' },
    ],
    spicy: [
      { en: 'That was embarrassing.', id: 'Anjir, malu-maluin.' },
      { en: 'Did you even look at the screen?', id: 'Mata lo di mana, bos?' },
    ],
  },
  {
    minAttempts: 4, // sarcastic
    messages: [
      { en: 'Skill issue.', id: 'Bukan mobilnya yang salah, bos.' },
      { en: 'Have you tried steering?', id: 'Lo udah nyoba nyetir belum sih?' },
      { en: 'The car did nothing wrong.', id: 'Kasian mobilnya, nggak salah apa-apa.' },
      { en: 'Bold strategy. Let’s see if it pays off.', id: 'Berani juga. Hasilnya? Ya gini deh.' },
      { en: 'Your steering is purely decorative, then.', id: 'Setirnya cuma pajangan ya?' },
      { en: 'Impressive. In a way.', id: 'Keren sih. Keren gagalnya.' },
    ],
    spicy: [
      { en: 'Noob detected.', id: 'Cupu parah, ngab.' },
      { en: 'My grandma drives better. She’s 90.', id: 'Nenek gue nyetirnya lebih jago. Umurnya 90.' },
      { en: 'Uninstall? Just asking.', id: 'Uninstall aja gimana? Nanya doang.' },
    ],
  },
  {
    minAttempts: 10, // concerned / cruel
    messages: [
      { en: 'Want to take a break?', id: 'Udahan dulu, ngopi gih.' },
      { en: 'This is attempt #{n}. Just saying.', id: 'Udah ke-{n} kali nih. Cuma ngingetin.' },
      { en: 'Maybe the road is the problem. It isn’t.', id: 'Mungkin jalannya yang salah? Nggak, lo yang salah.' },
      { en: 'Have you considered a different hobby?', id: 'Mending main ludo aja deh.' },
      { en: 'We’re not mad. Just disappointed.', id: 'Gue nggak marah. Cuma kecewa.' },
      { en: 'Your keyboard has filed a complaint.', id: 'Keyboard lo udah lapor Komnas HAM.' },
    ],
    spicy: [
      { en: 'Attempt #{n}. Are you okay?', id: 'Ke-{n} kali. Lo sehat, bos?' },
      { en: 'Even the vultures are tired of you.', id: 'Burung nasar aja udah capek nontonin lo.' },
      { en: 'Go touch grass. Not sand. Grass.', id: 'Keluar sana, cari angin. Jangan pasir mulu.' },
    ],
  },
  {
    minAttempts: 20, // absurd
    messages: [
      { en: 'No pain, no gain. Mostly pain.', id: 'Berakit-rakit ke hulu, sakitnya kok nggak kelar-kelar.' },
      { en: 'The road believes in you. Nobody else does.', id: 'Cuma jalanan yang masih percaya sama lo.' },
      { en: 'At this point we’re friends.', id: 'Udah, kita temenan aja sekarang.' },
      { en: 'The cacti have started a betting pool.', id: 'Kaktusnya udah taruhan lo bakal gagal lagi.' },
      { en: 'Attempt #{n}. The desert remembers.', id: 'Ke-{n} kali. Gurunnya udah hafal muka lo.' },
      { en: 'This is your life now.', id: 'Ini udah bukan main game, ini gaya hidup.' },
      { en: 'Somewhere, a vulture is taking notes.', id: 'Burung nasar di sana lagi nyatet kelakuan lo.' },
    ],
    spicy: [
      { en: 'Wow. Still going?', id: 'Anjir, masih lanjut aja?' },
      { en: '#{n}. Even I’m embarrassed for you.', id: 'Ke-{n}. Gue yang malu liatnya.' },
      { en: 'Your mom called. She wants her keyboard back.', id: 'Nyokap lo nelpon. Disuruh mandi.' },
    ],
  },
];

export const FINISH_MESSAGES = {
  messages: [
    { en: 'You did it. Was it worth it?', id: 'Berhasil. Terus? Bangga?' },
    { en: 'Congratulations. The desert is unimpressed.', id: 'Selamat. Gurunnya sih biasa aja.' },
    { en: 'That’s it. There is no Level 3. Go outside.', id: 'Udah, nggak ada Level 3. Sana mandi.' },
    { en: 'You beat a game about driving in a straight line. Mostly.', id: 'Lo menang game nyetir lurus doang. Ya kurang lebih.' },
    { en: '{n} attempts. Put that on your CV.', id: '{n} kali nyoba. Tulis di CV sana.' },
  ],
  spicy: [
    { en: '{n} attempts. Finally. Jeez.', id: '{n} kali nyoba. Akhirnya, anjir.' },
    { en: 'Took you long enough, champ.', id: 'Lama amat, bos. Gue sampe lumutan.' },
  ],
};

const fill = (line, n) => ({ en: line.en.replaceAll('{n}', String(n)), id: line.id.replaceAll('{n}', String(n)) });

export function tierFor(attempts) {
  let tier = TAUNT_TIERS[0];
  for (const t of TAUNT_TIERS) if (attempts >= t.minAttempts) tier = t;
  return tier;
}

const poolOf = (group, spicy) => (spicy ? [...group.messages, ...group.spicy] : group.messages);

/** Random pick from a list, never the same as `last`. */
function pickFresh(list, last, rng) {
  const options = list.length > 1 ? list.filter((m) => m !== last) : list;
  return options[Math.floor(rng() * options.length)];
}

export class TauntPicker {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.last = null;
    this.spicy = false; // Mode Pedas
  }

  /** @param {number} attempts failed attempts on the current level (1-based) → { en, id } */
  taunt(attempts) {
    this.last = pickFresh(poolOf(tierFor(attempts), this.spicy), this.last, this.rng);
    return fill(this.last, attempts);
  }

  finish(totalAttempts) {
    return fill(pickFresh(poolOf(FINISH_MESSAGES, this.spicy), null, this.rng), totalAttempts);
  }
}
