/**
 * parseImport.js — turns pasted text into cards for Quick Import.
 *
 * One card per line. The line is split on the FIRST separator found, trying
 * these in order (so "well-known - famous" splits on " - ", not the hyphen):
 *   Tab, " - ", " – ", " — ", "-"
 */

const SEPARATORS = ['\t', ' - ', ' – ', ' — ', '-'];

/**
 * @param {string} text Raw pasted text.
 * @returns {{cards: {front: string, back: string}[], skipped: {line: number, text: string}[]}}
 */
export function parseImport(text) {
  const cards = [];
  const skipped = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return; // blank lines are ignored silently

    const sep = SEPARATORS.find((s) => raw.includes(s));
    if (sep) {
      const at = raw.indexOf(sep);
      const front = raw.slice(0, at).trim();
      const back = raw.slice(at + sep.length).trim();
      if (front && back) {
        cards.push({ front, back });
        return;
      }
    }
    skipped.push({ line: i + 1, text: raw.trim() });
  });

  return { cards, skipped };
}
