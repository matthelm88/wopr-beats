/* WOPR Beat Machine · example patch
   A template, not loaded until you add it to PATCHES in patches.js.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
/* What a patch can do:
   1. Add a button action:       A.myThing = (value, button) => { ... };   then use data-act="myThing" on a button.
   2. Run after every redraw:    on('render', () => { ... });
   3. Run once at start:         on('ready', () => { ... });
   4. Add a style or a kit:      GENRES.mystyle = {...};  KITS.mystyle = [...];
   5. Wrap an existing function: const _old = playStep; playStep = (idx, t) => { _old(idx, t); ... };
   6. Add CSS:                   document.head.insertAdjacentHTML('beforeend', '<style>...</style>');

   Example (commented out): a TEMPO x2 button in the PERFORM page's bottom row.

on('ready', () => {
  document.querySelector('#tab-perform .row:last-child').insertAdjacentHTML('beforeend',
    '<button class="btn" data-act="doubleTime">TEMPO x2</button>');
});
A.doubleTime = () => { S.tempo = Math.min(200, S.tempo * 2); renderBar(); };
*/
