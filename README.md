# Form

Lauf- und Krafttraining planen, erfassen und mit Claude auswerten. Form ist eine Web-App für den Home-Bildschirm des iPhones (PWA): kein App Store, kein Mac, keine Kosten.

## Auf dem iPhone installieren

1. In Safari die App öffnen: **https://misterunknovn.github.io/form/**
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Form startet danach im Vollbild und funktioniert auch offline.

## Was die App kann

- **Heute**: Wochenleiste, Wochenziel (km, Läufe, Kraft), die Einheiten des Tages mit Ablauf, Vergleich zu früheren Einheiten und passenden Hinweisen aus den Regeln des Plans.
- **Laufen**: Wochenumfang, Trainingskalender, Intensitätsverteilung, Schuhe, aktuelle Pace, Bestzeiten, Leistungsvorhersage (VDOT nach Daniels), Puls- und Pace-Zonen.
- **Kraft**: Sätze und bewegte Last je Muskelgruppe gegen die Ziele des Plans, Sätze pro Einheit, Bestleistungen.
- **Plan**: Gesamtplan Laufen und Kraft, Phasen, Einheiten im Detail, Regeln, Ernährung, Austausch mit Claude, Sicherung.
- **Erfassen** über das Plus: Lauf (manuell oder GPX/TCX-Datei), Rad, Krafteinheit mit Sätzen, Gewicht und RIR, Leistungstest.

## Mit Claude arbeiten

1. Plan → **Daten kopieren**: Form erstellt eine Zusammenfassung der letzten 6 Wochen, des Plans und deiner Frage.
2. Im Claude-Chat einfügen. Ändert Claude den Plan, kommt am Ende ein JSON-Block im Format `form-plan`.
3. Plan → **Antwort einfügen**: Form prüft den Plan, zeigt die Änderungen und übernimmt ihn. Der vorherige Plan bleibt im Plan-Verlauf und lässt sich wiederherstellen.

Der Startplan ist „Trainingsplan Halbmarathon 2027“ (Stand 17.11.2026). Die Wochen bis zum 5-km-Test am 9.1.2027 sind wörtlich übernommen. Ab dem 11.1. nennt der Plan nur Phasen, diese Wochen sind daraus abgeleitet und als solche markiert.

## Daten

Alle Daten liegen nur auf dem Gerät (IndexedDB). Unter Plan → Einstellungen lässt sich eine Sicherung als Datei exportieren und wieder einspielen. Alle Datenzugriffe laufen über `src/data/db.ts`, damit später ein Backend wie Supabase (Konten, Synchronisierung, Zugang sperren) dieselbe Schnittstelle bedienen kann.

## Entwicklung

```bash
npm install
npm run dev     # lokale Vorschau
npm test        # Tests
npm run build   # Produktions-Build nach dist/
```

Zum Testen mit festem Datum: `?heute=2026-11-19` an die URL hängen.

Jeder Push auf `main` baut die App und veröffentlicht sie über GitHub Pages (`.github/workflows/deploy.yml`).

## Aufbau

- `src/data/` – Datenmodell, Datenbank, Startplan
- `src/lib/` – Berechnungen (Datum, Pace, VDOT, Statistik, Plan, Claude-Export/Import, GPX/TCX)
- `src/components/` – Grundbausteine, Diagramme, Icons
- `src/screens/` – Heute, Laufen, Kraft, Plan, Eingabemasken, Einstellungen
