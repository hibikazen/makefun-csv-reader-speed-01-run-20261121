# Fast csv-reader drop-in

[![csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/hibikazen/makefun-csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/hibikazen/makefun-csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, entered in
[Read broken CSV files faster, 21 November 2026](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
on [make.fun](https://make.fun).

`solve.js` answers every case exactly as csv-reader 1.0.0 does — same
`{columns, rows, errors}` for every input, including stray CRs, unterminated
quotes, quote junk, and short or long rows — but it does less work per
character: it jumps between delimiters with `indexOf`, slices whole fields
at once, and takes a whole-line shortcut whenever a line holds no quoted
field and no carriage return. `main.ts` is the driver the harness runs: it
reads the cases, answers each with `run`, and writes the answers.
