/// <reference types="@girs/gjs" />
/// <reference types="@girs/gjs/dom" />
/// <reference types="@girs/adw-1/ambient" />
/// <reference types="@girs/gdk-4.0/ambient" />
/// <reference types="@girs/gio-2.0/ambient" />
/// <reference types="@girs/glib-2.0/ambient" />
/// <reference types="@girs/gobject-2.0/ambient" />
/// <reference types="@girs/gtk-4.0/ambient" />
/// <reference types="@girs/soup-3.0/ambient" />

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
