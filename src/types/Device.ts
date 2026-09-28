export interface Device {
  id: number;
  attributes?: {
    deviceImage?: string;
  };
  groupId: number;
  groupName?: string;
  calendarId: number;
  name: string;
  uniqueId: string;
  status: string;
  // null until the device has sent its first position (e.g. just created via "Mijn tracker")
  lastUpdate: Date | null;
  positionId: number;
  phone?: string;
  model?: string;
  contact?: string;
  category?: string;
  disabled: boolean;
  expirationTime?: Date;
}
