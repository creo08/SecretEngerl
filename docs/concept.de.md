# Konzept: SecretEngerl

Stand: November 2026. Die Varianten des Brauchs stehen in [variants.de.md](variants.de.md). Die Referenzfassung dieses Dokuments ist die englische in [`concept.en.md`](concept.en.md); diese deutsche Fassung wird mitgepflegt.

## Ziel

Eine Web-App für Engerl-Bengerl, Wichteln und Secret Santa, die alle Formen des Brauchs abdeckt, ohne Anleitung bedienbar ist und keine Daten an einen Server gibt. Sie läuft als statische PWA im Browser, offline-fähig, zuerst auf Deutsch, und ist Open Source unter MIT.

## Name und Sprache

Engerl-Bengerl ist der österreichische Name des Brauchs: Das Engerl beschenkt heimlich sein Bengerl. SecretEngerl ist Secret Santa auf Österreichisch, und daher kommt die App. In App, README und allen Beschreibungen gilt deshalb dieselbe Reihenfolge: Engerl-Bengerl zuerst, dann Wichteln, dann Secret Santa.

Deutsch ist die Hauptsprache. Weitere Sprachen sind alle, aus denen eine Form des Brauchs stammt: Englisch, Schwedisch, Spanisch, Portugiesisch, Niederländisch, Polnisch, Ukrainisch und zuletzt Filipino. Sie kommen erst dazu, wenn die deutsche Fassung vollständig funktioniert, und zwar in dieser Reihenfolge. Jede Übersetzung ist in der App sichtbar als KI-Übersetzung gekennzeichnet, mit Einladung zur Korrektur.

Andere Sprachen behalten den Namen und erklären ihn beim ersten Auftreten, auf Englisch etwa „Engerl-Bengerl, the Austrian Secret Santa“. Jede Sprache nennt außerdem ihren eigenen Namen des Brauchs (Wichteln, amigo invisible, lootjes trekken, Monito-Monita …). Die Rollen heißen in allen Sprachen Engerl und Bengerl. Die App startet in der Sprache des Browsers, sofern sie schon übersetzt ist, und fällt sonst auf Deutsch zurück.

Im Repository ist es umgekehrt: Englisch zuerst, weil fast alle Deutschsprachigen Englisch lesen, aber kaum jemand umgekehrt. `README.md`, `CHANGELOG.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, Code, Kommentare, Commits, Issues und PR-Texte sind englisch. Die Doku liegt in `docs/`: Dateien auf `.en.md` sind die Referenz, Dateien auf `.de.md` die gepflegte deutsche Fassung, dazu `README.de.md`. Bei Widersprüchen gilt die englische Fassung, die deutsche wird im selben Commit nachgezogen. Den Changelog gibt es nur auf Englisch.

## Datenschutz

Datenschutz hat Vorrang vor allen anderen Zielen. Vier Kriterien gelten für jede Funktion:

1. Keine Daten auf einem Server.
2. Die Auslosung ist nicht im Klartext sichtbar.
3. Die Auslosung ist technisch nicht ganz einfach zu entschlüsseln.
4. Weitergegeben wird nur das Nötigste.

Das Bedrohungsmodell ist bewusst bescheiden. Die App schützt das Los vor einem passiven Hoster, vor Server-Logs, vor Link-Vorschauen im Messenger und vor versehentlichem Mitlesen. Wer in der Runde absichtlich den Link zerlegt, um zu spicken, kann das. Dagegen schützt keine App, und es soll auch keine Bedienung dafür geopfert werden. Verteilt wird in der Praxis fast immer über WhatsApp oder Signal.

„Ende zu Ende“ heißt hier: Das Los wird auf dem Gerät der organisierenden Person verschlüsselt und erst auf dem Gerät der beschenkenden Person entschlüsselt; der Hoster sieht es nie. Der Schlüssel reist im Link mit, deshalb gehört jeder Link in einen privaten Einzelchat.

Das Bedrohungsmodell hat diese Grenzen, und das README nennt sie:

- Wer ändern kann, was GitHub Pages ausliefert (gehacktes Konto, manipulierte Build-Kette), kann Lose beim Öffnen mitlesen. Das gilt für jede Web-App. Das öffentliche Repository und die Attestierung des Releases zeigen, was ausgeliefert wird.
- Der GCM-Tag erkennt veränderte Links. Er beweist nicht, dass ein Link von der organisierenden Person stammt: Jede Person kann mit einem eigenen Schlüssel einen gültigen Link bauen. Die Ziehungsnummer im Los macht ein vorgetäuschtes Los in der Gruppe auffällig.
- Das Gerät der organisierenden Person enthält die Zuordnung (siehe Ablage).
- Bevor die App ihn aus der Adresszeile entfernt, kann ein Link im Browserverlauf, in der Browser-Synchronisierung, im In-App-Browser eines Messengers oder im Zwischenablage-Verlauf landen.
- Das Ablaufdatum setzt die App durch, nicht die Kryptografie. Wer einen Link von Hand entschlüsselt, ignoriert es.
- Alle GitHub-Pages-Seiten eines Kontos teilen sich einen Ursprung (`https://creo08.github.io`) und damit den Browserspeicher. Auf diesem Konto darf kein weiteres Pages-Projekt laufen, das nicht genauso gepflegt wird, und es darf nie ein Repository `creo08.github.io` geben, weil dessen Service Worker den ganzen Ursprung steuern könnte.

