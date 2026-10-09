// Placeholder for Game Engine types

export interface Player {
  id: string;
  name: string;
  points: number;
  sigilId?: string;
  status: 'alive' | 'dead' | 'spectating';
}

export interface Sigil {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'unique';
  // attributes to be defined
}
