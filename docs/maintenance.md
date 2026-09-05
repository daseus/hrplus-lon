# Så underhålls projektet

En enkel checklista för ändringar och nya versioner.

## Vid varje ändring

1. Arbeta i en separat branch och öppna en pull request.
2. Kontrollera att tester, typkontroll och reproducerbart bygge är gröna.
3. Kontrollera relevanta användarflöden i en preview innan merge.
4. Uppdatera version, ändringshistorik, README och `dist` tillsammans när en ny
   version publiceras.

## När en ny version publiceras

1. Kontrollera att `main` är uppdaterad och att testerna är gröna.
2. Skapa en signerad eller annoterad tagg `vX.Y.Z` och en GitHub Release.
3. Kontrollera att webbpubliceringen lyckas.
4. Kontrollera att GHCR har fått `latest`, versions- och commit-taggar.
5. Prova installationen från den publicerade artefakten.

## Återkommande kontroll

Det schemalagda GitHub-jobbet **Projektets hälsokontroll** kör test, typkontroll
och bygge varje vecka. GitHubs notifieringar kan användas för nya issues, pull
requests och diskussioner. Forks går att se under **Insights → Forks**.

## Kommunikation om nya versioner

En GitHub Release är den gemensamma, publika versionssignalen. Användare och
forkägare kan själva välja **Watch → Custom → Releases** för att få en
notifiering utan att prenumerera på varje diskussion. Forkar uppdateras inte
automatiskt; ägaren kan hämta en ny huvudversion genom **Sync fork**.
