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

1. Click **Open pattern image** (or drag an image onto the green mat, or paste one). It is shown as it is; nothing is redrawn yet.
2. Set **Width × Height** in inches. With **Keep the pattern's proportions** on, changing one updates the other. Turn it off to stretch the pattern to an exact size; the stretch happens before the lines are redrawn, so every line still comes out the same width.
3. Set **Line width** in inches, points or millimetres (3 pt = 0.0417 in).
4. Press **Level lines** to redraw every line at that width, tidied: curves smoothed, joints rebuilt, nearly straight lines and circles made exact, the panel squared up. Or press **Change width only** to keep every line exactly where and how it was drawn and only change its width (Curve smoothing, exact lines and circles, and Square up are then switched off). You can switch between the two at any time; from then on, changing any setting or fix redraws it straight away. **Fix lines** works with either; on a picture not yet redrawn it uses Change width only. (Each new picture waits for one of the two again.)
5. Check the **Overlay** view, which shows the new lines in red over your original.
6. Click **Save PNG** or **Save SVG**. For a cutter (Silhouette and the like), click **Save DXF for cutter**: every glass piece becomes its own closed cut line, sitting half a line width back from each line, so the cut pieces keep the chosen gap between them. It opens in every edition of Silhouette Studio; units are inches.

Fixing a spot by hand:
- Click **Fix lines** above the preview. Every junction gets a dot.
- Click a dot to choose which two lines run straight through it (the colored spokes on the picture match the colored buttons), to have no line run through, or to make it a sharp corner or a smooth curve.
- Click anywhere else on a line to put a sharp corner there, or to make a corner smooth.
- **Drag** a line to reshape it: the line bends toward where you drag, easing off along the line on either side. **Drag reach** (under the preview) sets how far along the line the pull goes. A straight line stays straight (it pivots, or moves as a whole). Drag a junction dot to move the junction; every line meeting there follows. Lines that end on a line you move stay attached to it.
- Clicking right on a joint (a dot) opens the joint menu; clicking a line anywhere else, even close to a joint, opens the line menu.
- **Smooth this line** / **Straighten this line**: click a line and pick one. The stretch between its joints becomes one even curve, or a ruler-straight line, between the same ends; an end resting near the point of another line (the bottom of a V) moves onto that point. Set **Drag reach** to **whole line** to drag a whole stretch between its joints as one piece.
- **Remove this line**: click a line and pick **Remove this line (between its joints)**. That stretch is taken out of the result (handy for little circles inside circles that can't be cut in glass). The picture itself is not changed; Undo or Automatic brings it back.
- **Add a joint here**: click a line and add a joint; Smooth and Straighten then stop at it, so you can smooth a short section. Click the joint again to remove it.
- **Make symmetric…**: copies one half of the whole pattern onto the other, flipped. Pick left onto right, right onto left, top onto bottom or bottom onto top; the half that will be replaced is shaded and the dashed centre line is where the program found the drawing's middle. If it's off, drag the line (or its **+**) sideways first, then **Apply**. Lines running along the centre line stay whole. Press **Make symmetric…** again to change or remove it, or use Undo.
- **Tidy all lines…**: looks over every stretch of line between its joints. Nearly straight ones (never more than about half a lead width off the ruler line) are marked green to straighten; nearly even curves (smoothing would move them less than a lead width) are marked blue to smooth. Lines with real shape, and stretches you already straightened or smoothed, are left alone. Click a marked line to leave it out, then **Apply** (or Enter); Esc or Cancel changes nothing. They go in as ordinary Straighten and Smooth fixes, so one Undo takes them all out.
- **Draw a line**: drag from one line to another to add a straight lead line (shown dashed violet). An end near a line snaps onto it. Click the line later to remove it; Esc stops drawing.
- **Compare** (view): the original on the left of a divider and the new lines on the right; drag anywhere on the picture (or use the arrow keys) to move it.
- **Check pieces**: marks the glass pieces that are hard to cut, in orange: points sharper than 30°, inside curves deeper than they are wide, slivers under 1/4 inch wide, and pieces too small to hold while grinding. Fix them with the line tools; the marks update as you go. Press it again to hide them.
- **Rounded corner** (small, medium or large): click a sharp corner in a line, or a dot where two lines meet, and pick a size. The point is replaced by an even curve.
- Hovering over the picture highlights what a click or drag will take: one stretch of line, or a joint's dot (and with it every line meeting there). A drag takes a joint only when it starts right on its dot.
- **Mirror** a line from the other side of the pattern: click the line you want to change, choose **Mirror the matching line from the other side…**, then click the line to copy. Each line is taken between its joints (its ends and the spots where other lines end on it); the copy is flipped across the pattern's upright centre line and the line you picked takes its shape, however different the two sides were. Where several lines meet at its end (such as the point of a V), that end stays put; an end that rests on another line slides along to meet it; lines that end on the changed line stay attached. Press Esc to cancel before the second click.
- **Mirror an area**: press **Mirror an area**, then drag a box around a spot. A dashed box shows the matching spot on the other side of the pattern's centre line that it copies. When you let go, the pattern picture inside your box is replaced by a flipped copy of that spot and everything is traced again, so lines inside join exactly as on the other side and nothing outside the box changes. Where the two sides draw a line a little apart, the copy bends gently near the box edge so it meets the line outside. While you drag, dots mark where lines cross the edge of the box: green where the copy will line up with the line outside, red where the two sides draw that line apart (or only one side has it). Move the box's edges until the dots are green. Click inside the area later for **Remove the mirrored area here**, or use Undo. When you let go, nothing changes yet: drag the dashed box (anywhere inside it, or its round **+** handle) to line it up with what you want copied, then press **Apply the mirror** (or Enter; Esc cancels). Your own box stays exactly where you drew it. Applied areas keep the **+** handle, so the copy-from spot can be moved later too.
- Dragging redraws straight away; the program's own decisions aren't re-run, so a line dragged far enough to cross another won't join it automatically.
- Fixed spots turn green (a dragged spot shows a green diamond). **Automatic** on a spot removes its fix, drag or mirror; **Undo** and **Clear all fixes** are under the preview.
- Fixes are remembered in your browser for that picture, and stay put when you change the size or line width.

Optional:
- **Border line position**: where the new border line sits. *Centered* (the default) puts it on the middle of the original border, which is where you cut. *Outer edge* and *Inner edge* line it up with the outside or inside of the original border instead.
- **Give the outer border its own width** for a zinc or wide lead border.
- **Cleanup → Remove numbers and labels** (on by default): piece numbers and small writing drawn thinner than the lines are taken out before tracing. Turn it off if a pattern's real lines are very fine and some go missing.
- **Cleanup → Keep narrow gaps between lines** (off by default): for clean, crowded drawings such as Starry Night. Lines drawn close together and the thin tips of pieces are traced as drawn instead of being run together, and a line that would cross another just before its end stops on it instead. Leave it off for scans with broken or hollow lines, which it would no longer close up.
- **Cleanup → Curve smoothing** for patterns with rough or shaky lines.
- **Cleanup → Dark cutoff** if faint lines are missed or smudges are picked up.
- **Cleanup → Make straight lines and circles exact** (on by default): lines drawn straight come out perfectly straight and circles perfectly circular.
- **Cleanup → Square up the panel** (on by default): lines that are nearly level or upright become exactly level or upright, so the borders are square.
- **Cleanup → Save PNG with a transparent background**.
- The pattern size is remembered for each picture in this browser, and a saved PNG carries the size it was made at, so opening it here again keeps that size.
- **Save PNG at** (under Pattern size): 300 or 600 px per inch. The preview is always drawn at 300; a 600 PNG is drawn afresh when you save it (about four times the pixels, so it takes a moment). SVG and DXF are lines, so they are sharp at any size.
- **Save at exactly this size** (under Pattern size): the saved PNG, SVG and DXF are exactly the width and height typed in, with no margin; the lines are spread or drawn in a hair (well under 1% as a rule) so the outside edge of the outermost lead lands exactly on the edge. The lead keeps its width. Off, ¼″ of blank margin goes round the pattern. The preview keeps its margin either way.

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
| `src/worker/10-text.js` | Taking out piece numbers and labels (Cleanup: **Remove numbers and labels**) |
| `src/worker/11-uncross.js` | Keep narrow gaps: lines that cross just before their end stop on the line they cross |
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
