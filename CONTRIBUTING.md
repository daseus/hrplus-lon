# Bidra till projektet

Bidrag är välkomna. För att ändringar ska vara lätta att granska, testa och
underhålla används följande arbetsflöde.

## Innan du börjar

- Öppna gärna ett issue för större ändringar så att behov och avgränsning kan
  stämmas av tidigt.
- Utgå från aktuell `main` och håll varje pull request fokuserad på ett tydligt
  problem.
- Lägg aldrig lönefiler, exporter eller andra personuppgifter i repositoryt.

## Kvalitetskontroller

Kör före en pull request:

```bash
node --test
npx -y -p typescript@5.9.2 tsc --noEmit -p tsconfig.json
node build.mjs
```

När källfiler ändras ska även den genererade `dist`-mappen uppdateras och
committas. Beskriv gärna vilka verkliga användarflöden som har provats manuellt.

## Så förs ändringar in

Ändringar går via pull request och automatiska kontroller innan de förs in i
`main`. Webbversionen, nya versioner och Docker-images byggs sedan härifrån.

Genom att bidra bekräftar du att du har rätt att lämna in ändringen och att den
får publiceras under [AGPL-3.0-or-later](LICENSE), på samma villkor som resten av
projektet.
