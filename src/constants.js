export const GRID_SIZE = 30;
export const MAX_HEIGHT = 10;
export const MAX_CELLS = 2500;
export const CELL_SIZE = 1.0;

export const COLORS = [
  { id: 1, hex: 0xF2EBD3, name: 'Warm White' },
  { id: 2, hex: 0xD97A5B, name: 'Terracotta' },
  { id: 3, hex: 0xA8BFA0, name: 'Sage' },
  { id: 4, hex: 0x8AB3C4, name: 'Sky' },
  { id: 5, hex: 0xE8B547, name: 'Mustard' },
  { id: 6, hex: 0xFF6B3D, name: 'Surprise', unlockAfter: 10 },
];

export const TILE_TYPES = ['freestanding', 'wall', 'corner', 'roof'];

export const ANIM = {
  place: 250,
  remove: 150,
  hover: 100,
  paletteSelect: 150,
  cameraRotate: 200,
  holdConfirm: 1500,
};

export const CLICK_THRESHOLD = {
  maxDistance: 8,
  maxDuration: 300,
};

export const STORAGE_KEY = 'townscaper-mvp-v1';
export const SAVE_DEBOUNCE_MS = 2000;

export const CAMERA = {
  pitch: (Math.PI * 30) / 180,
  yaw: Math.PI / 4,
  zoom: 1.0,
  viewSize: 20,
  distance: 50,
};

export const PALETTE = {
  grass: 0xB8D49A,
  gridLine: 0x9FBC82,
  skyTop: 0xC8E0ED,
  skyHorizon: 0xF0E8DA,
  shadow: 0x4A3A2E,
  lightDirectional: 0xFFF8EB,
  lightAmbient: 0xB8C8D4,
};
