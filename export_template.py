#!/usr/bin/env python3
"""Render the provided WSJ Poland workbook in place, preserving ZIP parts and hidden tabs.
Reads a JSON object with rows and 197 column keys from stdin; writes the XLSX to stdout.
No third-party Python packages are required on the VPS.
DO NOT assume Poland accepts label values until their import has been independently checked.
"""
import json, sys, re, zipfile, io
from xml.sax.saxutils import escape

TEMPLATE = __file__.rsplit('/',1)[0] + '/templates/Template 26th WSJ Data.xlsx'
SHEET = 'xl/worksheets/sheet2.xml'  # Import Data, verified from workbook relationships
CELL = re.compile(r'<c\b[^>]*\br="([A-Z]+)(\d+)"[^>]*(?:/>|>.*?</c>)', re.S)
ROW = re.compile(r'(<row\b[^>]*\br="(\d+)"[^>]*>)(.*?)(</row>)', re.S)

def colnum(column):
    n = 0
    for c in column:
        n = 26*n + ord(c)-64
    return n

def cell_xml(column, row, value, previous=''):
    # Text cells avoid losing leading zeroes in postal codes, numbers and passports.
    attrs = re.search(r'\bs="(\d+)"', previous)
    style = ' s="'+attrs.group(1)+'"' if attrs else ''
    value = str(value if value is not None else '')
    # Prevent formula injection; XML encoding retains literal contents.
    if value.lstrip().startswith(('=', '+', '-', '@')) and not re.fullmatch(r'-?\d+(?:\.\d+)?', value.strip()):
        value = "'" + value
    return f'<c r="{column}{row}"{style} t="inlineStr"><is><t xml:space="preserve">{escape(value)}</t></is></c>'

def render(source, rows, ordered_columns):
    data = source.decode('utf-8')
    requested = {index+5: item for index,item in enumerate(rows)}
    processed = set()
    def replace_row(match):
        prefix, number, content, suffix = match.groups()
        n = int(number)
        if n not in requested:
            return match.group()
        processed.add(n)
        existing = {m.group(1): m.group(0) for m in CELL.finditer(content)}
        colnames = set(existing) | set(ordered_columns)
        out = ''.join(cell_xml(c, n, requested[n].get(c, ''), existing.get(c, '')) if c in ordered_columns else existing[c]
                      for c in sorted(colnames, key=colnum))
        return prefix + out + suffix
    data = ROW.sub(replace_row, data)
    missing = [n for n in sorted(requested) if n not in processed]
    if missing:
        extra = ''.join(f'<row r="{n}">' + ''.join(cell_xml(c,n,requested[n].get(c,'')) for c in ordered_columns) + '</row>' for n in missing)
        data = data.replace('</sheetData>', extra+'</sheetData>',1)
    return data.encode('utf-8')

def main():
    info = json.load(sys.stdin)
    cols = info['columns']
    rows = info['rows']
    if len(cols)!=197 or len(set(cols))!=197 or len(rows)>10000:
        raise ValueError('Invalid import column count, duplicates, or row limit')
    with zipfile.ZipFile(TEMPLATE) as zin:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as zout:
            for member in zin.infolist():
                contents = zin.read(member.filename)
                if member.filename == SHEET:
                    contents = render(contents, rows, cols)
                zout.writestr(member, contents)
    sys.stdout.buffer.write(buf.getvalue())

if __name__ == '__main__':
    main()
