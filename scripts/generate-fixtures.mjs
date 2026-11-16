// Generates synthetic parser fixtures: node scripts/generate-fixtures.mjs
// Output: src/lib/__fixtures__/{running-furniture.pdf,notes.epub}. Text is original/synthetic.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', '__fixtures__');
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- PDF
const esc = (s) => s.replace(/([\\()])/g, '\\$1');
// Each body line: plain string, or [before, marker, after] for a superscript note marker.
const pdfPages = [
  [
    ['The study of recog-', 'nition begins with a well-known observation about', 'patient readers and the pace of their eyes.'],
    ['A second paragraph follows here and it keeps going until the', 'line ends with a hyphenated exam-', 'ple that wraps cleanly onto the next line.'],
  ],
  [
    ['Another page continues with calm prose about reading', ['speed and comfort', '1', ' for every kind of reader.']],
    ['Closing thoughts on this page end with a full stop.'],
  ],
  [
    ['The third page talks about a state-of-the-art method for', 'pacing words one at a time on a quiet screen.'],
  ],
  [
    ['Page four has its own short paragraph of body text for', 'the fixture, ending with a period.'],
  ],
];
const footnotes = { 1: '1 This footnote explains the earlier claim in detail.' };

function pageStream(pageIdx, lines) {
  const n = pageIdx + 1;
  let s = '';
  const text = (x, y, size, str) => `BT /F1 ${size} Tf ${x} ${y} Td (${esc(str)}) Tj ET\n`;
  s += text(72, 740, 10, 'THE SYNTHETIC TREATISE');
  let y = 690;
  for (const para of lines) {
    for (const line of para) {
      if (typeof line === 'string') s += text(72, y, 12, line);
      else {
        const [a, mark, c] = line;
        s += `BT /F1 12 Tf 72 ${y} Td (${esc(a)}) Tj /F1 7 Tf 5 Ts (${mark}) Tj 0 Ts /F1 12 Tf (${esc(c)}) Tj ET\n`;
      }
      y -= 16;
    }
    y -= 14;
  }
  if (footnotes[n]) s += text(72, 90, 8, footnotes[n]);
  s += text(300, 40, 10, `Page ${n}`);
  return s;
}
const flat = pdfPages;

const objs = [];
const add = (body) => (objs.push(body), objs.length);
add('<< /Type /Catalog /Pages 2 0 R >>');
add(`<< /Type /Pages /Kids [${flat.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${flat.length} >>`);
add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
flat.forEach((paras, i) => {
  const stream = pageStream(i, paras);
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
  add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
});
let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(join(outDir, 'running-furniture.pdf'), pdf, 'latin1');

// ---------------------------------------------------------------- EPUB
const zip = new JSZip();
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
zip.file('OEBPS/content.opf', `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Notes Fixture</dc:title><dc:creator>Test Author</dc:creator><dc:identifier id="id">fixture-notes</dc:identifier></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/><item id="en" href="endnotes.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="nav" linear="no"/><itemref idref="c1"/><itemref idref="c2"/><itemref idref="en"/></spine></package>`);
const xhtml = (body) => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>x</title></head><body>${body}</body></html>`;
zip.file('OEBPS/nav.xhtml', xhtml('<nav epub:type="toc"><ol><li><a href="ch1.xhtml">First Chapter</a></li><li><a href="ch2.xhtml">Second Chapter</a></li><li><a href="endnotes.xhtml">Notes</a></li></ol></nav>'));
zip.file('OEBPS/ch1.xhtml', xhtml(
  '<h1>First Chapter</h1>' +
  '<p>A well-known fact about read­ing is that it rewards patience.<a epub:type="noteref" href="#fn1" id="r1"><sup>1</sup></a> Another claim follows<sup>2</sup> here.</p>' +
  '<p>Terms like state-of-the-art stay intact, while hidden text <span style="display:none">SECRETHIDDEN</span>vanishes and 10<sup>2</sup> is kept.</p>' +
  '<aside epub:type="footnote" id="fn1"><p>1. FOOTNOTEBODY explains the first claim.</p></aside>' +
  '<p aria-hidden="true">ARIAHIDDEN</p>'));
zip.file('OEBPS/ch2.xhtml', xhtml(
  '<h1>Second Chapter</h1><p>The second chapter cites an endnote.<sup><a href="endnotes.xhtml#en1">3</a></sup> Then it ends.</p>'));
zip.file('OEBPS/endnotes.xhtml', xhtml('<h1>Notes</h1><ol><li id="en1">ENDNOTEBODY lives in the notes section.</li></ol>'));
writeFileSync(join(outDir, 'notes.epub'), await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' }));
console.log('fixtures written to', outDir);
