import { flyToOverview, openHintBoard, openSection, openSettings, sheetSnap } from './actions';
import type { TourStep } from './types';

/**
 * Bump to show the tour again to every user once (e.g. after a big layout change).
 * Users whose stored tutorialVersion is lower get the tour automatically on their next visit.
 */
export const TOUR_VERSION = 1;

/**
 * The onboarding tour, in order. To add a step: add its target id to targets.ts, put {...tourTarget(id)}
 * on the element, and add an entry here. New UI interactions go in actions.ts.
 * On phones every sidebar step first pulls the sheet up so the section is visible.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welkom bij de Jotihunt Tracker!',
    body: 'In een paar stappen laten we zien hoe de app werkt. De rondleiding loopt vanzelf door; met de knoppen ga je sneller of terug.',
  },
  {
    id: 'map',
    target: 'map',
    title: 'De kaart',
    body: 'Hier zie je de deelnemende groepen, de vossen per deelgebied en waar onze hunters rijden. Tik of klik op de kaart om de coördinaten van die plek te zien.',
    actions: [sheetSnap('peek'), flyToOverview()],
  },
  {
    id: 'sidebar',
    target: 'sidebar.root',
    title: 'Het zijpaneel',
    body: 'Alles wat je nodig hebt staat in dit paneel. Elk blok klapt open en dicht. Op je telefoon schuif je het paneel omhoog en omlaag.',
    actions: [sheetSnap('half')],
  },
  {
    id: 'foxes',
    target: 'sidebar.foxes',
    title: 'Vossen',
    body: 'De status van elk deelgebied: rood, oranje of groen. Tik op een letter om dat gebied op de kaart te verbergen of weer te tonen.',
    actions: [sheetSnap('full'), openSection('foxes')],
  },
  {
    id: 'hunts',
    target: 'sidebar.hunts',
    title: 'Hunts',
    body: 'Maak een foto van een hunt om hem te registreren. Hier zie je de laatste hunts en hun status.',
    actions: [sheetSnap('full'), openSection('hunts')],
  },
  {
    id: 'hints',
    target: 'sidebar.hints',
    title: 'Hints',
    body: 'De laatste hints per deelgebied in één oogopslag: groen is opgelost, oranje is bezig en grijs staat nog open.',
    actions: [sheetSnap('full'), openSection('hints')],
  },
  {
    id: 'hint-board',
    target: 'hintBoard.dialog',
    title: 'Het hintbord',
    body: 'Alle hints van de hele dag. Open een vakje om de hint te bekijken, te claimen en de oplossing in te vullen.',
    actions: [openHintBoard()],
  },
  {
    id: 'hint-entry',
    target: 'sidebar.hintEntry',
    title: 'Hint registreren',
    body: 'Kies het deelgebied en de tijd en vul de RD-coördinaten van een opgeloste hint in; de hint komt dan op de kaart.',
    actions: [sheetSnap('full'), openSection('hintEntry')],
  },
  {
    id: 'predictions',
    target: 'sidebar.predictions',
    title: 'Voorspelling',
    body: 'Een AI-voorspelling van waar de vossen waarschijnlijk zijn. Tik op een voorspelling om ernaartoe te gaan op de kaart.',
    actions: [sheetSnap('full'), openSection('predictions')],
    optional: true,
  },
  {
    id: 'counter-hunt',
    target: 'sidebar.counterHunt',
    title: 'Tegenhunt',
    body: 'Kies een windrichting en tik op Toon om de tegenhunt rond ons clubhuis op de kaart te zien.',
    actions: [sheetSnap('full'), openSection('counterHunt')],
    optional: true,
  },
  {
    id: 'tracker',
    target: 'sidebar.tracking',
    title: 'Mijn tracker',
    body: 'Koppel je telefoon als GPS-tracker, zodat iedereen ziet waar je rijdt. Tijdens het koppelen vind je in deze kaart ook een uitleg stap voor stap.',
    actions: [sheetSnap('full'), openSection('tracking')],
  },
  {
    id: 'hunters',
    target: 'sidebar.hunters',
    title: 'Actieve hunters',
    body: 'Wie er nu onderweg is. Tik op een hunter om naar die plek op de kaart te gaan.',
    actions: [sheetSnap('full'), openSection('hunters')],
  },
  {
    id: 'hunt-capture',
    target: 'huntCapture.button',
    title: 'Snel een hunt vastleggen',
    body: 'Met deze cameraknop maak je meteen een foto van een hunt, waar je ook bent in de app.',
    actions: [sheetSnap('peek')],
    only: 'mobile',
  },
  {
    id: 'map-tools',
    target: 'cards.topRight',
    title: 'Coördinaten en zoeken',
    body: 'Plak hier coördinaten om ze op de kaart te zien, of zoek een groep op naam.',
    only: 'desktop',
  },
  {
    id: 'settings',
    target: 'settings.replayItem',
    title: 'Instellingen',
    body: 'Kaartstijl, donkere modus, zichtbare lagen en meer. Hier kun je deze rondleiding ook altijd opnieuw bekijken.',
    actions: [sheetSnap('peek'), openSettings()],
  },
  {
    id: 'done',
    target: null,
    title: 'Klaar!',
    body: 'Je bent er klaar voor. Veel succes met hunten!',
  },
];
