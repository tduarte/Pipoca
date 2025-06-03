# GNOME TypeScript Template

A template for creating GNOME applications using GTK, libadwaita, TypeScript,
Flatpak, and Meson. Just clone this repo and start building your application!

![A screenshot showing the main window of this template](./data/screenshots/screenshot1.png)

## Building

Building this template is pretty easy, and here are the different ways to do it,
from easiest to hardest.

### GNOME Builder

This is the easiest method. Builder is the GNOME IDE and has a plethora of tools
to make your app the best it can be.

1. Make sure you install Builder from Flathub:
   https://flathub.org/apps/org.gnome.Builder
2. Open Builder and click the “Clone repository...” button.
3. Enter the URL of the template, the location where you want it to be cloned,
   your name, and your email address, and click the “Clone repository” button.
4. Once cloned, Builder will alert you if there are any missing dependencies. Be
   sure to follow its instructions to install them.
5. Click the “Run Project” button (the one with the ▶️ icon) and voilà! The
   application will build and run immediately.

### Visual Studio Code / VSCodium

This method is for those who are very accustomed to using Microsoft's code
editor. We will use Bilal's Flatpak extension.

1. Make sure you install Bilal's Flatpak extension.

   - Visual Studio Marketplace:
     https://marketplace.visualstudio.com/items?itemName=bilelmoussaoui.flatpak-vscode
   - Open VSX Registry:
     https://open-vsx.org/extension/bilelmoussaoui/flatpak-vscode

2. Click on “Clone Git Repository...”
3. Enter the template URL and press Enter
4. You will be asked to select the location where you want to clone the
   template. Select one and continue.
5. Once cloned, check the status bar to make sure the extension does not request
   any additional dependencies. If you need any, install them with
   `flatpak install --user`
6. Once everything is ready, press <kbd>Ctrl</kbd> + <kbd>Alt</kbd> +
   <kbd>B</kbd> or select “Flatpak: Build” from the command palette. Voilà!

### Flatpak Builder

If you want to do everything manually but still want Flatpak to manage the
builds, then this is the method for you.

1. Install Flatpak, Git, and Git LFS using the appropriate methods for your
   distribution:

   ```sh
   # For Ubuntu (or any Debian-based distro)
   sudo apt install flatpak git git-lfs

   # For Fedora (or any distro from the Red Hat family)
   sudo dnf install flatpak git git-lfs
   ```

2. Install Flatpak Builder, the GNOME SDK, the GNOME runtime, and the Node.js
   SDK extension:

   ```sh
   flatpak install --user                        \
   	org.flatpak.Builder//stable                 \
   	org.gnome.Sdk//48                           \
   	org.gnome.Platform//48                      \
   	org.freedesktop.Sdk.Extension.node24//24.08
   ```

3. Clone the template using Git:

   ```sh
   git clone https://codeberg.org/nyx_lyb3ra/gnome-ts-template.git
   ```

4. Once the template has been cloned, run the following command within its
   directory:

   ```sh
   flatpak run org.flatpak.Builder     \
   	--force-clean                     \
   	--install                         \
   	--user                            \
   	repo                              \
   	ar.liber.nyx.GnomeTsTemplate.json
   ```

5. Voilà! The template will be built and installed at the user level on your
   system.

### Meson Build System

Meson is the build system used by most apps in GNOME. If you want to build the
template using your distribution's dependencies, then this is the method for
you.

1. Install `desktop-file-utils`, `gettext`, Git, Git LFS, GJS, GLib, GTK,
   `libadwaita`, Meson, and Node.js using the appropriate methods for your
   distribution.

   ```sh
   # For Ubuntu (or any Debian-based distro)
   sudo apt install     \
   	desktop-file-utils \
   	gettext            \
   	git                \
   	git-lfs            \
   	gjs                \
   	libglib2.0-dev     \
   	libgtk-4-dev       \
   	libadwaita-1-dev   \
   	meson              \
   	nodejs             \
   	npm

   # For Fedora (or any distro from the Red Hat family)
   sudo dnf install     \
   	desktop-file-utils \
   	gettext            \
   	git                \
   	git-lfs            \
   	gjs                \
   	glib2-devel        \
   	gtk4-devel         \
   	libadwaita-devel   \
   	meson              \
   	nodejs
   ```

2. Set up the build folder:

   ```sh
   meson setup _build -Dprefix=~/.local
   ```

3. Build and install the app:

   ```sh
   meson install -C _build
   ```

4. Voilà! The template will be built and installed at the user level on your
   system.

## Credits

I created this template, drawing heavily on the one Bilal made for Rust.
[Check it out!](https://gitlab.gnome.org/World/Rust/gtk-rust-template)

## License

[GNOME TypeScript Template](https://codeberg.org/nyx_lyb3ra/gnome-ts-template)
© 2025 by [[nyx]](https://nyx.liber.ar/) is licensed under
[Blue Oak Model License 1.0.0](./LICENSE.md).
