// Tiny stack VM: runs each program.bin/input.bin in the input dir, writes
// stdout.bin + exit.txt per instance; traps exit with their own code.
import { mkdirSync as M, readdirSync as R, readFileSync as F, writeFileSync as W } from "node:fs";
import { join as J } from "node:path";
const I = process.env.MAKEFUN_INPUT_DIR ?? "/input", O = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const M0 = 0x7fff00ff, M1 = 0x1f0007, M2 = 0xf0003; // valid-opcode bits per 32 block
// Binary ops in opcode order 0x10..0x22; null slots are unary/invalid ops.
const B = [
(a, b) => (a + b) | 0, (a, b) => (a - b) | 0, (a, b) => Math.imul(a, b),
(a, b) => { if (!b) throw 4; return (a / b) | 0; },
(a, b) => { if (!b) throw 4; return b == -1 ? 0 : (a % b) | 0; },
(a, b) => { if (!b) throw 4; return Math.floor((a >>> 0) / (b >>> 0)) | 0; },
(a, b) => { if (!b) throw 4; return ((a >>> 0) % (b >>> 0)) | 0; }, null,
(a, b) => a & b, (a, b) => a | b, (a, b) => a ^ b, null,
(a, b) => a << (b & 31), (a, b) => a >> (b & 31), (a, b) => (a >>> (b & 31)) | 0, null,
(a, b) => a == b ? 1 : 0, (a, b) => a < b ? 1 : 0, (a, b) => (a >>> 0) < (b >>> 0) ? 1 : 0];
function run(p, q) {
const S = new Int32Array(256), C = new Int32Array(64), m = new Int32Array(256), o = new Uint8Array(65536);
let s = 0, c = 0, pc = 0, n = 0, t = 0, i = 0;
const pop = () => { if (!s) throw 2; return S[--s]; };
const push = (v) => { if (s > 255) throw 3; S[s++] = v | 0; };
const done = (e) => ({ b: o.slice(0, n), e });
try {
for (;;) {
if (t >= 1e6) throw 10;
if (pc < 0 || pc >= p.length) throw 9;
const op = p[pc], mask = op < 32 ? M0 : op < 64 ? M1 : M2;
if (op > 0x53 || !((mask >> (op & 31)) & 1)) throw 5;
const im = op == 1 ? 1 : op == 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
if (pc + im >= p.length) throw 9;
t++;
const nx = pc + 1 + im;
pc = nx;
switch (op) {
case 0: return done(0);
case 1: push((p[nx - 1] << 24) >> 24); break;
case 2: push(p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24)); break;
case 3: pop(); break;
case 4: if (!s) throw 2; push(S[s - 1]); break;
case 5: { if (s < 2) throw 2; const v = S[s - 1]; S[s - 1] = S[s - 2]; S[s - 2] = v; break; }
case 6: if (s < 2) throw 2; push(S[s - 2]); break;
case 7: { if (s < 3) throw 2; const v = S[s - 3]; S[s - 3] = S[s - 2]; S[s - 2] = S[s - 1]; S[s - 1] = v; break; }
case 0x17: case 0x1b: if (!s) throw 2; S[s - 1] = op == 0x17 ? -S[s - 1] | 0 : ~S[s - 1]; break;
case 0x30: case 0x31: case 0x32: {
const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
if (op == 0x30 || (op == 0x31) == (pop() == 0)) pc = nx + rel;
break; }
case 0x33: if (c > 63) throw 7; C[c++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
case 0x34: if (!c) throw 8; pc = C[--c]; break;
case 0x40: { const a = pop(); if (a < 0 || a > 255) throw 6; push(m[a]); break; }
case 0x41: { const a = pop(), v = pop(); if (a < 0 || a > 255) throw 6; m[a] = v; break; }
case 0x50: { const w = String(pop()); if (n + w.length > 65536) throw 11; for (const ch of w) o[n++] = ch.charCodeAt(0); break; }
case 0x51: { const v = pop(); if (n > 65535) throw 11; o[n++] = v & 255; break; }
case 0x52: push(i < q.length ? q[i++] : -1); break;
case 0x53: return done(pop() & 255);
default: { const b = pop(), a = pop(); push(B[op - 16](a, b)); }
}
}
} catch (e) { return done(e); }
}
for (const id of R(I).sort()) {
const r = run(F(J(I, id, "program.bin")), F(J(I, id, "input.bin")));
M(J(O, id), { recursive: true });
W(J(O, id, "stdout.bin"), r.b);
W(J(O, id, "exit.txt"), r.e + "\n");
}
