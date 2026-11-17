/** What the map's live region says when a popup opens: "<titel> geopend"; '' when the popup has no readable title. */
export function popupAnnouncement(title: string | null | undefined): string {
  const text = title?.replace(/\s+/g, ' ').trim();
  return text ? `${text} geopend` : '';
}
