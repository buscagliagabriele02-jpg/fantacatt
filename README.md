# Fantacatt 26/27

Sito della lega Fantacatt: rose, salary cap, bilanci, trasferimenti, giocatori, albo d'oro e premi.
Accesso riservato agli allenatori autorizzati, con account Google.

## Come funziona

- **Sito**: pagine statiche pubblicate con GitHub Pages (`index.html`, `parser.js`, `backend.js`, `config.js`).
- **Login e dati**: Firebase (Authentication con Google + database Firestore), piano gratuito.
- **Dati della lega**: l'amministratore carica dal sito il file `.xlsx` scaricato da Google Sheets
  (File → Scarica → Microsoft Excel). Il file viene letto nel browser e salvato nel database:
  tutti gli allenatori vedono subito i dati nuovi.
- **Trasferimenti**: calcolati confrontando le rose attuali con il file di chiusura della stagione precedente,
  da caricare una volta dal pannello Admin.
- **Utenti**: l'amministratore aggiunge le email Google degli allenatori dal pannello Admin, con la loro squadra.

Nel repository non ci sono dati della lega: stanno solo nel database, protetti dalle regole di `firestore.rules`.

## Configurazione (una volta sola)

1. Console Firebase → crea il progetto `fantacatt`.
2. Authentication → Metodo di accesso → abilita **Google**.
3. Firestore Database → crea il database (posizione europea, modalità produzione).
4. Firestore → Regole → incolla `firestore.rules` con la tua email al posto di `INSERISCI_TUA_EMAIL@gmail.com` → Pubblica.
5. Impostazioni progetto → Le tue app → aggiungi un'app **Web** → copia la configurazione in `config.js`
   e inserisci la tua email in `OWNER_EMAILS`.
6. Authentication → Impostazioni → Domini autorizzati → aggiungi `NOMEUTENTE.github.io`.
7. Su GitHub: Settings → Pages → Deploy from a branch → `main` / root.

## Dove modificare

- Albo d'oro: costante `ALBO` in `index.html`.
- Nomi abbreviati nei movimenti di mercato: costante `MOVE_NAMES` in `index.html`.
- Lettura del file Excel: `parser.js`.
