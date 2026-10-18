# WOPR Beat Machine

A phone drum-pattern generator for the Pocket Operator PO-35, with a WarGames look.

## Files

| File | What's in it | Edit it to... |
|---|---|---|
| `index.html` | The page layout (buttons, tabs, sections) and the list of scripts | add a new button or section, or bump the version |
| `css/style.css` | All colors, fonts and layout | change the look |
| `js/core.js` | Shared helpers, the five tracks, app state, dice, patch hooks | rarely |
| `js/styles.js` | Genre grooves (tempo, swing, step odds) | add or tune a style |
| `js/kits.js` | Synthesized drum kits, three per style | add or tune a kit |
| `js/audio.js` | Sound engine and pitch effects | change how sounds are made |
| `js/history.js` | Back/forward history | rarely |
| `js/generate.js` | NEW BEAT, TWEAK, FILL, length changes | change how beats are rolled |
| `js/moves.js` | Section moves, spices, ROLL A SONG | add or tune a move |
| `js/sequencer.js` | Playback clock and playhead | change timing |
| `js/perform.js` | PERFORM page punch-in effects | add or tune an effect |
| `js/po.js` | PO VIEW helpers, build order, chain, copy text, MIDI | change the PO instructions |
| `js/render.js` | Draws every screen | change what a screen shows |
| `js/actions.js` | What each button does | change a button's behaviour |
| `js/main.js` | Starts the app, loads patches | rarely |
| `js/patches/` | Add-on features (currently: `save-file.js`, EXPORT/LOAD on the SAVED tab) | add something new without touching the files above |

All scripts share one global scope, so a later file can use anything an earlier file defines. The load order is the list of `<script>` tags at the bottom of `index.html`.

## Adding a feature as a patch

1. Copy `js/patches/example-patch.js` to a new file, for example `js/patches/my-idea.js`, and write the feature there.
2. Add `'my-idea.js',` to the `PATCHES` list in `js/patches/patches.js`.
3. Upload both files.

A patch can add button actions (`A.name = ...`), run after every redraw (`on('render', fn)`), run once at start (`on('ready', fn)`), add styles or kits, or wrap an existing function. The example file shows each one.

## Updating the site

Upload only the files that changed (GitHub: **Add file → Upload files**, drag them in, **Commit changes**). Keep the folder structure: files in `js/` go in the `js` folder.

Each script tag ends in `?v=16`. When you change any file, raise that number in `index.html` (all of them, for example to `?v=17`) and upload `index.html` too, so phones load the new files instead of old cached copies.
