// Adds the author of a "wave" issue to data/guests.json. Prints "added" or "exists".
//   LOGIN=octocat GUEST_ID=583231 node scripts/wave.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const { LOGIN = '', GUEST_ID = '' } = process.env;
if (!/^[A-Za-z0-9-]{1,39}$/.test(LOGIN) || !/^\d+$/.test(GUEST_ID)) throw new Error('bad guest');
const file = new URL('../data/guests.json', import.meta.url);
const guests = JSON.parse(readFileSync(file, 'utf8'));
if (guests.some(g => g.id === +GUEST_ID)) { console.log('exists'); process.exit(0); }
guests.unshift({ login: LOGIN, id: +GUEST_ID, at: new Date().toISOString().slice(0, 10) });
writeFileSync(file, JSON.stringify(guests.slice(0, 500), null, 1) + '\n');
console.log('added');
