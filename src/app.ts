import Adw from "gi://Adw";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import MainWindow from "./main-window";
import {server} from "./llama-server";

const options = {GTypeName: "PipocaApp"};

class App extends Adw.Application {
  static {
    GObject.registerClass(options, this);
  }

  public override vfunc_activate(): void {
    this.activeWindow?.present();
  }

  public override vfunc_shutdown(): void {
    server.stop();
    super.vfunc_shutdown();
  }

  public override vfunc_startup(): void {
    super.vfunc_startup();

    GLib.set_application_name("Pipoca");
    GLib.set_prgname("pipoca");

    // Quitting closes the window rather than exiting outright, so the window
    // gets to ask about an unsaved translation first.
    this.add_action_entries([
      {activate: () => this.activeWindow?.close(), name: "quit"},
    ]);
    this.set_accels_for_action("app.quit", ["<Ctrl>Q"]);
    this.set_accels_for_action("window.close", ["<Ctrl>W"]);
    this.set_accels_for_action("win.open-file", ["<Ctrl>O"]);

    new MainWindow({application: this});
  }
}

export default App;
