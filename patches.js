/* WOPR Beat Machine · patches
   Patch loader. To add a feature without touching the core files: put a .js file in js/patches/ and add its file name to PATCHES below. Patches load in order, after the app has started.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
const PATCHES = [
  'save-file.js',        // EXPORT / LOAD buttons on the SAVED tab
  // 'example-patch.js',
];
const PATCH_V = (document.currentScript && new URL(document.currentScript.src, location.href).searchParams.get('v')) || WOPR_VERSION;
function loadPatches(done){
  let i = 0;
  const next = () => {
    if (i >= PATCHES.length) return done();
    const s = document.createElement('script');
    s.src = 'js/patches/' + PATCHES[i++] + '?v=' + PATCH_V;
    s.onload = next;
    s.onerror = () => { console.error('Patch failed to load:', s.src); next(); };
    document.body.appendChild(s);
  };
  next();
}
