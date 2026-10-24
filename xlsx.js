// 외부 라이브러리 없이 .xlsx(OOXML + ZIP store)를 생성한다. 오프라인 번들 용도.
(function (g) {
  const enc = new TextEncoder();
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = b => {
    let c = ~0;
    for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (~c) >>> 0;
  };
  const u16 = v => [v & 255, (v >> 8) & 255];
  const u32 = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];

  function zip(files) {
    const parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0)]);
      parts.push(lh, name, f.data);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += lh.length + name.length + sz;
    }
    let cdSize = 0;
    for (const c of central) cdSize += c.length;
    const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(cdSize), ...u32(off), ...u16(0)]);
    return new Blob([...parts, ...central, end],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const str = (ref, v, s) => `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  const num = (ref, v, s) => `<c r="${ref}"${s ? ` s="${s}"` : ''}><v>${v}</v></c>`;

  // entries: [{no, name, amount, memo}] -> Blob
  function build(entries) {
    const rows = [`<row r="1">${str('A1', '연번', 1)}${str('B1', '이름', 1)}${str('C1', '금액(원)', 1)}${str('D1', '비고', 1)}</row>`];
    entries.forEach((e, i) => {
      const r = i + 2;
      rows.push(`<row r="${r}">${num('A' + r, e.no)}${str('B' + r, e.name || '')}${num('C' + r, e.amount, 2)}${str('D' + r, e.memo || '')}</row>`);
    });
    const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const files = {
      '[Content_Types].xml': X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels': X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml': X + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="축의금" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': X + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml': X + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Malgun Gothic"/></font><font><b/><sz val="11"/><name val="Malgun Gothic"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
      'xl/worksheets/sheet1.xml': X + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="16" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="30" customWidth="1"/></cols><sheetData>' + rows.join('') + '</sheetData></worksheet>',
    };
    return zip(Object.keys(files).map(name => ({ name, data: enc.encode(files[name]) })));
  }

  g.buildXlsx = build;
  if (typeof module !== 'undefined') module.exports = { buildXlsx: build };
})(typeof self !== 'undefined' ? self : globalThis);
