# Stained-Glass-Line-Editor

Fix line widths, smooth and straighten up pieces from scanned or crap AI patterns.

The program is **Lead Line Leveler** (`lead-line-leveler.html`).

Make every line in a stained glass pattern the same width, without changing the design.

Open a pattern image (a scan, a photo, a downloaded pattern, or a colored pattern with the glass filled in), set the size you'll print it at and the line width you want, and save a print-ready PNG (300 pixels per inch, with the print size stored in the file) or a vector SVG sized in inches.

## Use it

**Open it online:** https://aitro.github.io/Stained-Glass-Line-Editor/ (this works once GitHub Pages is turned on for the repository; see below).

**Or run it from your computer:**

1. On the repository page, click `lead-line-leveler.html`, then click the **Download raw file** button (the down-arrow icon at the top right of the file view). Clicking the file name alone only shows its code.
2. Double-click the downloaded file to open it in Chrome, Edge, Firefox or Safari. It runs entirely in your browser; nothing is uploaded anywhere.

Then:

1. Click **Open pattern image** (or drag an image onto the green mat, or paste one).
2. Set **Width × Height** in inches. With **Keep the pattern's proportions** on, changing one updates the other. Turn it off to stretch the pattern to an exact size; the stretch happens before the lines are redrawn, so every line still comes out the same width.
3. Set **Line width** in inches, points or millimetres (3 pt = 0.0417 in).
4. Check the **Overlay** view, which shows the new lines in red over your original.
5. Click **Save PNG** or **Save SVG**.

Fixing a spot by hand:
- Click **Fix lines** above the preview. Every junction gets a dot.
- Click a dot to choose which two lines run straight through it (the colored spokes on the picture match the colored buttons), to have no line run through, or to make it a sharp corner or a smooth curve.
- Click anywhere else on a line to put a sharp corner there, or to make a corner smooth.
- **Drag** a line to reshape it: the line bends toward where you drag, easing off along the line on either side. **Drag reach** (under the preview) sets how far along the line the pull goes. A straight line stays straight (it pivots, or moves as a whole). Drag a junction dot to move the junction; every line meeting there follows. Lines that end on a line you move stay attached to it.
- **Mirror** a line from the other side of the pattern: click the line you want to change, choose **Mirror the matching line from the other side…**, then click the line to copy. The copy is flipped across the pattern's upright centre line and the line you picked takes its shape. Where several lines meet at its end (such as the point of a V), that end stays put; an end that rests on another line slides along to meet it; lines that end on the changed line stay attached. Press Esc to cancel before the second click.
- Dragging redraws straight away; the program's own decisions aren't re-run, so a line dragged far enough to cross another won't join it automatically.
- Fixed spots turn green (a dragged spot shows a green diamond). **Automatic** on a spot removes its fix, drag or mirror; **Undo** and **Clear all fixes** are under the preview.
- Fixes are remembered in your browser for that picture, and stay put when you change the size or line width.

Optional:
- **Border line position**: where the new border line sits. *Centered* (the default) puts it on the middle of the original border, which is where you cut. *Outer edge* and *Inner edge* line it up with the outside or inside of the original border instead.
- **Give the outer border its own width** for a zinc or wide lead border.
- **Cleanup → Curve smoothing** for patterns with rough or shaky lines.
- **Cleanup → Dark cutoff** if faint lines are missed or smudges are picked up.
- **Cleanup → Make straight lines and circles exact** (on by default): lines drawn straight come out perfectly straight and circles perfectly circular.
- **Cleanup → Square up the panel** (on by default): lines that are nearly level or upright become exactly level or upright, so the borders are square.
- **Cleanup → Save PNG with a transparent background**.

### Turning on GitHub Pages (once, by the repository owner)

On GitHub, open the repository's **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick the branch **main** and the folder **/ (root)**, and click **Save**. After a minute or two the program opens at the address above.

## How it works

