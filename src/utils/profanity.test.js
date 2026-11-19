import { describe, it, expect } from 'vitest';
import { containsProfanity, newStrings } from './profanity.js';

const bad = ['fuck you', 'f.u.c.k', 'fuuuuck', 'sh1t man', 'tui ekta magi', 'khankir pola', 'kuttar bacha',
  'bokachoda', 'তুই একটা খানকি', 'বালের কথা', 'মাগির পোলা', 'কুত্তার বাচ্চা', 'madarchod', 'f u c k', 'b!tch', 'চুদি',
  'bhenchod', 'tu chutiya hai', 'teri maa ki', 'bhosdike', 'gaandu', 'साला चूतिया', 'मादरचोद', 'तेरी माँ की', 'bsdk', 'lawde'];
const ok = ['class assessment', 'balance sheet', 'assignment', 'Mashallah', 'ami bhalo achi', 'বালতি আনো',
  'বালিশ', 'kutta ta onek cute', 'classic', 'passed', 'hello', 'AirPods', 'Dhaka te jabo', 'bc of rain', 'sala amar bhai', 'नमस्ते दोस्त', 'kya haal hai', 'Gandhi'];

describe('containsProfanity', () => {
  it.each(bad)('flags %s', (t) => expect(containsProfanity(t).hit).toBe(true));
  it.each(ok)('allows %s', (t) => expect(containsProfanity(t).hit).toBe(false));
});

describe('newStrings', () => {
  it('returns only added text', () => {
    expect(newStrings([{ t: 'a' }], [{ t: 'a' }, { t: 'b' }])).toEqual(['b']);
  });
});
