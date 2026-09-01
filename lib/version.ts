import versions from "../config/versions.json";

export const BACKUP_FORMAT_VERSION = versions.backupFormat;
export const CACHE_SCHEMA_VERSION = versions.cacheSchema;
export const DATABASE_MIGRATION_VERSION = versions.databaseMigration;

const despliegue = process.env.NEXT_PUBLIC_RITMO_BUILD_ID || "dev";

/** Cambia con cada despliegue y fuerza una caché nueva del service worker. */
export const APP_CACHE_VERSION = `${CACHE_SCHEMA_VERSION}-${despliegue}`;