1. The drawing is cropped and enlarged to print resolution.
2. Dark pixels become lines. On a colored pattern, only pixels that are dark in every color count, so dark blue or green glass is not mistaken for lead lines. On black-and-white drawings, small gaps inside a line (a hollow or skipping marker stroke) are closed; specks are dropped.
3. The centre of every line is traced and turned into a network of lines and junctions.
4. Junctions are rebuilt the way a pattern is drawn:
   - a line that runs through a junction stays one continuous curve;
   - lines that end on another line land on it, and lines that meet it at one point in the original (like a pair of leaves, or the two sides of a petal tip) share one landing point;
   - a line that slides into another at a shallow angle joins it where the original does, and a rounded shape sitting on a curve (like a cheek) rounds into it;
   - a Y whose arms meet in a rounded bottom stays rounded;
   - crossings stay crossings, and real corners stay sharp.
5. Each curve is smoothed, but held close to the original wherever smoothing would move it by more than about a third of a line width.
6. Lines that are straight or circular in the drawing are replaced by exact straight lines and circles, with smooth hand-overs where they join freehand curves. Nearly level or upright lines are squared up.
7. Every line is redrawn as a vector stroke of exactly the chosen width.

## Edit it

The program you download is the single file `lead-line-leveler.html`, but it is built from smaller files in `src/`. Edit those, then rebuild:

```
python3 build.py
```

| File | What's in it |
| --- | --- |
| `src/page.html` | The page layout: controls, buttons, text |
| `src/styles.css` | Colors, fonts and layout |
| `src/app.js` | The page's behavior: opening a picture, sizing, the preview, saving PNG/SVG |
| `src/worker/01-image.js` | Reading the picture: dark/light cutoff, speck removal, thinning lines to their centers |
| `src/worker/02-filters.js` | Smoothing filters |
| `src/worker/03-process.js` | One run from picture to lines |
| `src/worker/04-geometry.js` | Small geometry helpers |
| `src/worker/05-smooth-piece.js` | Smoothing a single stretch of line |
| `src/worker/06-build-strokes.js` | The main logic: junctions, which lines carry on and which land, exact lines and circles, corners |
| `src/worker/07-messages.js` | How the page talks to the background worker |

Hand fixes reach the worker as `fixes` in the run settings (`[{x, y, mode, arms}]` in working pixels); `06-build-strokes.js` applies them at the junctions (`the user's fixes at junctions`) and when corners are chosen (`prepChain`).

The files in `src/worker/` are pieces of one script, joined in order (01, 02, ...). Each starts with a one-line description and a dashed line, which the build leaves out.

`python3 build.py --check` tells you whether `lead-line-leveler.html` matches `src/` (use it before committing).

Useful settings:

| What | Where |
| --- | --- |
| Output resolution (300 ppi) and margin (0.25 in) | `const OUT_PPI=300, MARGIN_IN=0.25` in `src/app.js` |
| Largest working image size | `MAX_WORK=3000` in `src/app.js` (raise for very large, detailed patterns; slower) |
| Smoothing strength | in `smoothPiece` (`src/worker/05-smooth-piece.js`): the `28` in `Math.pow(28*u*strength/...)` |
| How closely curves must follow the original | in `smoothPiece`: `tol=0.35*u` |
| Line-width presets | the `#presets` buttons in `src/page.html` (`data-in` is the width in inches) |

## Test it

Every fix to how lines are traced can shift lines somewhere else. The regression test runs a set of saved patterns through the program and checks that every line stays where its approved result has it.

```
node tests/run.js                    # run every case (about 2 minutes)
node tests/run.js lily-9in           # run one case
node tests/run.js --approve lily-9in # accept the current result of a case as the new approved one
```

A case fails if any line moves more than 2.5 working pixels (about a sixth of a line width) from its approved result, or a line appears or disappears. For each failing case the test writes `tests/out/NAME-diff.png`: approved lines in gray, new lines in red, with the moved spots marked in red (new) and blue (gone). Look at it, and approve the change only if it's an improvement.

The cases are listed in `tests/cases/` (one `.json` file each, with the settings). The patterns themselves (`NAME.gray.gz`, the picture exactly as the page hands it to the program) and their approved results (`NAME.approved.gz`) are kept on your computer, not on GitHub; put them in `tests/cases/` to run the test. Cases whose pattern isn't there are skipped.

To add a pattern as a new test case once its result looks right, ask Claude: the case needs the exact grayscale picture the page used, which is fiddly to save by hand.

You'll need Node.js (from nodejs.org) to run the test, and Python 3 to build.
