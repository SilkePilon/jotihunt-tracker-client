export interface Team {
  _id: string;
  apiId: number;
  name: string;
  accomodation: string;
  street: string;
  houseNumber: string;
  houseNumberAddition: string;
  postCode: string;
  city: string;
  area?: string;
  /** Group logo from jotihunt.nl, when the group uploaded one */
  logoUrl?: string;
  location: {
    type: string;
    coordinates: number[];
  };
}
