// Configurazione Firebase del sito Fantacatt.
// Copia qui i valori da: Console Firebase → Impostazioni progetto → Le tue app → App web → Configurazione SDK.
// Questi valori NON sono segreti: la protezione dei dati è garantita dalle regole in firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyDrxOPXEissd8ifiCZteBq-X7QIYSfVpj8",
  authDomain: "fantacatt-59892.firebaseapp.com",
  projectId: "fantacatt-59892",
  storageBucket: "fantacatt-59892.firebasestorage.app",
  messagingSenderId: "139064233903",
  appId: "1:139064233903:web:793ff03fa0797a411d695a"
};

// Email Google dell'amministratore principale (sempre ammesso, può caricare i dati e gestire gli utenti).
// Deve essere la stessa scritta in firestore.rules.
export const OWNER_EMAILS = ["buscaglia.gabriele02@gmail.com"];
