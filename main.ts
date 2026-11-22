// Entry driver: the harness runs `node /bot/main.ts`. It reads every case
// from the input directory, answers each one alone with run() from solve.js,
// and writes the answers in order. Outside a container, MAKEFUN_INPUT_DIR
// and MAKEFUN_OUTPUT_DIR stand in for /input and /output. Each case is
// answered on its own: nothing is carried from one case to the next, so the
// two runs the grader makes agree byte for byte.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { setFlagsFromString as tuneV8 } from 'node:v8';

// Keep V8's incremental marking off for all of solve.js, so the timed work
// runs under the same flags as the house baseline.
tuneV8('--no-incremental-marking');

const { run } = await import('./solve.js');

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(fs.readFileSync(path.join(inDir, 'cases.json'), 'utf8'));
const answers = new Array(cases.length);
for (let k = 0; k < cases.length; k++) answers[k] = run(cases[k].input);
fs.writeFileSync(path.join(outDir, 'answers.json'), JSON.stringify(answers));
