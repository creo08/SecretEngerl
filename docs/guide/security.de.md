# Datenschutz und Bedrohungsmodell

Datenschutz hat Vorrang vor allen anderen Zielen. Jede Funktion erfüllt vier Kriterien: keine Daten auf einem Server, die Auslosung ist nicht im Klartext sichtbar, sie ist technisch nicht ganz einfach zu entschlüsseln, und weitergegeben wird nur das Nötigste.

## Ende zu Ende

Das Los wird auf dem Gerät der organisierenden Person verschlüsselt und erst auf dem Gerät der beschenkenden Person entschlüsselt; der Hoster sieht es nie. Der Schlüssel reist im Link mit, deshalb gehört jeder Link in einen privaten Einzelchat.

## Was in einem Link steht

Jeder Link enthält ein verschlüsseltes Los: den Namen des Bengerls, Budget, Termin, falls gesetzt Motto und Hinweis, die Vorlage, die Nummer der Ziehung und das Ablaufdatum. Nicht darin stehen der eigene Name, die Liste der Teilnehmenden und wer sonst wen gezogen hat. Jedes Los wird auf dieselbe Länge aufgefüllt, damit alle Links gleich aussehen.

Verschlüsselt wird mit AES-GCM und einem eigenen 128-Bit-Schlüssel pro Link. Schlüssel und Chiffrat stehen hinter dem `#`. Diesen Teil schicken Browser nie an einen Server, und Messenger lassen ihn bei Link-Vorschauen weg.

## Wovor die App schützt

Die App schützt das Los vor einem passiven Hoster, vor Server-Logs, vor Link-Vorschauen im Messenger und vor versehentlichem Mitlesen. Wer in der Runde absichtlich einen Link zerlegt, um zu spicken, kann das. Dagegen schützt keine App, und dafür wird keine Bedienung geopfert.

## Grenzen

- Wer ändern kann, was GitHub Pages ausliefert (gehacktes Konto, manipulierte Build-Kette), kann Lose beim Öffnen mitlesen. Das gilt für jede Web-App. Das öffentliche Repository und die Attestierung des Releases zeigen, was ausgeliefert wird.
- Der GCM-Tag erkennt veränderte Links. Er beweist nicht, dass ein Link von der organisierenden Person stammt: Jede Person kann mit einem eigenen Schlüssel einen gültigen Link bauen. Die Ziehungsnummer im Los macht ein vorgetäuschtes Los in der Gruppe auffällig.
- Das Gerät der organisierenden Person enthält die Zuordnung. Die gespeicherten Links enthalten ihre Schlüssel; wer das Gerät und die Entwicklerwerkzeuge hat, kann lesen, wer wen gezogen hat.
- PIN und Protokoll des Notfalls sind Hürden in der App, keine Verschlüsselung. Wer die Website-Daten löscht, entfernt beide. Die App setzt hier auf Fairness.
- Bevor die App ihn aus der Adresszeile entfernt, kann ein Link im Browserverlauf, in der Browser-Synchronisierung, im In-App-Browser eines Messengers oder im Zwischenablage-Verlauf landen. Der vollständige Link bleibt außerdem im Chatverlauf und in Chat-Backups.
- Das Ablaufdatum setzt die App durch, nicht die Kryptografie. Wer einen Link von Hand entschlüsselt, ignoriert es.

## Zufall

Gezogen wird nur mit `crypto.getRandomValues`. Jede gültige Ziehung ist genau gleich wahrscheinlich, mit allen Regeln. Sind die Regeln für eine faire Ziehung zu streng, sagt die App das, statt unfair zu ziehen.

## Ein Problem melden

Sicherheitsprobleme bitte vertraulich über die [Sicherheitsmeldung auf GitHub](https://github.com/creo08/SecretEngerl/security/advisories/new) melden.
