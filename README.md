# CiccioSheets

Un'app per la gestione delle passeggiate di un cane, costruita con HTML statico, Tailwind CSS e Supabase.

## Configurazione Supabase

1. Crea un progetto su [Supabase](https://supabase.com/).
2. Esegui il contenuto di `schema.sql` nel SQL Editor di Supabase per creare le tabelle e le policy.
3. Abilita l'autenticazione via Email.
4. Copia `SUPABASE_URL` e `SUPABASE_ANON_KEY` dalle impostazioni del progetto.

## Sviluppo Locale

1. Apri i file HTML nel browser.
2. Per collegare Supabase, puoi:
   - Inserire URL e KEY in `js/init-supabase.js`.
   - Oppure salvarli nel `localStorage` del browser con le chiavi `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

## Deploy su Vercel

1. Collega il repository a Vercel.
2. Configura le Environment Variables (opzionale, se implementi un build step) o assicurati che i file puntino al URL corretto.
3. Poiché l'app è statica, funzionerà immediatamente.

## Struttura Pagine

- `index.html`: Calendario mensile (Pubblica).
- `report.html`: Statistiche generali (Pubblica).
- `timbratura.html`: Start/Stop passeggiata in tempo reale (Privata).
- `crud.html?date=YYYY-MM-DD`: Dettaglio e gestione turni del giorno (Privata).
- `login.html` / `register.html`: Autenticazione.
