// A faster drop-in for csv-reader 1.0.0: reads the same quirky CSV dialect
// and returns {columns, rows, errors} exactly as csv-reader does.
//
// Single left-to-right pass. Unquoted fields are scanned with charCodeAt and
// sliced once; quoted fields jump to the closing quote with indexOf; a value
// is only rebuilt segment by segment when an escape, a line break, or a
// stray CR forces it.

export function run(input) {
  const text = input.text;
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = header ? [] : null;
  let width = -1;
  let line = 1;
  let i = 0;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) i = 1;

  while (i < n) {
    // At the start of a record: skip lines left with no characters. A
    // stray CR does not make a line empty: it belongs to the record's
    // first field, which it starts as unquoted, so a quote after it is
    // a literal character.
    for (;;) {
      if (i >= n) break;
      const c = text.charCodeAt(i);
      if (c === 10) { i++; line++; continue; }
      if (c === 13 && i + 1 < n && text.charCodeAt(i + 1) === 10) { i += 2; line++; continue; }
      break;
    }
    if (i >= n) break;

    const recordStartLine = line;
    const recordRow = header && width < 0 ? null : rows.length;
    const fields = [];
    let recordDone = false;
    let firstField = true;
    let noRecord = false;

    while (!recordDone) {
      let isQuoted = false;
      if (text.charCodeAt(i) === 34) {
        // A field that opens with a quote runs to the next quote that is
        // not doubled; "" inside it is one quote.
        let q = text.indexOf('"', i + 1);
        let escaped = false;
        while (q !== -1 && q + 1 < n && text.charCodeAt(q + 1) === 34) {
          escaped = true;
          q = text.indexOf('"', q + 2);
        }
        if (q !== -1) {
          isQuoted = true;
          let value;
          let rebuild = escaped;
          if (!rebuild) {
            const nl = text.indexOf('\n', i + 1);
            const cr = text.indexOf('\r', i + 1);
            if ((nl !== -1 && nl < q) || (cr !== -1 && cr < q)) rebuild = true;
          }
          if (!rebuild) {
            value = text.slice(i + 1, q);
          } else {
            // Each CRLF or lone CR inside the quotes is read as LF, and
            // every line break inside counts for the lines after it.
            const parts = [];
            let seg = i + 1;
            let j = i + 1;
            while (j < q) {
              const c = text.charCodeAt(j);
              if (c === 34) {
                parts.push(text.slice(seg, j));
                parts.push('"');
                j += 2;
                seg = j;
              } else if (c === 13) {
                parts.push(text.slice(seg, j));
                parts.push('\n');
                line++;
                j += (j + 1 < q && text.charCodeAt(j + 1) === 10) ? 2 : 1;
                seg = j;
              } else if (c === 10) {
                parts.push(text.slice(seg, j));
                parts.push('\n');
                line++;
                j++;
                seg = j;
              } else {
                j++;
              }
            }
            parts.push(text.slice(seg, q));
            value = parts.join('');
          }
          // What follows the closing quote, up to the next comma or line
          // break, is appended as it stands; stray CRs in it are dropped.
          let junkSeg = q + 1;
          let junkEnd = junkSeg;
          let junkParts = null;
          let term = 3;
          while (junkEnd < n) {
            const c = text.charCodeAt(junkEnd);
            if (c === 44) { term = 0; break; }
            if (c === 10) { term = 1; break; }
            if (c === 13) {
              if (junkEnd + 1 < n && text.charCodeAt(junkEnd + 1) === 10) { term = 2; break; }
              errors.push({ code: 'stray_cr', line: recordStartLine, row: recordRow });
              if (junkParts === null) junkParts = [];
              junkParts.push(text.slice(junkSeg, junkEnd));
              junkEnd++;
              junkSeg = junkEnd;
              continue;
            }
            junkEnd++;
          }
          let junk;
          if (junkParts === null) junk = text.slice(junkSeg, junkEnd);
          else { junkParts.push(text.slice(junkSeg, junkEnd)); junk = junkParts.join(''); }
          if (junk.length > 0) {
            value += junk;
            errors.push({ code: 'quote_junk', line: recordStartLine, row: recordRow });
          }
          fields.push(value);
          if (firstField) firstField = false;
          i = junkEnd;
          if (term === 0) { i++; }
          else if (term === 1) { i++; line++; recordDone = true; }
          else if (term === 2) { i += 2; line++; recordDone = true; }
          else { recordDone = true; }
        } else {
          // A quote that never closes is a literal character, and the
          // text after it is read again as unquoted.
          errors.push({ code: 'unterminated_quote', line: recordStartLine, row: recordRow });
        }
      }
      if (!isQuoted) {
        // An unquoted field runs to a comma or a line break. A quote
        // inside it is literal; a CR not followed by LF is dropped.
        let fieldStart = i;
        let parts = null;
        let end = i;
        let term = 3;
        while (end < n) {
          const c = text.charCodeAt(end);
          if (c === 44) { term = 0; break; }
          if (c === 10) { term = 1; break; }
          if (c === 13) {
            if (end + 1 < n && text.charCodeAt(end + 1) === 10) { term = 2; break; }
            errors.push({ code: 'stray_cr', line: recordStartLine, row: recordRow });
            if (parts === null) parts = [];
            parts.push(text.slice(fieldStart, end));
            end++;
            fieldStart = end;
            continue;
          }
          end++;
        }
        let value;
        if (parts === null) value = text.slice(fieldStart, end);
        else { parts.push(text.slice(fieldStart, end)); value = parts.join(''); }
        fields.push(value);
        if (firstField) {
          firstField = false;
          // A first field left empty by an unquoted scan that met only
          // stray CRs before a line break or EOF leaves the line with no
          // characters: no record (its stray CRs still count as errors).
          if (value === '' && term !== 0) noRecord = true;
        }
        i = end;
        if (term === 0) { i++; }
        else if (term === 1) { i++; line++; recordDone = true; }
        else if (term === 2) { i += 2; line++; recordDone = true; }
        else { recordDone = true; }
      }
    }

    if (noRecord) continue;

    if (width < 0) {
      width = fields.length;
      if (header) columns = fields;
      else rows.push(fields);
    } else if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordStartLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
      rows.push(fields);
    } else if (fields.length > width) {
      const extra = fields.slice(width);
      errors.push({ code: 'long_row', line: recordStartLine, row: recordRow, extra });
      fields.length = width;
      rows.push(fields);
    } else {
      rows.push(fields);
    }
  }

  return { columns, rows, errors };
}
