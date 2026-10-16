import NotificationSoundsPanel from './panels/NotificationSoundsPanel';
import { flyToOverview, openSettings, resetToMenu, scrollSidebarToTop, sheetSnap, showSection } from './actions';
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
    actions: [sheetSnap('full'), showSection('foxes')],
  },
  {
    id: 'hunts',
    target: 'sidebar.hunts',
    title: 'Hunts',
    body: 'Meld hier een hunt. Je ziet ook de laatste hunts en hun status.',
    actions: [sheetSnap('full'), showSection('hunts')],
  },
  {
    id: 'hints',
    target: 'sidebar.hints',
    title: 'Hints',
    body: 'De laatste hints per deelgebied in één oogopslag: groen is opgelost, grijs staat nog open. Op een laptop open je met "Open hints" het venster met alle hints, opdrachten en nieuws.',
    actions: [sheetSnap('full'), showSection('hints')],
  },
  {
    id: 'hint-entry',
    target: 'sidebar.hintEntry',
    title: 'Hint registreren',
    body: 'Kies het deelgebied en de tijd en vul de RD-coördinaten van een opgeloste hint in; de hint komt dan op de kaart.',
    actions: [sheetSnap('full'), showSection('hintEntry')],
  },
  {
    id: 'predictions',
    target: 'sidebar.predictions',
    title: 'Voorspelling',
    body: 'Een AI-voorspelling van waar de vossen waarschijnlijk zijn. Tik op een voorspelling om ernaartoe te gaan op de kaart.',
    actions: [sheetSnap('full'), showSection('predictions')],
    optional: true,
  },
  {
    id: 'counter-hunt',
    target: 'sidebar.counterHunt',
    title: 'Tegenhunt',
    body: 'Wordt ons clubhuis gehunt? Dan zie je hier automatisch uit welke richting, en op de kaart.',
    actions: [sheetSnap('full'), showSection('counterHunt')],
    optional: true,
  },
  {
    id: 'tracker',
    target: 'sidebar.tracking',
    title: 'Mijn tracker',
    body: 'Koppel je telefoon als GPS-tracker, zodat iedereen ziet waar je bent. Kies hier ook of je loopt, fietst of rijdt.',
    actions: [sheetSnap('full'), showSection('tracking')],
  },
  {
    id: 'hunt-capture',
    target: 'huntCapture.button',
    title: 'Snel een hunt melden',
    body: 'Met deze knop meld je meteen een hunt, waar je ook bent in de app.',
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
    id: 'map-layers',
    target: 'map.layersButton',
    title: 'Kaartstijl en lagen',
    body: 'Wissel hier tussen kaartstijlen zoals satelliet, en zet lagen als groepen, markers en 3D-gebouwen aan of uit.',
    only: 'desktop',
  },
  {
    id: 'settings',
    target: 'settings.replayItem',
    title: 'Instellingen',
    body: 'Je account, meldingen en meer. Hier kun je deze rondleiding ook altijd opnieuw bekijken.',
    actions: [resetToMenu(), sheetSnap('half'), scrollSidebarToTop(), openSettings()],
  },
  {
    id: 'notification-sounds',
    target: 'tour.panel',
    title: 'Meldingen en geluiden',
    body: 'Bij elke soort melding hoort een eigen geluid. Speel ze hier af, zodat je onderweg zonder te kijken weet wat er gebeurt. Welke meldingen je krijgt, kies je in Instellingen → Meldingen. Klik op Volgende als je klaar bent.',
    actions: [sheetSnap('peek')],
    panel: NotificationSoundsPanel,
  },
  {
    id: 'done',
    target: null,
    title: 'Klaar!',
    body: 'Je bent er klaar voor. Veel succes met hunten!',
  },
];
