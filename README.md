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

Everything is in the single file `lead-line-leveler.html`. Open it in any text editor (VS Code, Notepad, TextEdit in plain-text mode), save, and reload the page in your browser.

Useful places to start:

| What | Where in the file |
| --- | --- |
| Output resolution (300 ppi) and margin (0.25 in) | `const OUT_PPI=300, MARGIN_IN=0.25` |
| Largest working image size | `MAX_WORK=3000` (raise for very large, detailed patterns; slower) |
| Smoothing strength | in `smoothPiece`: the `28` in `Math.pow(28*u*strength/...)` |
| How closely curves must follow the original | in `smoothPiece`: `tol=0.35*u` |
| Line-width presets | the `#presets` buttons (`data-in` is the width in inches) |
| Colours and fonts | the `:root` block at the top of the `<style>` section |

The image processing runs in a background worker; its code is in the `<script type="text/plain" id="worker-src">` block. The page controls are in the last `<script>` block.
