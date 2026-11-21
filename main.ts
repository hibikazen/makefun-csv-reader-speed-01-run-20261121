// Driver: reads every case from /input/cases.json, answers each with
// solve.js's run, and writes /output/answers.json.
import { setFlagsFromString } from 'node:v8';
import { readFileSync, writeFileSync } from 'node:fs';

// Incremental marking costs more than it saves on a short batch run that
// allocates once and exits, so it goes off before solve.js is imported.
setFlagsFromString('--no-incremental-marking');

const { run } = await import('./solve.js');
const cases = JSON.parse(readFileSync('/input/cases.json', 'utf8'));
const answers = new Array(cases.length);
for (let k = 0; k < cases.length; k++) answers[k] = run(cases[k].input);
writeFileSync('/output/answers.json', JSON.stringify(answers));
