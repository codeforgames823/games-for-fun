export const CONFIG = {
    // City
    CITY_GRID_SIZE: 20,
    BLOCK_SIZE: 60,
    ROAD_WIDTH: 12,
    SIDEWALK_WIDTH: 3,
    BUILDING_MIN_HEIGHT: 8,
    BUILDING_MAX_HEIGHT: 60,
    BUILDING_PADDING: 2,

    // Player
    PLAYER_SPEED: 12,
    PLAYER_SPRINT_MULT: 1.8,
    PLAYER_JUMP_FORCE: 14,
    PLAYER_HEIGHT: 1.8,
    PLAYER_RADIUS: 0.4,
    PLAYER_MAX_HEALTH: 100,
    PLAYER_MAX_ARMOR: 100,
    PLAYER_HEALTH_REGEN_RATE: 2,
    PLAYER_HEALTH_REGEN_DELAY: 5,

    // Camera
    CAM_DISTANCE: 8,
    CAM_HEIGHT: 4,
    CAM_LERP: 0.08,
    CAM_DRIVE_DISTANCE: 14,
    CAM_DRIVE_HEIGHT: 6,

    // Vehicles
    VEHICLE_ACCEL: 28,
    VEHICLE_BRAKE: 40,
    VEHICLE_MAX_SPEED: 45,
    VEHICLE_STEER_SPEED: 2.5,
    VEHICLE_FRICTION: 0.98,
    VEHICLE_ENTER_RANGE: 4,

    // Combat
    WEAPONS: {
        fists:   { damage: 10, rate: 0.4, range: 2.5, ammo: Infinity, spread: 0, auto: false, name: 'Fists' },
        pistol:  { damage: 20, rate: 0.3, range: 80, ammo: 60, spread: 0.02, auto: false, name: 'Pistol' },
        shotgun: { damage: 50, rate: 0.8, range: 30, ammo: 30, spread: 0.08, auto: false, name: 'Shotgun' },
        smg:     { damage: 12, rate: 0.08, range: 60, ammo: 120, spread: 0.04, auto: true, name: 'SMG' },
    },

    // NPCs
    NPC_COUNT: 40,
    NPC_SPEED: 3,
    NPC_FLEE_SPEED: 8,
    NPC_SPAWN_RADIUS: 80,
    NPC_DESPAWN_RADIUS: 120,
    NPC_HEALTH: 50,

    // Police
    WANTED_DECAY_TIME: 15,
    POLICE_SPEED: 14,
    POLICE_CAR_SPEED: 40,
    POLICE_SPAWN_DISTANCE: 60,
    POLICE_HEALTH: 80,

    // Physics
    GRAVITY: 30,
    GROUND_Y: 0,

    // Colors
    COLORS: {
        road: 0x333333,
        roadLine: 0xcccc00,
        sidewalk: 0x999999,
        grass: 0x4a7c3f,
        sky: 0x87ceeb,
        sunLight: 0xffeedd,
        ambientLight: 0x404060,
        player: 0x2277dd,
        police: 0x1144aa,
        policeCar: 0x000000,
        policeLight: 0xff0000,
        npcColors: [0xdd4444, 0x44dd44, 0xdddd44, 0xdd8844, 0x8844dd, 0x44dddd, 0xdd44dd, 0x888888],
        buildingColors: [0x8899aa, 0x99887766, 0x667788, 0x887766, 0x998877, 0xaabbcc, 0x776655, 0x556677, 0xbbaa99, 0x6688aa],
        vehicleColors: [0xff3333, 0x3333ff, 0x33ff33, 0xffff33, 0xff33ff, 0x33ffff, 0xffffff, 0x111111, 0xff8800, 0x8800ff],
    },

    // Missions
    MISSION_MARKER_COLOR: 0xffff00,
    MISSION_RADIUS: 3,
};
