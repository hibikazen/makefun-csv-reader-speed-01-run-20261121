# Fast CSV reader

A faster drop-in replacement for make.fun's csv-reader 1.0.0: it answers
exactly as csv-reader does on every case, in less CPU time.

[![competition](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/hibikazen/makefun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/hibikazen/makefun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)

Enter the competition at
[make.fun](https://make.fun/c/csv-reader-speed-01-run-20261121).

## How it works

`solve.js` reads the input text once, left to right, in a single pass:

- Unquoted fields are scanned with `charCodeAt` and sliced once.
- Quoted fields jump to their closing quote with `indexOf`; a value is
  only rebuilt segment by segment when an escape, a line break, or a
  stray CR forces it.
- Errors (`stray_cr`, `quote_junk`, `unterminated_quote`, `short_row`,
  `long_row`) are recorded in the order met, each with the line its
  record starts on and the record's index in `rows`.

`main.ts` reads every case from `/input/cases.json`, answers each with
`solve.js`, and writes `/output/answers.json`.
