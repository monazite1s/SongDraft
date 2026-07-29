export interface ArtistTheme {
  primary: string;
  muted: string;
  border: string;
  foreground: string;
  hero: string;
}

export interface ArtistEvent {
  id: string;
  title: string;
  type: "anniversary" | "birthday" | "concert" | "comeback" | "award";
  description: string;
}

export interface ArtistProfile {
  id: string;
  name: string;
  avatarUrl: string;
  heroUrl: string;
  theme: ArtistTheme;
  genres: string[];
  events: ArtistEvent[];
  summary: string;
  fandomName: string;
  slogan: string;
}

export interface ArtistCatalog {
  list(): Promise<ArtistProfile[]>;
  findById(id: string): Promise<ArtistProfile | null>;
}
