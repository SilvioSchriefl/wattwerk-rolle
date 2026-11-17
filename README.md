# Wattwerk Ride

Smart-Trainer-App für Wattwerk: steuert die Rolle per Bluetooth (FTMS/ERG), übernimmt Workouts per Link aus Wattwerk, speichert Workouts für Garmin (.fit) und Zwift (.zwo), lädt Fahrten zu Strava hoch und speichert sie als .fit für den Import in Garmin Connect.

App: https://silvioschriefl.github.io/wattwerk-rolle/

## Automatischer Strava-Upload einrichten

1. **Strava-App anlegen:** strava.com/settings/api
   - Application Name: Wattwerk Ride
   - Category: Training
   - Website: https://silvioschriefl.github.io/wattwerk-rolle/
   - Authorization Callback Domain: `silvioschriefl.github.io`
   - Danach Client-ID und Client-Secret notieren.
2. **Vermittler bei Cloudflare:** dash.cloudflare.com → Workers & Pages → Create → Worker
   - Name z. B. `wattwerk-strava`, Deploy, dann „Edit code“ und den Inhalt von `worker.js` einfügen, Deploy.
   - Settings → Variables and Secrets: `STRAVA_CLIENT_ID` (Text) und `STRAVA_CLIENT_SECRET` (Secret) anlegen.
3. **In der App:** Karte „Strava verbinden“ → Worker-Adresse (`https://wattwerk-strava.<name>.workers.dev`) und Client-ID eintragen → „Mit Strava verbinden“ → bei Strava „Autorisieren“.

Danach erscheint nach jeder Fahrt der Knopf „Zu Strava hochladen“.

## Vermittler aktualisieren

Wenn sich `worker.js` ändert, muss der Code bei Cloudflare neu eingefügt werden: dash.cloudflare.com → Workers & Pages → `wattwerk-strava` → „Edit code“ → alles durch den neuen Inhalt von `worker.js` ersetzen → Deploy. Die Variablen bleiben erhalten.

Stand November 2026: Der Vermittler verarbeitet die 64-Bit-IDs, die Strava ab 1. Juni 2027 für Aktivitäten und Athleten vergibt.
