// A fast drop-in for csv-reader 1.0.0: byte-identical answers, less work per
// character. The reference walks the text one character at a time; this one
// jumps between delimiters with indexOf and slices whole fields at once,
// while carriage-return positions collected up front keep stray-CR checks
// O(1). Every broken-row rule of the reference is kept: stray CRs,
// unterminated quotes, quote junk, short and long rows, and the exact line
// and row each error carries.

// Ended-at codes for a field scan.
const AT_COMMA = 0;
const AT_BREAK = 1;
const AT_END = 2;

/** csv-reader 1.0.0's answer for one case's input, computed faster. */
export function run(input) {
  const s = String(input.text);
  const wantHeader = input.header === true;
  const n = s.length;
  const errs = [];
  const out = [];
  let cols = null;
  let w = -1;

  // Every '\r' in the text, collected once up front. Later checks ask "is
  // there one in this span?" by walking a pointer instead of re-scanning
  // from the cursor, which would go quadratic on sparse input.
  const rAt = [];
  for (let p = s.indexOf('\r', 0); p !== -1; p = s.indexOf('\r', p + 1)) rAt.push(p);
  let ri = 0;

  let i = s.charCodeAt(0) === 0xfeff ? 1 : 0;
  let ln = 1;
  let recLn = 1;
  let recRow = null;

  // Scan results, shared so field scans allocate nothing per field.
  let fVal = '';
  let fEnd = AT_END;
  let fKept = 0;

  function mark(code) {
    errs.push({ code, line: recLn, row: recRow });
  }

  // Reads an unquoted field starting at i, appending onto `seed`. A lone CR
  // is dropped with a stray_cr error and the field goes on; a CRLF ends it.
  // Sets fVal (the field), fEnd (how it ended) and fKept (characters added
  // during this scan, not counting the seed).
  function plain(seed) {
    let val = seed;
    let kept = 0;
    let seg = i;
    let parts = null;
    for (;;) {
      let eComma = s.indexOf(',', i);
      let eLf = s.indexOf('\n', i);
      if (eComma === -1) eComma = n;
      if (eLf === -1) eLf = n;
      const end = eComma < eLf ? eComma : eLf;
      while (ri < rAt.length && rAt[ri] < i) ri++;
      const cr = ri < rAt.length ? rAt[ri] : n;
      if (cr < end) {
        if (s.charCodeAt(cr + 1) === 10) {
          if (parts !== null) {
            parts.push(s.slice(seg, cr));
            val = parts.join('');
          } else {
            val += s.slice(seg, cr);
          }
          kept += cr - seg;
          i = cr + 2;
          ln += 1;
          fVal = val;
          fEnd = AT_BREAK;
          fKept = kept;
          return;
        }
        mark('stray_cr');
        if (parts === null) parts = [val];
        parts.push(s.slice(seg, cr));
        kept += cr - seg;
        i = cr + 1;
        seg = cr + 1;
        continue;
      }
      if (parts !== null) {
        parts.push(s.slice(seg, end));
        val = parts.join('');
      } else {
        val += s.slice(seg, end);
      }
      kept += end - seg;
      if (end === n) {
        i = n;
        fEnd = AT_END;
      } else if (end === eComma) {
        i = end + 1;
        fEnd = AT_COMMA;
      } else {
        i = end + 1;
        ln += 1;
        fEnd = AT_BREAK;
      }
      fVal = val;
      fKept = kept;
      return;
    }
  }

  // Normalizes the line breaks inside quoted content (CRLF and lone CR each
  // become one LF) and counts them. Returns [normalized, breakCount].
  function normalize(raw) {
    if (raw.indexOf('\r') === -1 && raw.indexOf('\n') === -1) return [raw, 0];
    let breaks = 0;
    let built = '';
    let seg = 0;
    for (let k = 0; k < raw.length; k++) {
      const ch = raw.charCodeAt(k);
      if (ch === 13) {
        built += raw.slice(seg, k) + '\n';
        breaks += 1;
        if (raw.charCodeAt(k + 1) === 10) k += 1;
        seg = k + 1;
      } else if (ch === 10) {
        breaks += 1;
      }
    }
    if (seg === 0) return [raw, breaks];
    built += raw.slice(seg);
    return [built, breaks];
  }

  // Reads a quoted field whose opening quote is at i. Sets fVal/fEnd/fKept.
  function quoted() {
    const open = i;
    const openLn = ln;
    i += 1;
    let chunks = null;
    let start = i;
    for (;;) {
      const q = s.indexOf('"', i);
      if (q === -1) {
        // The quote never closes: it is literal, and the rest is read again
        // as an unquoted field starting just past the opening quote.
        i = open + 1;
        ln = openLn;
        mark('unterminated_quote');
        plain('"');
        return;
      }
      if (s.charCodeAt(q + 1) === 34) {
        if (chunks === null) chunks = [];
        chunks.push(s.slice(start, q), '"');
        i = q + 2;
        start = q + 2;
        continue;
      }
      let raw;
      if (chunks === null) {
        raw = s.slice(start, q);
      } else {
        chunks.push(s.slice(start, q));
        raw = chunks.join('');
      }
      i = q + 1;
      // Line breaks inside the quotes count as lines and read as LF.
      const norm = normalize(raw);
      const val = norm[0];
      ln += norm[1];
      if (i >= n) {
        fVal = val;
        fEnd = AT_END;
        fKept = 0;
        return;
      }
      const c = s.charCodeAt(i);
      if (c === 44) {
        i += 1;
        fVal = val;
        fEnd = AT_COMMA;
        fKept = 0;
        return;
      }
      if (c === 10) {
        i += 1;
        ln += 1;
        fVal = val;
        fEnd = AT_BREAK;
        fKept = 0;
        return;
      }
      if (c === 13 && s.charCodeAt(i + 1) === 10) {
        i += 2;
        ln += 1;
        fVal = val;
        fEnd = AT_BREAK;
        fKept = 0;
        return;
      }
      // Whatever follows the closing quote is appended as it stands, up to
      // the next comma or line break; junk counts only when it adds text.
      plain(val);
      if (fKept > 0) mark('quote_junk');
      return;
    }
  }

  while (true) {
    // Lines left with no characters are no records.
    while (i < n) {
      const c = s.charCodeAt(i);
      if (c === 10) {
        i += 1;
        ln += 1;
      } else if (c === 13 && s.charCodeAt(i + 1) === 10) {
        i += 2;
        ln += 1;
      } else {
        break;
      }
    }
    if (i >= n) break;

    recLn = ln;
    recRow = wantHeader && cols === null ? null : out.length;

    // Fields are read one at a time: quoted fields through the quoted
    // scanner, unquoted fields through the plain scanner.
    const fields = [];
    let lastQuoted = false;
    let done = false;
    while (!done) {
      const isQ = s.charCodeAt(i) === 34;
      lastQuoted = isQ;
      if (isQ) quoted();
      else plain('');
      fields.push(fVal);
      done = fEnd !== AT_COMMA;
    }

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (w < 0) w = fields.length;
    if (wantHeader && cols === null) {
      cols = fields;
      continue;
    }
    if (fields.length < w) {
      errs.push({ code: 'short_row', line: recLn, row: recRow, fields: fields.length });
      while (fields.length < w) fields.push('');
    } else if (fields.length > w) {
      errs.push({ code: 'long_row', line: recLn, row: recRow, extra: fields.splice(w) });
    }
    out.push(fields);
  }
  return { columns: wantHeader ? (cols ?? []) : null, rows: out, errors: errs };
}