Mehrparteien-Protokolle ohne Vertrauensperson (Mixnet, Zero-Knowledge) sind verworfen. Sie würden die organisierende Person aus dem Vertrauen nehmen, kosten aber mehrere Runden Hin und Her zwischen allen Teilnehmenden.

## Bestehende Lösungen

Stand der Sichtung: November 2026. Geprüft wurden Webdienste und rund 25 öffentliche Repositories.

Bei Webdiensten ist „ohne Anmeldung“ längst Standard. Die Daten liegen trotzdem fast überall beim Anbieter; bei Elfster etwa können Organisator:innen alle Ziehungen einsehen. Serverlose Open-Source-Generatoren gibt es viele. Ihre „verschlüsselten Links“ sind meist Base64 oder nutzen einen Schlüssel, der fest im Quellcode steht, und als Zufallsquelle dient meist `Math.random`.

| Projekt | Serverlos | Los geschützt | Brauchbar als |
|---|---|---|---|
| [s3eidat/secret-santa](https://github.com/s3eidat/secret-santa) (MIT) | ja | nur Handy herumreichen und Zettel | UX-Vorbild: erklärt unlösbare Regeln, Faltzettel, strikte CSP |
| [BrianMitchL/gift-exchange](https://github.com/BrianMitchL/gift-exchange) (ISC) | ja | nicht zutreffend (Bibliothek) | Referenz für gleichverteilte Ziehung mit Gruppen und Ausschlüssen |
| [dustball/cipher.ink](https://github.com/dustball/cipher.ink) (AGPL-3.0) | nein | AES-256-GCM, Schlüssel im Fragment | Vorbild für Bedrohungsmodell, SHA256SUMS, CSP; Code nicht übernehmbar |
| [arcanis/secretsanta](https://github.com/arcanis/secretsanta) (MIT) | ja | Schlüssel fest im Code | UX-Vorbild; Ziehung verzerrt |
| [eddmann/secret-santa-pwa](https://github.com/eddmann/secret-santa-pwa) | ja | Passwort als Build-Konstante | keine Lizenz |
| [rafa-coelho/amigo-secreto](https://github.com/rafa-coelho/amigo-secreto) | ja | nur Base64 | keine Lizenz |
| [NikPerne/secret-santa](https://github.com/NikPerne/secret-santa) (Apache-2.0) | nein | Konten, Datenbank | Funktionsliste |
| [EmCousin/secretsanta](https://github.com/EmCousin/secretsanta) | ja | laut README nur kodiert | ehrliche Datenschutz-Doku |

cipher.ink verletzt Kriterium 1, weil Öffnungszähler, Wunschlisten, anonyme Threads und Löschfristen eine Datenbank brauchen. Alle diese Funktionen sind für eine Wichtelrunde verzichtbar. Die AGPL-3.0 verhindert außerdem, Code in ein MIT-Projekt zu übernehmen. Die App wird deshalb neu geschrieben und übernimmt nur Ideen.

## Architektur

Die App ist eine statische Seite auf einem statischen Host (GitHub Pages). Es gibt kein Backend, keine Konten, keine Analytics, keine Fremd-Fonts und kein CDN. Alles läuft im Browser.

Sie besteht aus fünf Teilen:

- Die Zuordnungs-Engine `losfee` ist eine reine TypeScript-Bibliothek ohne Bezug zur Oberfläche. Sie läuft in einem Web Worker.
- Das Konfigurationsmodell bildet die Kategorien A bis K ab; Vorlagen sind gespeicherte Konfigurationen.
- Die Verteilung erzeugt verschlüsselte Links und gibt sie über das Teilen-Menü weiter.
- Die lokale Ablage hält die Runde auf dem Gerät der organisierenden Person.
- Das Partyspiel-Modul ist Spielleitung auf einem Gerät.

## Ablauf einer Standardrunde

Beispiel: 10 Personen, Übergabe am Familienabend.

### 1. Einrichten

Die organisierende Person wählt die Vorlage „Engerl-Bengerl klassisch“ und gibt die Namen ein, einen pro Zeile. Eine Leerzeile trennt Gruppen, etwa Haushalt, Paar, Familie oder Team; wer in derselben Gruppe ist, zieht sich nicht. Dazu kommen Budget und Übergabetag. Optional sind Ort, Motto, ein Hinweis pro Person (Wünsche, No-Gos), die Art der Auflösung und die Angabe, ob die organisierende Person mitspielt. Der Hinweis ist Freitext; darunter sagt die App, dass nur hineingehört, was das Engerl wissen muss, und dass keine Diagnosen nötig sind („keine Nüsse“ reicht).

Gruppen heißen nach ihren Mitgliedern: „Gruppe Anna und Bernd“, bei größeren „Gruppe Anna, Bernd und 2 weitere“. Mitspielen können bis zu 50 Personen.

Telefonnummern, E-Mail-Adressen, Postadressen und Nachnamen fragt die App nie ab. Die einzige Ausnahme ist die Postadresse beim Post-Wichteln, und auch die steht nur im Los des jeweiligen Engerls.

### 2. Ziehen

Standardmäßig gilt „Keine Gegenseitigkeit“: Zwei Personen beschenken sich nie gegenseitig. Die App prüft vorab, ob die Regeln lösbar sind, und nennt sonst den Grund, etwa „Anna, Bernd und Clara dürfen zusammen nur zwei Personen beschenken“. Ein Tipp auf „Ziehen“ erzeugt die Zuordnung lokal und verschlüsselt pro Person einen Link. Angezeigt wird nichts.

### 3. Verteilen

Die App zeigt eine Liste mit „Anna: Senden“, „Bernd: Senden“ und so weiter. Ein Tipp öffnet das Teilen-Menü des Geräts. Dort wählt man Signal oder WhatsApp, den Einzelchat mit Anna, und sendet. Danach bekommt Anna ein Häkchen.

Anna erhält genau das:

```
Dein Engerl-Bengerl-Los 🎁
Nur für dich, bitte nicht weiterleiten.
https://creo08.github.io/SecretEngerl/#1.k3Fq…Zp.Qm9x…7aB
```

Verschlüsselt im Link stehen der Name ihres Bengerls, Budget, Termin, falls gesetzt Motto und Hinweis, die Vorlage, die Nummer der Ziehung und das Ablaufdatum. Nicht im Link stehen Annas eigener Name, die Liste der Teilnehmenden und wer sonst wen gezogen hat. Die Link-Vorschau im Chat ist für alle Lose gleich, und der Hoster sieht nur einen Seitenaufruf mit IP-Adresse.

### 4. Öffnen

Anna tippt auf den Link. Die App entfernt das Los sofort aus der Adresszeile und zeigt „Antippen zum Aufdecken“. Danach steht da: „Du bist das Engerl von Bernd“, mit Budget, Termin und Hinweis. Ansehen kann sie es jederzeit wieder, über den Link im Chat.

Optional legt „In den Kalender“ eine lokal erzeugte `.ics`-Datei mit dem Titel „Engerl-Bengerl Übergabe“ an. Bernds Name steht nicht darin, weil Kalender in die Cloud synchronisieren.

### 5. Während der Runde

Hat jemand den Link verloren, tippt die organisierende Person „Erneut senden“ und sieht dabei nichts.

Sagt jemand ab, ändert „Person entfernen“ nur das Nötigste: Das Engerl der ausgefallenen Person übernimmt deren Bengerl. Genau eine Person bekommt einen neuen Link. Die organisierende Person erfährt, wer neu beliefert wird, aber nicht, an wen.

Diese Reparatur kann eine Regel brechen: Das neue Paar kann im selben Haushalt sein, ausgeschlossen sein, das Vorjahr wiederholen oder eine Muss-Regel verletzen, und war die ausgefallene Person in einem Dreierkreis, beschenken sich danach zwei gegenseitig. Dann sagt die App: „Die Regeln gelten danach nicht mehr vollständig. Garantiert sind sie nur mit einer neuen Ziehung.“ und bietet „Trotzdem so“ und „Neu ziehen“ an. Haben sich die ausgefallene Person und ihr Engerl gegenseitig beschenkt (nur möglich, wenn Gegenseitigkeit erlaubt ist), würde das Engerl sich selbst ziehen; dann gibt es nur „Neu ziehen“.

Für echte Notfälle gibt es „Zuordnung ansehen“ (siehe Ablage).

### 6. Übergabe und Auflösung

| Variante | Ablauf | App nötig |
|---|---|---|
| Persönlich | Das Engerl überreicht selbst und ist damit aufgelöst | nein |
| Raten | Geschenke mit dem Namen des Bengerls auf den Tisch; alle raten ihr Engerl, dann wird reihum aufgelöst | nein |
| Kette | Eine Person überreicht, die Beschenkte macht weiter; schließt sich ein Kreis, beginnt die nächste offene Person | nein |
| Bühne | Am Gerät der organisierenden Person „Auflösung starten“, Paar für Paar | ja, Runde gespeichert |
| Nie | Bleibt geheim | nein |

### 7. Danach

Am Übergabetag plus 14 Tage löscht die App die Runde, und alte Links zeigen „Runde abgelaufen“. Mit „Fürs nächste Jahr merken“ bleiben Namen, Haushalte und Paarungen erhalten, damit im Folgejahr niemand dieselbe Person zieht.

## Link-Format

```
https://creo08.github.io/SecretEngerl/#1.<schlüssel>.<chiffrat>

1         Formatversion, als Additional Authenticated Data mitgeprüft
schlüssel 128 Bit Zufall, base64url
chiffrat  IV (12 Byte Zufall) ‖ AES-GCM-Ciphertext ‖ Tag (16 Byte), base64url
```

Jeder Link hat einen eigenen Schlüssel, ein IV wird also nie unter demselben Schlüssel wiederverwendet.

Klartext vor der Verschlüsselung ist kompaktes JSON in UTF-8:

```json
{"r":"Bernd","b":"20 €","m":"","d":"2026-12-20","h":"","t":"engerl-bengerl","n":1,"x":1799020799}
```

`r` ist das Bengerl, `b` das Budget, `m` das Motto, `d` der Übergabetag, `h` der Hinweis, `t` die Vorlage aus der festen Liste (die App zeigt die Regel der Vorlage aus der Sprachdatei, beim Schrottwichteln „Nichts kaufen, nur was du schon hast“), `n` die Nummer der Ziehung und `x` das Ablaufdatum als Unix-Zeitstempel: das Ende des Tages 14 Tage nach dem Übergabetag, in UTC (hier 2027-01-03T23:59:59Z). Der Klartext wird mit `0x00`-Bytes auf genau 256 Byte aufgefüllt, damit alle Links aller Runden gleich lang sind. Beim Entschlüsseln werden die `0x00` am Ende entfernt; ein `0x00` im JSON ist ein Fehler. Passt ein Los nicht in 256 Byte, lässt die App das Ziehen nicht zu und zeigt beim Hinweis an, wie viele Zeichen noch frei sind.

Das Fragment hinter `#` schicken Browser nicht an Server ([RFC 3986](https://www.rfc-editor.org/info/rfc3986/)), und es fehlt auch im Referer-Header. Messenger erzeugen Vorschauen über einen gewöhnlichen HTTP-Abruf, der ebenfalls kein Fragment enthält.

Schlüssel und Chiffrat im selben Link schützen nicht vor jemandem, der den Link hat und entschlossen ist. Gegenüber Base64 hat AES-GCM trotzdem drei Vorteile. Ein Online-Decoder, eine Messenger-KI oder ein Link-Scanner kann das Los nicht nebenbei lesen; dafür muss jemand bewusst die App öffnen, und genau diesen Unterschied deckt das Bedrohungsmodell ab. Der GCM-Tag erkennt veränderte Links, etwa einen ausgetauschten Namen; er erschwert das Schummeln, beweist aber nicht, wer einen Link gebaut hat. Und WebCrypto ist eingebaut, der Mehraufwand liegt bei rund 20 Zeilen.

Was bleibt: Der vollständige Link liegt im Chatverlauf und in Chat-Backups. WhatsApp-Backups auf Google Drive oder iCloud sind nur dann Ende-zu-Ende-verschlüsselt, wenn man das selbst einschaltet. Das Ablaufdatum macht alte Links für Gelegenheitsleser nutzlos.

Das Ablaufdatum muss im Chiffrat stehen. Im Klartext verriete es jedem, der den Link sieht, ungefähr den Übergabetag, und die Links sähen nicht mehr alle gleich aus. Die App entschlüsselt deshalb, prüft `x` und zeigt danach nur „Runde abgelaufen“, nie den Inhalt. Wer von Hand entschlüsselt, kann ihn trotzdem lesen; das ist der Preis eines Links ohne Server.

Beim Öffnen liest die App das Fragment in eine Variable und ruft sofort `history.replaceState` auf. Erst nach dem Antippen entschlüsselt sie und zeigt das Ergebnis per `textContent` an. Beim Empfangen speichert die App nichts.

## Verteilen

Verteilt wird über die [Web Share API](https://web-platform-dx.github.io/web-features-explorer/features/share). Ein Tipp auf „Senden“ übergibt Text und Link an das Teilen-Menü des Betriebssystems, ohne Netzwerkanfrage und ohne Berechtigungsabfrage. Die App kann weder einen Kontakt vorwählen noch erfährt sie, wohin geteilt wurde; das Häkchen heißt nur „Ziel gewählt“.

Unterstützt wird das von Safari auf iOS und macOS, Chrome und Firefox auf Android, Edge und Chrome am Desktop unter Windows und ChromeOS und ab Version 128 unter macOS. Firefox am Desktop und Chrome unter Linux können es nicht, dort kopiert die App den Link in die Zwischenablage. Ob es geht, erkennt die App per `navigator.canShare`, nicht am Namen des Browsers. Ob WhatsApp und Signal Text und Link getrennt übernehmen, muss auf iOS und Android getestet werden; notfalls steht der Link im Text.

Die App zeigt Links nie als Liste an, und es gibt kein „Alle kopieren“. Direktlinks wie `wa.me/?text=…` sind ausgeschlossen, weil der Link samt Schlüssel dabei im Query-String an Metas Server ginge. Beim ersten Verteilen erscheint ein kurzer Hinweis: jeden Link im Einzelchat schicken, nicht in die Gruppe.

## Ablage, Notfall und Sicherung

Im Standard behält die App die Runde auf dem Gerät der organisierenden Person, in IndexedDB, und bittet den Browser um dauerhaften Speicher. Gespeichert werden der versendete Link pro Person und was „Erneut senden“, eine Neuziehung und eine Absage brauchen: Namen, Haushalte, Regeln, Termine, das Notfall-Protokoll und die optionale PIN. Eine Zuordnungstabelle im Klartext gibt es nicht; die Zuordnung liegt auf dem Gerät nur in den Links, die ohnehin verschickt wurden, und eine Absage entschlüsselt sie nur im Speicher. Damit funktioniert „Erneut senden“. Weil jeder Link seinen Schlüssel enthält, kann aber jede Person mit dem Gerät und den Entwicklerwerkzeugen die ganze Zuordnung lesen. Datenbank- und Cache-Namen beginnen mit `secretengerl-`. Am Übergabetag plus 14 Tage löscht sich die Runde selbst, „Runde jetzt löschen“ geht jederzeit.

Unter „Notfall“ gibt es „Zuordnung ansehen“. Die App zeigt immer nur eine Person auf einmal („Wen beschenkt Anna?“), nie die ganze Liste. Vorher bestätigt man mit den zwei Wörtern „Ich spicke“ oder hält den Knopf zwei Sekunden lang gedrückt. Eine PIN ist optional, falls auch andere das Gerät benutzen. Jedes Ansehen hinterlässt den Eintrag „Zuordnung von Anna angesehen am …“, der in der App bis zum Ende der Runde nicht löschbar ist. Die Hürde soll spürbar sein und setzt auf Fairness: PIN und Protokoll sind Hürden in der App, keine Verschlüsselung, und wer die Website-Daten löscht, entfernt beide. Die Doku sagt das. Die App erwartet hier Eigenverantwortung.

„Versiegeln und vergessen“ ist eine ausdrückliche Wahl beim Verteilen. Danach liegt nichts mehr auf dem Gerät, und die App warnt vorher: Verlorene Links lassen sich nur durch eine Neuziehung ersetzen.

Eine Sicherungsdatei lässt sich exportieren, etwa für einen Gerätewechsel oder eine zweite organisierende Person. Der Dateiname ist neutral, z. B. `runde-2026-12.wichtel`. Ein Passwort ist optional. Ohne Passwort ist die Datei Klartext-JSON mit demselben Schutz wie die Ablage auf dem Gerät, und die App sagt das vor dem Speichern. Mit Passwort wird sie zusätzlich verschlüsselt, was sich lohnt, wenn sie per Mail oder Cloud weitergeht: PBKDF2-HMAC-SHA256 mit 600 000 Iterationen und 16 Byte Zufalls-Salt leitet einen AES-256-GCM-Schlüssel ab, das IV sind 96 Bit Zufall, und ein versionierter Header (Format, Version, Salt, Iterationen) wird als Additional Authenticated Data mitgeprüft. Die Sicherungsdatei kommt in Phase 6, zusammen mit der Jahresdatei.

## Zufall und Ziehung

Zufallsquelle ist ausschließlich `crypto.getRandomValues`, nie `Math.random`. Es gibt keinen Seed, eine Ziehung lässt sich also nicht aus den Namen nachrechnen. Aus derselben Quelle kommen Schlüssel und IV.

Ganzzahlen werden ohne Modulo-Bias gezogen: Werte oberhalb des letzten vollen Vielfachen werden verworfen. Darauf baut ein Fisher-Yates-Shuffle auf. Größere Zahlen, bis etwa 50! ≈ 3·10^64 für die gewichtete Auswahl unten, setzt die App aus so vielen 32-Bit-Wörtern wie nötig zu einem `BigInt` zusammen, mit demselben Verwerfen.

```ts
function randInt(n: number): number {
  const lim = Math.floor(2 ** 32 / n) * n;
  const b = new Uint32Array(1);
  do crypto.getRandomValues(b); while (b[0] >= lim);
  return b[0] % n;
}
```

Jede gültige Ziehung muss exakt gleich wahrscheinlich sein. Eine Zuweisung Person für Person mit Rücksprung bei Sackgassen wäre schneller, verzerrt aber die Wahrscheinlichkeiten. Alle Lösungen aufzuzählen geht nur bei kleinen Gruppen: Schon 20 Personen haben rund 9·10^17 Derangements. Die Engine arbeitet für bis zu 50 Personen so:

1. Feste Muss-Regeln („Anna beschenkt Bernd“) werden zuerst gesetzt und aus dem Problem entfernt. Die übrigen Regeln teilen sich in Haushalte (niemand beschenkt sich selbst oder jemanden aus dem eigenen Haushalt; eine Einzelperson ist ein Haushalt der Größe 1) und Zusatzregeln: gerichtete und beidseitige Ausschlüsse, Vorjahrespaarungen, Muss-Regeln mit Auswahl, „Keine Gegenseitigkeit“ und „Eine große Kette“.
2. Machbarkeit: ein bipartites Matching (Hopcroft-Karp) über alle Regeln, die sich als Matrix „wer darf wen“ schreiben lassen. Gibt es keins, liefert das Argument von König und Hall die zu kleine Gruppe, und die App nennt sie in Worten. Danach prüft eine begrenzte Tiefensuche über alle Regeln, ob es überhaupt eine gültige Ziehung gibt, damit unmögliche Regeln sofort benannt werden: „Mit diesen Regeln gibt es keine gültige Ziehung“, mit „Eine große Kette“ „Mit diesen Regeln gibt es keine große Kette“. Ihr Ergebnis wird verworfen und beeinflusst die Ziehung nicht.
3. Standardziehung: zuerst exakt gleichverteilt aus allen Zuordnungen ziehen, die die Haushalte einhalten. Die verbotenen Felder der Haushalte sind Rechtecke, die sich weder Zeilen noch Spalten teilen; ihre Zahl ist Σ (−1)^k · r_k · (m−k)!, wobei r das Produkt der Rook-Polynome der Rechtecke ist (für ein a×b-Rechteck r_k = C(a,k) · C(b,k) · k!). Die Engine wählt eine schenkende Person nach der anderen, gewichtet mit der Zahl der Vervollständigungen; nach jedem Schritt bleiben die verbotenen Felder Rechtecke. Empfangende, die dieselbe Restform hinterlassen, bilden eine Klasse, und in der Klasse wird gleichverteilt gewählt. Alle Zahlen sind exakte `BigInt`. Verletzt das Ergebnis eine Zusatzregel, wird verworfen und neu gezogen. Damit ist jede gültige Ziehung exakt gleich wahrscheinlich.
4. Mit „Eine große Kette“ legt die Engine alle Personen in zufälliger Reihenfolge in einen Kreis (Fisher-Yates) und verwirft bei jedem Regelverstoß. Das ist exakt gleichverteilt über alle gültigen Ketten.
5. Budget: höchstens 1 000 000 Versuche oder 2 Sekunden. Reicht das nicht, gibt es keine faire Ziehung: Die App nennt die Zusatzregel, die am häufigsten verletzt war, und schlägt vor, sie zu lockern. Eine verzerrte Ziehung als Ausweg gibt es nie. Hat die Suche aus Schritt 2 eine gültige Ziehung gefunden oder ihre eigene Grenze erreicht, sagt die App „Die Regeln sind für eine faire Ziehung zu streng“.

Für eine Runde mit 10 Personen und drei Paaren ist die Haushaltszahl sofort berechnet, und typische Runden mit 50 Personen brauchen einige bis einige Dutzend Versuche.

Zahlen für 10 Personen mit drei Paaren als Haushalten und vier Einzelpersonen, durch vollständige Aufzählung aller 3 628 800 Permutationen. „Aus dem Hut ziehen“ heißt: eine gleichverteilt zufällige Permutation aller Namen. Die Vorjahreszahlen setzen voraus, dass auch das Vorjahr eine zufällige gültige Ziehung derselben Art war; sie schwanken leicht mit der tatsächlichen Vorjahresziehung.

| Größe | nur Haushalte | Standard: Haushalte und keine Gegenseitigkeit |
|---|---|---|
| Gültige Ziehungen | 672 240 | 392 160 |
| Davon eine einzige große Kette | 26,1 % | 44,8 % |
| Mit mindestens einem Paar, das sich gegenseitig beschenkt | 41,7 % | 0 % |
| Gültig, wenn man aus dem Hut zieht | 18,5 % | 10,8 % |
| Versuche beim Mischen aller Personen (zum Vergleich) | rund 5 | rund 9, mit „Eine große Kette“ rund 21 |
| Zwei identische Ziehungen | 1 : 672 240 | 1 : 392 160 |
| Mindestens eine Paarung wie im Vorjahr | rund 70 %, im Schnitt 1,2 Paarungen | rund 70 %, im Schnitt 1,2 Paarungen |
| Gültige Ziehungen mit „Nicht wie letztes Jahr“ | rund 203 000 | rund 119 000 |

„Keine Gegenseitigkeit“ ist Standard in allen Vorlagen. Paarungen, bei denen sich zwei gegenseitig beschenken, empfinden viele als Fehler, und es bleiben genug Lösungen. Als Nebeneffekt steigt der Anteil durchgehender Ketten von einem Viertel auf fast die Hälfte. „Eine große Kette“ braucht es nur für die Kettenauflösung. „Nicht wie letztes Jahr“ gehört in die Familien-Vorlage; bis die Jahresdatei in Phase 6 kommt, werden die Vorjahrespaarungen von Hand eingetragen.

Gleich wahrscheinliche Ziehungen heißen nicht gleich wahrscheinliche Personen. Im Beispiel zieht Anna ein Mitglied eines anderen Paares mit je 13,4 % und eine Einzelperson mit je 11,6 %, in beiden Spalten. Das folgt aus den Haushaltsregeln und ist kein Fehler; die Tests dokumentieren es.

Neu ziehen ist eine bewusste Aktion mit Rückfrage, und die Nummer der Ziehung steht im Los. Ein serverloses Los lässt sich nicht widerrufen, alte Links öffnen sich also weiter. Nach einer Neuziehung bekommen deshalb alle den Hinweis, dass nur die neue Ziehung gilt.

Die Engine bekommt den Zufallsgenerator von außen. Tests nutzen einen festen Generator für die Logik. Für die Gleichverteilung zählen sie alle gültigen Lösungen kleiner Fälle (4 bis 7 Personen) per Brute Force, ziehen mindestens 50-mal so oft, wie es Lösungen gibt, und prüfen per Chi-Quadrat auf dem Niveau 0,001. Die Haushaltszahl wird bis 10 Personen gegen Brute Force geprüft, und ein Leistungstest zieht 200 zufällige Runden mit 50 Personen. Im Betrieb läuft nur `crypto.getRandomValues`.

## Daten aus dem Vorjahr

Der Hauptweg ist eine Jahresdatei (Phase 6; bis dahin werden Paarungen von Hand eingetragen). Beim Abschluss einer Runde speichert „Fürs nächste Jahr merken“ eine Datei wie `engerl-2026.wichtel` mit Namen, Haushalten und Paarungen, ohne Budget und ohne Hinweise. Das Passwort ist optional und verschlüsselt die Datei wie die Sicherungsdatei, der Ablageort ist frei. Im nächsten Jahr startet „Runde aus Datei starten“ mit dieser Vorbelegung und schließt die Paarungen aus.

Auf demselben Gerät merkt sich die App die Runde zusätzlich, verlässlich ist das aber nicht. Safari löscht Daten einer Website nach sieben Tagen ohne Besuch, wenn sie nicht zum Home-Bildschirm hinzugefügt wurde; dazu kommen Gerätewechsel und gelöschter Verlauf. Die Datei wird deshalb immer angeboten.

Wurde im Vorjahr per Zettel gezogen und öffentlich aufgelöst, lassen sich die Paarungen auch von Hand eintragen.

Die App zeigt Vorjahrespaarungen nie an, nur „10 Paarungen aus 2026 werden ausgeschlossen“. Ansehen geht nur über „Ich spicke“. Beim Import zeigt sie fehlende und neue Namen, und man ordnet sie einander zu. Verschleiern lässt sich die Datei nicht sinnvoll: Bei 10 Namen gibt es nur 90 mögliche Paare, Hashes wären sofort durchprobiert.

## Vorbelegungs-Link

Ein Link kann eine neue Runde vorbelegen, ebenfalls im Fragment:

```
https://creo08.github.io/SecretEngerl/neu#v=1&f=engerl-bengerl&n=Anna,Bernd;Clara,David;Eva&b=20&d=2026-12-20
```

`f` ist die Vorlage, `n` die Namen mit `,` innerhalb und `;` zwischen Haushalten, `b` das Budget und `d` der Übergabetag. Die App füllt damit den Wizard aus und zeigt eine Bestätigungsseite; gezogen wird erst nach einem Tipp der organisierenden Person. So kann jemand eine fertige Einladung zum Einrichten weitergeben, und ein KI-Assistent, den man um „mach Engerl-Bengerl für Anna, Bernd und Clara“ bittet, kann direkt einen passenden Link bauen. Die Namen gehen dabei nicht an den Hoster, Namen, die man einem KI-Assistenten nennt, aber an dessen Anbieter.

Der Link ist nicht vertrauenswürdige Eingabe. Version 1 akzeptiert: `f` nur aus der Liste der Vorlagen; höchstens 50 Namen mit je 1 bis 40 Zeichen nach NFC-Normalisierung, ohne Steuer- und Bidi-Zeichen (Unicode Cc und Cf), Leerraum getrimmt, keine Dubletten; `b` als Dezimalzahl von 0 bis 9999; `d` als ISO-Datum. Unbekannte Schlüssel werden ignoriert. Fehler zeigen eine freundliche Meldung, nie einen Stacktrace. Der Vorbelegungs-Link kommt in Phase 5.

## Doku in der App

Alle Erklärungen sind in der App erreichbar, nicht nur im Repository: „So funktioniert's“, eine Seite pro Form des Brauchs, Datenschutz und Bedrohungsmodell, FAQ und die statische Datenschutzseite `/datenschutz/`. Sie sagt, dass die App nichts auf Servern speichert, dass GitHub beim Seitenaufruf IP-Adressen zu Sicherheitszwecken protokolliert und dass, was man in eine Runde einträgt, auf den Geräten der Beteiligten und in den Chats bleibt, über die die Links gehen. Als Kontakt verlinkt sie das GitHub-Konto `creo08` und die Issues. Quelle sind die Markdown-Dateien in `docs/*.de.md` für die deutsche App und `docs/*.en.md` für die englische. Der Build erzeugt daraus statische HTML-Seiten, die auch ohne JavaScript lesbar sind und offline aus dem Cache kommen. Jede Seite pro Form verlinkt direkt auf die passende Vorlage.

## Auffindbarkeit für Menschen und KI

Wer eine Suchmaschine oder einen KI-Assistenten nach „Engerl-Bengerl online auslosen“ oder „mach Engerl-Bengerl“ fragt, soll bei der App landen. Dafür gilt:

- Jede Seite ist statisch vorgerendert. Viele KI-Crawler führen kein JavaScript aus.
- Die App liegt unter `https://creo08.github.io/SecretEngerl/`. Der Basis-Pfad `/SecretEngerl/` steht an einer Stelle, damit ein Umzug auf eine andere GitHub-Pages-Adresse billig bleibt.
- Eigene Seiten pro Form und Sprache mit sprechender URL (`/SecretEngerl/engerl-bengerl/`, `/SecretEngerl/wichteln/`, `/SecretEngerl/schrottwichteln/`, `/SecretEngerl/en/secret-santa/` …), sauberem Titel, `hreflang` und `canonical`.
- `llms.txt` unter `/SecretEngerl/llms.txt` nach dem Vorschlag von [llmstxt.org](https://llmstxt.org/), der einen Unterpfad erlaubt: was die App tut, die Formen mit Links, das Format des Vorbelegungs-Links und der Hinweis, dass Namen, die man einem Assistenten nennt, bei dessen Anbieter landen.
- Strukturierte Daten als JSON-LD (`WebApplication`, `HowTo` pro Form) und eine `sitemap.xml` unter `/SecretEngerl/`. Eine `robots.txt` wirkt nur im Wurzelverzeichnis des Hosts; ohne Datei dort gilt alles als erlaubt. Die Sitemap wird bei den Suchmaschinen von Hand eingereicht. Die Lose sind davon nicht betroffen, weil sie nur im Fragment stehen.
- Im Repository erklärt `AGENTS.md` Aufbau, Module und Konventionen für KI-Werkzeuge, die am Code arbeiten. Code und Kommentare sind auf Englisch, mit klaren Namen, kleinen Modulen und TSDoc an jeder öffentlichen Funktion.

## Partyspiele

Das Partyspiel-Modul läuft auf einem Gerät am Tisch, offline und ohne Links. Es bietet Zugreihenfolge, digitalen Würfel mit änderbarer Regeltabelle, Timer und einen Klau-Zähler mit Sperre. Es kommt nach dem Zuordnungs-Wichteln.

## Härtung und Nachprüfbarkeit

- Content Security Policy per Meta-Tag, weil GitHub Pages keine eigenen Header erlaubt: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; worker-src 'self'; base-uri 'none'; form-action 'none'`. Sie ist das erste Element im `<head>`. Kein Inline-Skript, keine Fremdquellen.
- Ein Meta-Tag kann `frame-ancestors` nicht durchsetzen; deshalb blendet die App Verteilen und Notfall aus, wenn sie in einem Frame läuft (`top !== self`).
- `<meta name="referrer" content="no-referrer">` und generische Open-Graph-Angaben ohne Namen.
- Der Service Worker cacht nur die statischen Dateien, nie ein Fragment, und kein Code im Service Worker liest `location.hash`. Eine neue Version wartet, bis man „Neue Version – neu laden“ antippt oder alle Tabs geschlossen sind; kein stilles `skipWaiting()`.
- Ausgeliefert werden nur Tags `v*`. Der Deploy-Workflow baut genau den getaggten Commit, erzeugt `SHA256SUMS` über die ausgelieferten Dateien und eine Artefakt-Attestierung, hängt beides an das GitHub-Release und deployt dasselbe Artefakt. Die ausgelieferte Seite entspricht damit immer einem Tag; `SHA256SUMS` lässt sich mit `sha256sum -c` prüfen, die Attestierung mit `gh attestation verify`.
- GitHub Actions sind auf Commit-SHAs gepinnt und laufen mit den geringsten nötigen Rechten.
- Das README beschreibt das Bedrohungsmodell in wenigen Zeilen und nennt die Grenzen offen (siehe Datenschutz).
- Datenschutzhinweis auf `/datenschutz/`: Die App speichert nichts auf Servern. GitHub protokolliert beim Seitenaufruf IP-Adressen zu Sicherheitszwecken; das Los ist darin nicht enthalten.

## Plan

| Phase | Inhalt | Abnahme |
|---|---|---|
| 1 | Konfigurationsmodell für die Kategorien A bis K, Vorlagen als JSON | Schema und Vorlagen validiert |
| 2 | Zuordnungs-Engine `losfee` mit Machbarkeitsprüfung, Erklärungen, Absage-Logik, Vorjahrespaarungen von Hand | Unit- und Property-Tests, Chi-Quadrat-Tests, 1 000 Zufallskonfigurationen stimmen mit Brute Force überein, Leistungstest mit 50 Personen |
| 3 | Link-Format, Öffnen, Verteilen, Ablage, Notfall | Rundlauf-Tests, alle Links gleich lang, Ablauf greift, manipulierte Links werden abgewiesen |
| 4 | Oberfläche auf Deutsch mit den Vorlagen „Engerl-Bengerl klassisch“, „Schrottwichteln“, „Familien-Wichteln“, „Büro-Wichteln“; Doku in der App; `/datenschutz/`; PWA | Runde einrichten in unter zwei Minuten ohne Hilfe, getestet mit Personen ohne Technikbezug; keine Anfragen außer an die eigene Herkunft |
| 5 | Auffindbarkeit: Seiten pro Form, `llms.txt`, JSON-LD, Sitemap, Vorbelegungs-Link | Seiten ohne JavaScript lesbar |
| 6 | Vorjahr (Jahresdatei), Sicherungsdatei, Auflösung „Bühne“, Advent und Adventskalender, „Post-Wichteln“ mit Adresse im Los | |
| 7 | Partyspiele | Spielbar auf einem Handy am Tisch |
| 8 | Weitere Sprachen in der Reihenfolge Englisch, Schwedisch, Spanisch, Portugiesisch, Niederländisch, Polnisch, Ukrainisch, Filipino; alle als KI-Übersetzung gekennzeichnet | Keine fest verdrahteten Texte im Code |
| 9 | Härtung, Barrierefreiheit, Release mit `SHA256SUMS` und Attestierung | Lighthouse 95 oder besser, externe Durchsicht der Kryptografie |

Die Phasen 1 bis 4 sind das MVP. Barrierefreiheit (WCAG 2.2 AA, komplette Bedienung per Tastatur und Screenreader, eine Alternative zum zwei Sekunden langen Druck) gilt ab Phase 4; Phase 9 prüft sie.

## Quellen

- [cipher.ink Secret Santa](https://cipher.ink/secret-santa) und [Repository](https://github.com/dustball/cipher.ink)
- [RFC 3986, Uniform Resource Identifier](https://www.rfc-editor.org/info/rfc3986/)
- [Referer, MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referer)
- [History.replaceState, MDN](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
- [Web Share, Web Features Explorer](https://web-platform-dx.github.io/web-features-explorer/features/share)
- [Link previews, WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/link-previews/)
- [What is GitHub Pages? Data collection, GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Elfster: Wer sieht die Ziehungen](https://help.elfster.com/en/articles/11500522-how-do-i-see-who-someone-or-everyone-drew)
- [AGPL-3.0 und MIT, FOSSA](https://fossa.com/resources/license-compliance-tools/license-compatibility-checker/agpl-3-0-vs-mit/)
- [gift-exchange README](https://unpkg.com/gift-exchange@4.0.3/README.md)
- [llms.txt, Vorschlag für KI-lesbare Website-Beschreibungen](https://llmstxt.org/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Content Security Policy Level 3, W3C](https://www.w3.org/TR/CSP3/)
