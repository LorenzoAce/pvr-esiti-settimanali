# Documentazione Prodotto — PVR Esiti Settimanali

## Panoramica

- Applicazione web per la gestione degli "Esiti Settimanali" PVR, con dashboard condivisa tra utenti.
- Stack: React + TypeScript, Vite, Tailwind CSS, Supabase (Auth, DB, RLS), PWA installabile su smartphone.
- Ottimizzata per mobile: icone-only su schermi piccoli, tabella scrollabile orizzontalmente, indicatori di scorrimento.

## Funzionalità Principali

- Dashboard condivisa per tutti gli utenti.
- Gerarchia ruoli: master, agente, collaboratore, PVR, user.
- Azioni principali:
  - `Nuova Voce`: aggiunge una riga in tabella.
  - `Nuova Tabella`: azzera la tabella globalmente previa conferma in modal.
  - `Salva Archivio`: salva uno snapshot (stato della tabella) con nome.
- Archivio Tabelle:
  - Crea, elenca, scarica `.json`, carica snapshot direttamente in tabella.
  - Caricamento aggiorna `data`, `levels`, `parents`, `versInclude` e persistenza locale.
- Gestione:
  - `Codici Invito`: crea, attiva/disattiva, elimina codici.
  - `Utenti`: ruoli (user, admin), attiva/disattiva, elimina.
- Ricerca utenti con barra `Search` compatta su smartphone.
- PWA installabile (Android/iOS) con icone trasparenti.

## Ruoli e Accessi

- Autenticazione: Supabase Auth.
- Sicurezza: RLS su tabelle, policy per utenti autenticati.
- Azzeramento tabella (`Nuova Tabella`) agisce globalmente (su tutti gli utenti). Opzionale limitazione agli admin.

## Componenti e UI

- Sidebar: voci `Home`, `Impostazioni`, `Profilo`, `Codici Invito`, `Gestione Utenti`, `Archivio Tabelle`.
- Barra inferiore: centrata; toggle in un container dedicato quando espansa.
- Tabella:
  - Titoli sempre visibili su mobile/tablet.
  - Larghezze minime e `whitespace-nowrap` per evitare spezzature.
  - `overflow-x` con indicatori fade ai bordi per suggerire lo swipe.
- Modali:
  - Archivio Tabelle, Gestione Utenti, Codici Invito, Conferma Nuova Tabella.

## PWA e Icone

- Manifest: `public/manifest.webmanifest` con `display: standalone`, `theme_color` e icone PNG trasparenti `192x192`, `512x512` (`purpose: any maskable`).
- Apple Touch Icon: `index.html` con `apple-touch-icon` `180x180` puntato a asset trasparente.
- Consigliato: file dedicati `icon-180.png`, `icon-192.png`, `icon-512.png` con trasparenza per massima nitidezza.

## Database e Sicurezza

- Tabelle principali:
  - `calculations`: righe della tabella esiti (nome, negativo, cauzione, versamenti settimanali, disponibilità, livello, gerarchia, utente). 
  - `archives`: snapshot di tabella (`name`, `snapshot jsonb`, `created_at`).
  - `invite_codes`, `app_users`: gestione inviti e utenti.
- Migrazioni: file `supabase_schema.sql` include DDL e policy RLS per `public.archives`.
  - Esecuzione consigliata solo del blocco `archives` se il resto è già in produzione.

## Comandi Operativi

- Installazione dipendenze: `npm install`
- Sviluppo locale: `npm run dev`
- Esporre in rete locale: `npm run dev -- --host`
- Verifiche:
  - Lint: `npm run lint`
  - Typecheck: `npx tsc -b`
- Build: `npm run build`

## UX Mobile

- Header: icone-only per `Menu`, `Tema`, `Esci`; benvenuto nascosto su piccoli schermi.
- Search: dimensioni ridotte e padding compatto.
- Tabella: scorrimento orizzontale touch; fade ai bordi su mobile; titoli visibili.
- Bottom bar: centrata; bottone di chiusura in container suo sopra la barra quando espansa.

## Flusso Archivio

- Salva: snap attuale (`data`, `levels`, `parents`, `versInclude`) con nome.
- Carica: applica snap agli stati e persiste in `localStorage`.
- Scarica: esporta `.json` del singolo snapshot.
- Elimina: rimuove snapshot.

## Nuova Tabella

- Modal conferma: avvisa di salvare prima; richiede conferma esplicita.
- Azzeramento globale: cancella righe da `calculations` con filtro `WHERE` e resetta stati locali.

## Personalizzazioni

- Limitare “Nuova Tabella” agli admin con controllo ruolo.
- Aggiungere “Pubblica in DB” per rendere uno snapshot immediatamente visibile a tutti.
- Ulteriori ottimizzazioni di colonne su mobile (min-width, abbreviazioni).

## Troubleshooting

- Icona PWA sfocata: usare PNG trasparenti dedicati, verificare riferimenti in manifest e `index.html`.
- Errore `DELETE requires a WHERE clause`: usare filtro valido (es. `.not('id','is', null)`) o endpoint admin.
- Dati che scompaiono dopo “Carica Archivio”: fetch stabilizzato per non sovrascrivere snapshot.

## Consegna

- Contenuti:
  - Sorgente applicazione
  - PWA in `index.html` e `public/manifest.webmanifest`
  - Migrazione `archives` in `supabase_schema.sql`
  - Questo documento `docs/acquirente.md`
- Operativo: fornire accesso a Supabase (project url e chiavi) e alla repository.

