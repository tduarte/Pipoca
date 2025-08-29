/// <reference types="@girs/adw-1/ambient" />

// Minimal fallback typing for Soup to avoid requiring a new package install
// while still allowing strict type-check to pass.
declare module "gi://Soup" {
  const Soup: any;
  export default Soup;
}

declare namespace Config {
  export const APP_ID: string;
  export const DATADIR: string;
  export const GETTEXT_PACKAGE: string;
  export const LOCALEDIR: string;
  export const PKGDATADIR: string;
  export const VERSION: string;
}

declare module "*.ui" {
  const content: string;
  export default content;
}
