/** Sovelluksen versio varmuuskopio- ja synkronointitiedostoihin (pidä samana kuin package.json). */
export const APP_VERSION = '0.1.0';

export const BACKUP_FORMAT = 'liikkumisseuranta-backup';
export const SYNC_FORMAT = 'liikkumisseuranta-sync';

/** Synkronointitiedostot pilvikansiossa: kumpikin laite kirjoittaa vain omaansa (SPEC 10). */
export const SYNC_FILE_NAME = { pc: 'liikkuminen-pc.json', phone: 'liikkuminen-puhelin.json' } as const;
