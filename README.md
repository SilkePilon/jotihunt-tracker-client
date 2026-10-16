![GitHub License](https://img.shields.io/github/license/ScoutingScherpenzeel/jotihunt-tracker-client) 
![GitHub branch status](https://img.shields.io/github/checks-status/ScoutingScherpenzeel/jotihunt-tracker-client/main)
![GitHub Release](https://img.shields.io/github/v/release/ScoutingScherpenzeel/jotihunt-tracker-client)

---

<img width="978" height="618" alt="Jotihunt Tracker (1)" src="https://github.com/user-attachments/assets/bea945e9-306e-4c62-a486-073289eec721" />

# 🦊 Jotihunt Tracker - Client
Volg met gemak de locaties van vossenteams, hunts, hints en hunters tijdens de Jotihunt!
Met deze client-app heb je een overzichtelijke en gebruiksvriendelijke interface om de voortgang live te volgen en direct op de hoogte te blijven van alle ontwikkelingen.

> [!NOTE]
> Werkt het beste in combinatie met de [Jotihunt Tracker Server](https://github.com/ScoutingScherpenzeel/jotihunt-tracker-server).

## Features:
- Real-time locaties van hunters.
- Deelnemende groepen zichtbaar op kaart incl. deelgebieden.
- Registreren en tonen van hints op de kaart.
- Aanmaken van spots en hunt locaties.
- Automatische lijnen tussen locaties binnen deelgebieden.
- Snel navigeren naar een scoutinggroep.
- Status updates van vossenteams (rood, oranje, groen)
- Automatische timer per deelgebied na hunten van een vos.
- Tegenhunt gebied visualiseren inclusief windrichting.
- 500m cirkels om andere groepen tonen voor tegenhunt sticker plak gebied.
- Countdown en geluidsmelding voor nieuwe hints.
- Zoeken op en navigeren naar coördinaten in zowel RD-grid als WGS84 formaat.
- Dark mode!
- Verschillende kaartstijlen (automatisch licht/donker, straten, outdoor, satelliet).
- Liniaal voor het meten van afstanden.
- Aanmaken en wijzigen van andere gebruikers.

## 🚀 Gebruik
Je bent volledig vrij om deze tracker te gebruiken (het is ten slotte open-source). We zouden het echter enorm waarderen als je ons als bron vermeldt wanneer je dat doet. 
Laat het ons vooral weten als je de tracker inzet tijdens jullie Jotihunt, we vinden het superleuk om te horen hoe hij in het veld wordt gebruikt! 😄

> [!TIP]
> Bekijk ook de [Jotihunt Discord Notifier](https://github.com/ScoutingScherpenzeel/jotihunt-discord-notifier) en [Jotihunt Telegram Forwarder](https://github.com/ScoutingScherpenzeel/jotihunt-telegram-forwarder) voor het automatisch ophalen en sturen van hints en opdrachten én het doorsturen van berichten uit Telegram in een Discord-server.

## 🛠️ Installatie
Deze webapp werkt het beste in combinatie met de [Jotihunt Tracker Server](https://github.com/ScoutingScherpenzeel/jotihunt-tracker-server). De server niet gebruiken kan, maar wordt niet aanbevolen en is geen rekening mee gehouden in de code.
Om de complete app te gebruiken, kun je het beste gebruik maken van [Docker](https://www.docker.com/). Onderstaande installatie zorgt ook voor een [Traccar](https://www.traccar.org/) server, welke je later zelf nog dient te configureren.
Traccar is de GPS tracker die gebruikt wordt op de telefoons van de hunters.

### Docker compose
1. Maak een bestand `docker-compose.yml` aan met de volgende inhoud:
```yaml
version: "3.9"
services:
  server:
    image: ghcr.io/scoutingscherpenzeel/jotihunt-tracker-server:latest # of ":main" voor de laatste ontwikkelversie.
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "3000:3000"
  client:
    image: ghcr.io/scoutingscherpenzeel/jotihunt-tracker-client:latest
    restart: unless-stopped
    ports:
      - "80:80"
    env_file:
      - .env
  mongodb:
    image: mongo:latest
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - mongodb:/data/db
  traccar:
    image: traccar/traccar:ubuntu
    restart: unless-stopped
    ports:
      - 5055:5055 # UDP poort voor GPS trackers
      - 8082:8082 # Webinterface en API
    volumes:
      - traccar_logs:/opt/traccar/logs
      - traccar_data:/opt/traccar/data
      - traccar_conf:/opt/traccar/conf
      
volumes:
  mongodb:
  traccar_logs:
  traccar_data:
  traccar_conf:
```
2. Maak in dezelfde folder een `.env` bestand aan met de volgende inhoud (zie ook: configuratie):
```env
DEBUG=false
TZ=Europe/Amsterdam

# Database
MONGO_URI=mongodb://mongodb:27017/jotihunt
MONGO_INITDB_DATABASE=jotihunt

# Traccar
TRACCAR_API_URL=http://traccar:8082
TRACCAR_API_TOKEN=token-van-traccar
JOTIHUNT_API_URL=https://jotihunt.nl/api/2.0

# Jotihunt
JOTIHUNT_WEB_URL=https://jotihunt.nl
JOTIHUNT_WEB_USERNAME=naam@jouwscoutinggroep.nl
JOTIHUNT_WEB_PASSWORD=password123

# Client
JWT_SECRET=verander-dit-naar-een-veilige-random-string-van-minimaal-32-tekens
API_BASE_URL=https://api.jotihunt.jouwscoutinggroep.nl
TEAMS_AREA_EDITING=false # Sta toe dat gebruikers de teams-gebieden kunnen aanpassen in de client
```
3. Start de applicatie met:
```bash
docker-compose up -d
```

Er zijn nu vier services gestart:
- `server`: De Jotihunt Tracker Server - http://localhost:3000
- `client`: De Jotihunt Tracker Client - http://localhost:80
- `traccar`: De Traccar GPS tracking server - http://localhost:8082
- `mongodb`: De MongoDB database voor de server

## ⚙️ Configuratie
Volg de configuratiestappen om de volledige applicatie werkend te krijgen.

### Omgevingsvariabelen
De applicatie kan worden geconfigureerd via omgevingsvariabelen. Hieronder volgt een overzicht van waar je de verschillende variabelen vandaan kunt halen.

> **Let op:** de start- en eindtijd van de hunt, jullie eigen team, de Traccar-groepen per voertuig (lopend, fiets, auto, motor), de groepsnaam, het logo en de Discord-link zijn géén omgevingsvariabelen van de client meer (`HUNT_START_TIME`, `HUNT_END_TIME`, `HOME_TEAM_API_ID`, `GROUP_*_ID`, `GROUP_NAME`, `LOGO_URL`, `DISCORD_URL`). Je stelt ze als beheerder in via **Beheer → Algemeen**; de server levert ze aan de client via `/config`. Maak voor de voertuiggroepen eerst in Traccar (`Instellingen` > `Groepen`) de groepen `Auto`, `Fiets`, `Motor` en `Lopend` aan; daarna kies je ze in Beheer uit de lijst.

#### `TRACCAR_API_TOKEN`
1. Ga naar jouw Traccar server (standaard te bereiken via `http://localhost:8082`) en log in als administrator.
2. Navigeer onderin naar `Instellingen` > `Voorkeuren` > `Token`.
3. Stel een verloopdatum in en druk op de ververs knop.
4. Kopieer de gegenereerde token en plak deze in de `.env` file bij `TRACCAR_API_TOKEN`.

#### `JOTIHUNT_WEB_USERNAME` en `JOTIHUNT_WEB_PASSWORD`
Dit zijn de inloggegevens die je normaal gebruikt om in te loggen op [jotihunt.nl](https://jotihunt.nl). De server zal deze gebruiken om automatisch de hunts op te halen (scrapen).

#### `JWT_SECRET`
Genereer een willekeurige, veilige string van minimaal 32 tekens. Deze wordt gebruikt om JWT tokens te ondertekenen voor de authenticatie.

#### Kaartweergave (MapLibre)
De kaart gebruikt [MapLibre GL JS](https://maplibre.org/) met gratis, token-loze kaartbronnen. Er is dus geen account of API-token nodig om de kaart te laten werken:
- **Automatisch (Material)**, de standaard: dezelfde kaart als de Android-app, OpenFreeMap Liberty ingekleurd met een Material 3-kleurschema (seed `MAP_SEED` in `src/lib/map-style/material-style.ts`), licht of donker met het thema van de site.
- **Straten**: vectortegels van [OpenFreeMap](https://openfreemap.org/) (gratis, geen limiet, gebaseerd op OpenStreetMap-data).
- **Outdoor**: de BRT achtergrondkaart van [PDOK](https://www.pdok.nl/) (Kadaster).
- **Satelliet**: luchtfoto's van PDOK (Beeldmateriaal Nederland), met plaatsnamen/straten van OpenFreeMap eroverheen.

#### `API_BASE_URL`
Stel dit in op de URL waar jouw Jotihunt Tracker Server bereikbaar is. Bijvoorbeeld `https://api.jotihunt.jouwscoutinggroep.nl` of `http://localhost:3000` als je lokaal werkt.
Belangrijk: deze URL moet **publiek toegankelijk** zijn.

#### `TEAMS_AREA_EDITING`
In 2024 waren de deelgebieden niet voorafgaand aan de hunt bekend. 
Door deze instelling op `true` te zetten, kunnen gebruikers in de client de gebieden van teams zelf aanpassen en opslaan. 

### Eerste gebruiker aanmaken
Als je voor het eerst wilt inloggen, zul je een beheerder account moeten aanmaken.
Dit kan alleen direct vanuit de docker container. Zoek de naam van de draaiende server container op met:
```bash
docker ps
```
Vervolgens voer je het volgende commando uit (vervang `jotihunt-server-1` door de naam van jouw container):
```bash
docker exec -it jotihunt-server-1 bun run create-user --email mail@jouwscoutinggroep.nl --password wachtwoord --name Naam --admin true
```

### Ophalen teams uit API
De kaart is in eerste instantie nog leeg. Om de teams op te halen, ga je met een beheerderaccount naar `Instellingen` > `Admin tools` en druk je op de knop `Herlaad teams uit API`.
Hierna wordt de kaart gevuld met de teams die meedoen aan de Jotihunt. Vergeet dit niet uit te voeren nadat de inschrijving is gesloten!
## 🛰️ GPS Tracking
De GPS tracking wordt verzorgd door [Traccar](https://www.traccar.org/).
Om de GPS tracking werkend te krijgen, dien je de telefoons van de hunters te configureren met de Traccar Client app.
1. Installeer de [Traccar Client app](https://www.traccar.org/client/) op de telefoons van de hunters. De apps zijn verkrijgbaar in zowel de Play Store als de App Store.
2. Open de app en ga naar `Instellingen wijzigen`.
3. De volgende instellingen werken goed in de meeste gevallen:
   - Server-URL: Dit is de URL van jouw Traccar server, bijvoorbeeld `http://tracker.jotihunt.jouwscoutinggroep.nl`. Let op: deze URL moet naar poort `5055` gaan!
   - Locatienauwkeurigheid: Hoogste
   - Afstand (meters): 5
   - Interval (seconden): 5
   - Hoek (graden): Uitgeschakeld
   - Stationaire heartbeat (seconden): 30
   - Snelste interval (seconden): 5
   - Offline buffering: Ingeschakeld
   - Wakelock: Ingeschakeld
   - Stopdetectie: Ingeschakeld
4. Je kan ook gebruik maken van een QR-code om de instellingen te configureren. Dat ziet er dan als volgt uit: `https://tracker.jotihunt.jouwscoutinggroep.nl/?accuracy=highest&distance=5&heartbeat=30&fastest_interval=5&interval=5&wakelock=true`

In het dashboard dien je als beheerder vervolgens het Apparaat-ID te registreren. Dit doe je door in de zijbalk bovenin op het plusje (+) te drukken en de gegevens van het apparaat in te vullen. Na opslaan zal het apparaat verschijnen in de lijst en zal de GPS tracking starten zodra de app op de telefoon wordt gestart met "Continu volgen".

## 🤝 Bijdragen
- Heb je zelf verbeteringen gemaakt? Open een Pull Request!
- Ideeën maar geen code-skills? Maak een Issue, wie weet pakt iemand het op.
- Alle bijdragen zijn welkom om de tracker samen nóg beter te maken. 💡

## 📜 Licentie
Dit project is open-source en beschikbaar onder de MIT-licentie.

💛 Gemaakt door [Scouting Scherpenzeel](https://scoutingscherpenzeel.nl/).\
📧 E-mailadres: [info@scoutingscherpenzeel.nl](mailto:info@scoutingscherpenzeel.nl)