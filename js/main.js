/* WOPR Beat Machine · main
   Starts the app, then loads any patches listed in js/patches/patches.js.
   All files share one global scope: anything defined in an earlier file can be used here.
   Load order is set in index.html. */
generate();
log('GREETINGS PROFESSOR FALKEN.');
loadPatches(() => { emit('ready'); render(); });
