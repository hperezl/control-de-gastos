window.CDG = window.CDG || {};

/* Cloud sync (Firebase Auth + Firestore), one shared document for the whole
   household. If the SDK or js/firebase-config.js aren't set up, init() returns
   false and the app keeps working purely with localStorage (see app.js). */
CDG.Cloud = (function () {
  const COLLECTION = "controles";
  const DOC_ID = "principal";

  let auth = null;
  let db = null;
  let ready = false;
  let unsubscribeSnapshot = null;

  function init() {
    if (typeof firebase === "undefined") {
      console.warn("Firebase SDK no está cargado: la app funcionará solo en modo local.");
      return false;
    }
    const cfg = window.CDG_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf("TU_") === 0) {
      console.warn("Falta configurar js/firebase-config.js con las llaves de tu proyecto Firebase.");
      return false;
    }
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    ready = true;
    return true;
  }

  function isReady() { return ready; }
  function isSignedIn() { return ready && !!auth.currentUser; }

  function signIn(email, password) { return auth.signInWithEmailAndPassword(email, password); }
  function resetPassword(email) { return auth.sendPasswordResetEmail(email); }
  function signOut() {
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    return auth.signOut();
  }
  function onAuthChange(cb) {
    if (!ready) { cb(null); return; }
    auth.onAuthStateChanged(cb);
  }

  function docRef() { return db.collection(COLLECTION).doc(DOC_ID); }

  function cargarUnaVez() {
    return docRef().get().then(snap => (snap.exists ? snap.data() : null));
  }

  function guardar(state) {
    if (!ready || !isSignedIn()) return Promise.resolve();
    const clean = JSON.parse(JSON.stringify(state));
    return docRef().set(clean).catch(err => console.error("Error guardando en la nube", err));
  }

  function escuchar(onChange) {
    if (!ready || !isSignedIn()) return;
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = docRef().onSnapshot(
      snap => { if (snap.exists) onChange(snap.data()); },
      err => console.error("Error escuchando cambios en la nube", err)
    );
  }

  return { init, isReady, isSignedIn, signIn, signOut, resetPassword, onAuthChange, cargarUnaVez, guardar, escuchar };
})();
