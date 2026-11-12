/** Sovelluksen versio varmuuskopio- ja synkronointitiedostoihin (pidä samana kuin package.json). */
export const APP_VERSION = '0.1.0';

export const BACKUP_FORMAT = 'liikkumisseuranta-backup';
export const SYNC_FORMAT = 'liikkumisseuranta-sync';

/**
 * Synkronointitiedosto pilvikansiossa: molemmat laitteet tallentavat samalla nimellä (lisäys 16).
 * PC yhdistää tiedoston aina ennen kirjoitusta, joten puhelimen tallennus voi korvata sen.
 * Aiemmat kahden tiedoston nimet luetaan edelleen (siirtymä).
 */
export const SYNC_FILE_NAME = { shared: 'liikkuminen.json', legacyPc: 'liikkuminen-pc.json', legacyPhone: 'liikkuminen-puhelin.json' } as const;
