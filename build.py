#!/usr/bin/env python3
"""Build lead-line-leveler.html from the files in src/.

    python3 build.py           write lead-line-leveler.html
    python3 build.py --check   exit with an error if lead-line-leveler.html is out of date

The page is src/page.html with three markers filled in:
  /*@@styles.css@@*/  <- src/styles.css
  /*@@worker.js@@*/   <- every file in src/worker/, in name order (01-, 02-, ...)
  /*@@app.js@@*/      <- src/app.js
Each file in src/worker/ starts with a short description and a dashed line; those two lines
are left out of the built page. The worker files are pieces of one script, joined in order.
"""
import sys, glob, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, 'lead-line-leveler.html')


def read(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()


def strip_header(text):
    lines = text.split('\n')
    for i, line in enumerate(lines[:6]):
        if line.startswith('// ---'):
            return '\n'.join(lines[i + 1:])
    return text


def build():
    page = read(os.path.join(SRC, 'page.html'))
    worker = ''.join(strip_header(read(p)) for p in sorted(glob.glob(os.path.join(SRC, 'worker', '*.js'))))
    for marker, text in (('/*@@styles.css@@*/', read(os.path.join(SRC, 'styles.css'))),
                         ('/*@@worker.js@@*/', worker),
                         ('/*@@app.js@@*/', read(os.path.join(SRC, 'app.js')))):
        if page.count(marker) != 1:
            sys.exit(f'build: marker {marker} not found exactly once in src/page.html')
        page = page.replace(marker, text)
    return page


if __name__ == '__main__':
    html = build()
    if '--check' in sys.argv:
        if not os.path.exists(OUT) or read(OUT) != html:
            sys.exit('lead-line-leveler.html is out of date: run  python3 build.py')
        print('lead-line-leveler.html is up to date')
    else:
        with open(OUT, 'w', encoding='utf-8', newline='') as f:
            f.write(html)
        print(f'wrote lead-line-leveler.html ({len(html):,} bytes)')
