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

## Granskning och publicering

Ändringar går via pull request och automatiska kontroller innan de förs in i
`main`. Projektets officiella webbversion, releaser och container-images
publiceras därefter från detta repository av projektets förvaltare.

Genom att bidra bekräftar du att du har rätt att lämna in ändringen. Någon
uttrycklig programvarulicens har ännu inte fastställts för projektet; kontakta
förvaltaren om ditt bidrag förutsätter särskilda licensvillkor.

