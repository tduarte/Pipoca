import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk";

import Template from "./main-window.ui";
import {decodeText} from "./encoding";
import {_, fmt} from "./i18n";
import {languages, type Language} from "./languages";
import {server} from "./llama-server";
import * as Models from "./models";
import {buildSrt, parseSrt, translatedFileName} from "./srt";
import * as Translator from "./translator";

Gio._promisify(Gtk.FileDialog.prototype, "open", "open_finish");
Gio._promisify(Gtk.FileDialog.prototype, "save", "save_finish");
Gio._promisify(Adw.AlertDialog.prototype, "choose", "choose_finish");
Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);
Gio._promisify(
  Gio.File.prototype,
  "replace_contents_bytes_async",
  "replace_contents_finish",
);

const options = {
  GTypeName: "PipocaMainWindow",
  Template,
  InternalChildren: [
    "main-stack",
    "back-button",

    "onboarding-icon",
    "onboarding-title",
    "onboarding-description",
    "model-choice-group",
    "download-button",
    "download-progress",
    "download-status",

    "translate-page",
    "source-area",
    "drop-zone-button",
    "selected-file-display",
    "file-name-label",
    "target-language-row",
    "model-row",
    "context-row",
    "translate-button",
    "progress-bar",
    "status-label",
  ],
};

/** A translation that has been started and not yet saved. */
type UnsavedJob = Translator.Job & {fileName: string};

function errorMessage(e: unknown): string {
  return e instanceof Error || e instanceof GLib.Error ? e.message : String(e);
}

function isDismissed(e: unknown): boolean {
  return (
    e instanceof GLib.Error &&
    (e.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED) ||
      e.matches(Gtk.DialogError, Gtk.DialogError.CANCELLED) ||
      e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
  );
}

function subtitleFilters(): Gio.ListStore<Gtk.FileFilter> {
  const filter = new Gtk.FileFilter();
  filter.set_name(_("Subtitle Files"));
  filter.add_pattern("*.srt");
  filter.add_pattern("*.SRT");

  const filters = new Gio.ListStore<Gtk.FileFilter>({
    item_type: Gtk.FileFilter.$gtype,
  });
  filters.append(filter);
  return filters;
}

class MainWindow extends Adw.ApplicationWindow {
  declare private _main_stack: Gtk.Stack;
  declare private _back_button: Gtk.Button;

  declare private _onboarding_icon: Gtk.Image;
  declare private _onboarding_title: Gtk.Label;
  declare private _onboarding_description: Gtk.Label;
  declare private _model_choice_group: Adw.PreferencesGroup;
  declare private _download_button: Gtk.Button;
  declare private _download_progress: Gtk.ProgressBar;
  declare private _download_status: Gtk.Label;

  declare private _translate_page: Gtk.ScrolledWindow;
  declare private _source_area: Gtk.Box;
  declare private _drop_zone_button: Gtk.Button;
  declare private _selected_file_display: Gtk.Box;
  declare private _file_name_label: Gtk.Label;
  declare private _target_language_row: Adw.ComboRow;
  declare private _model_row: Adw.ComboRow;
  declare private _context_row: Adw.SwitchRow;
  declare private _translate_button: Gtk.Button;
  declare private _progress_bar: Gtk.ProgressBar;
  declare private _status_label: Gtk.Label;

  private readonly _settings = Gio.Settings.new(Config.APP_ID);
  private readonly _suggestedModel = Models.suggestedModel();
  private _welcomeTitle = "";
  private _welcomeDescription = "";

  // Translation state
  private _source: Gio.File | null = null;
  private _job: UnsavedJob | null = null;
  private _running: Gio.Cancellable | null = null;
  private _closeConfirmed = false;

  // Model state
  private _activeModel: Models.CatalogModel | null = null;
  private _chosenModel: Models.CatalogModel | undefined = this._suggestedModel;
  private _download: Gio.Cancellable | null = null;
  private _choiceRows: Adw.ActionRow[] = [];
  private _installed: Models.CatalogModel[] = [];
  private _visibleLanguages: Language[] = languages;
  // Set while the rows are filled in by code, to tell that apart from the
  // user picking something.
  private _updatingRows = false;

  public constructor(props?: Partial<Adw.ApplicationWindow.ConstructorProps>) {
    super(props);

    this.set_default_size(
      this._settings.get_int("window-width"),
      this._settings.get_int("window-height"),
    );
    if (this._settings.get_boolean("maximized")) {
      this.maximize();
    }

    this.add_action_entries([
      {activate: () => this._showAboutDialog(), name: "show-about-dialog"},
      {activate: () => this._showModelManager(), name: "manage-models"},
      {activate: () => void this._openFile(), name: "open-file"},
    ]);

    this._settings.bind(
      "use-context",
      this._context_row,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );

    this._welcomeTitle = this._onboarding_title.get_label();
    this._welcomeDescription = this._onboarding_description.get_label();
    this._onboarding_icon.set_from_icon_name(Config.APP_ID);

    const memoryGB = Math.round(Models.totalMemoryGB());
    if (memoryGB > 0) {
      this._model_choice_group.set_description(
        fmt(
          _("This computer has %s GB of memory. We recommend %s."),
          memoryGB,
          this._suggestedModel.name,
        ),
      );
    }

    this._setUpDropTarget();

    this._translate_button.connect(
      "clicked",
      () => void this._onTranslateClicked(),
    );
    this._target_language_row.connect(
      "notify::selected",
      () => void this._onLanguageSelected(),
    );
    this._model_row.connect(
      "notify::selected",
      () => void this._onModelSelected(),
    );
    this._back_button.connect("clicked", () => {
      if (!this._download) this._showTranslator();
    });
    this._download_button.connect(
      "clicked",
      () => void this._onDownloadClicked(),
    );

    const saved = Models.getModel(this._settings.get_string("model-id"));
    const initial =
      saved && Models.isInstalled(saved) ? saved : Models.installedModels()[0];
    if (initial) {
      this._activateModel(initial);
      this._showTranslator();
    } else {
      this._refreshLanguages();
      this._showModelManager();
    }

    this._update();
  }

  static {
    GObject.registerClass(options, this);
  }

  public override vfunc_close_request(): boolean {
    if (this._job && !this._closeConfirmed) {
      void this._confirmClose();
      return true;
    }

    const [width, height] = this.get_default_size();
    this._settings.set_int("window-width", width);
    this._settings.set_int("window-height", height);
    this._settings.set_boolean("maximized", this.is_maximized());

    return super.vfunc_close_request();
  }

  // ---- Source file -------------------------------------------------------

  private async _openFile(): Promise<void> {
    if (this._running || !(await this._confirmDiscard())) return;

    const dialog = new Gtk.FileDialog({
      title: _("Select Subtitle File"),
      filters: subtitleFilters(),
    });

    try {
      const file = await dialog.open(this, null);
      if (file) this._setSource(file);
    } catch (e) {
      if (!isDismissed(e)) this._status_label.set_label(errorMessage(e));
    }
  }

  private _setSource(file: Gio.File): void {
    this._source = file;
    this._job = null;

    const name = file.get_basename() ?? "";
    this._file_name_label.set_label(name);
    this._file_name_label.set_tooltip_text(name);
    this._drop_zone_button.set_visible(false);
    this._selected_file_display.set_visible(true);

    this._status_label.set_label("");
    this._update();
  }

  // Files can be dropped anywhere on the page, also to replace the current one.
  private _setUpDropTarget(): void {
    const target = Gtk.DropTarget.new(Gio.File.$gtype, Gdk.DragAction.COPY);

    target.connect("enter", () => {
      if (this._running) return 0;
      this._source_area.add_css_class("drop-active");
      return Gdk.DragAction.COPY;
    });
    target.connect("leave", () => {
      this._source_area.remove_css_class("drop-active");
    });
    target.connect("drop", (_target, value) => {
      this._source_area.remove_css_class("drop-active");
      if (this._running || !(value instanceof Gio.File)) return false;

      if (!(value.get_basename() ?? "").toLowerCase().endsWith(".srt")) {
        this._status_label.set_label(
          _("Only .srt subtitle files are supported."),
        );
        return false;
      }

      void this._confirmDiscard().then(discarded => {
        if (discarded) this._setSource(value);
      });
      return true;
    });

    this._translate_page.add_controller(target);
  }

  // ---- Unsaved work ------------------------------------------------------

  /**
   * Asks before throwing away a translation that hasn't been saved. Resolves
   * to true when there is nothing to lose or the user agreed to discard it.
   */
  private async _confirmDiscard(): Promise<boolean> {
    const job = this._job;
    if (!job) return true;

    const dialog = new Adw.AlertDialog({
      heading: _("Discard Translation?"),
      body: Translator.isComplete(job)
        ? fmt(_("The translation of “%s” has not been saved."), job.fileName)
        : fmt(
            _(
              "The translation of “%s” is not finished. Its progress will be lost.",
            ),
            job.fileName,
          ),
      close_response: "cancel",
      default_response: "cancel",
    });
    dialog.add_response("cancel", _("_Cancel"));
    dialog.add_response("discard", _("_Discard"));
    dialog.set_response_appearance(
      "discard",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );

    if ((await dialog.choose(this, null)) !== "discard") return false;

    if (this._job === job) this._job = null;
    this._update();
    return true;
  }

  private async _confirmClose(): Promise<void> {
    const job = this._job;
    if (!job) return;

    let body: string;
    if (this._running) {
      body = _("The translation is still running. Its progress will be lost.");
    } else if (Translator.isComplete(job)) {
      body = fmt(
        _("The translation of “%s” has not been saved."),
        job.fileName,
      );
    } else {
      body = fmt(
        _(
          "The translation of “%s” is not finished. Its progress will be lost.",
        ),
        job.fileName,
      );
    }

    const dialog = new Adw.AlertDialog({
      heading: this._running
        ? _("Stop Translation and Quit?")
        : _("Quit Without Saving?"),
      body,
      close_response: "cancel",
      default_response: "cancel",
    });
    dialog.add_response("cancel", _("_Cancel"));
    dialog.add_response("quit", _("_Quit"));
    dialog.set_response_appearance("quit", Adw.ResponseAppearance.DESTRUCTIVE);

    if ((await dialog.choose(this, null)) !== "quit") return;

    this._closeConfirmed = true;
    this._running?.cancel();
    this.close();
  }

  // ---- Translating and saving --------------------------------------------

  private async _onTranslateClicked(): Promise<void> {
    if (this._running) {
      this._running.cancel();
      this._status_label.set_label(_("Stopping translation…"));
    } else if (this._job && Translator.isComplete(this._job)) {
      await this._save(this._job);
    } else {
      await this._translate();
    }
  }

  private async _loadJob(
    file: Gio.File,
    language: Language,
  ): Promise<UnsavedJob | null> {
    let cues;
    try {
      const [contents] = await file.load_contents_async(null);
      cues = parseSrt(decodeText(contents));
    } catch (e) {
      console.error("Could not read the subtitle file:", e);
      this._status_label.set_label(
        fmt(_("Could not read the file: %s"), errorMessage(e)),
      );
      return null;
    }

    if (cues.length === 0) {
      this._status_label.set_label(_("No subtitles were found in this file."));
      return null;
    }

    return {
      fileName: file.get_basename() ?? "",
      cues,
      translated: [],
      language,
    };
  }

  private async _translate(): Promise<void> {
    const source = this._source;
    if (!source) return;

    const model = this._activeModel;
    const language = this._job?.language ?? this._selectedLanguage();
    if (!model || !language) {
      this._showModelManager();
      return;
    }

    // Lock the controls before the first await, so nothing changes under us.
    const cancellable = new Gio.Cancellable();
    this._running = cancellable;
    this._update();

    // Starting again after a stop or a failure picks up where it left off.
    const job = this._job ?? (await this._loadJob(source, language));
    if (!job) {
      this._running = null;
      this._update();
      return;
    }
    this._job = job;

    const total = job.cues.length;
    this._progress_bar.set_fraction(job.translated.length / total);
    this._progress_bar.set_visible(true);
    this._status_label.set_label(fmt(_("Loading %s…"), model.name));

    try {
      await Translator.run(job, {
        model,
        useContext: this._settings.get_boolean("use-context"),
        cancellable,
        onProgress: (done, all) => {
          this._progress_bar.set_fraction(done / all);
          this._status_label.set_label(
            fmt(_("Translating subtitle %s of %s…"), done, all),
          );
        },
      });
      this._status_label.set_label(
        _("Translation complete. Save it to keep it."),
      );
    } catch (e) {
      const done = job.translated.length;
      if (e instanceof Translator.TranslationCancelled) {
        this._status_label.set_label(
          fmt(_("Translation stopped at subtitle %s of %s."), done, total),
        );
      } else {
        console.error("Translation failed:", e);
        const reason = fmt(_("Translation failed: %s"), errorMessage(e));
        this._status_label.set_label(
          done > 0
            ? `${reason}\n${_("Your progress was kept, so you can resume.")}`
            : reason,
        );
      }
      // Nothing was translated, so there is nothing to resume or lose.
      if (done === 0 && this._job === job) this._job = null;
    } finally {
      this._running = null;
      this._progress_bar.set_visible(false);
      this._update();
    }
  }

  private async _save(job: UnsavedJob): Promise<void> {
    const dialog = new Gtk.FileDialog({
      title: _("Save Translation"),
      initial_name: translatedFileName(job.fileName, job.language.code),
      filters: subtitleFilters(),
    });

    let file: Gio.File | null;
    try {
      file = await dialog.save(this, null);
    } catch (e) {
      if (!isDismissed(e)) {
        this._status_label.set_label(
          fmt(_("Could not save the file: %s"), errorMessage(e)),
        );
      }
      return;
    }
    if (!file) return;

    try {
      // Promisified above; the type definitions only know its callback form.
      await (file.replace_contents_bytes_async(
        new GLib.Bytes(new TextEncoder().encode(buildSrt(job.translated))),
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null,
      ) as unknown as Promise<unknown>);
    } catch (e) {
      console.error("Could not save the translation:", e);
      this._status_label.set_label(
        fmt(_("Could not save the file: %s"), errorMessage(e)),
      );
      return;
    }

    this._status_label.set_label(
      fmt(_("Translation saved as %s"), file.get_basename() ?? ""),
    );
    if (this._job === job) this._job = null;
    this._update();
  }

  /** Brings the buttons and rows in line with the current state. */
  private _update(): void {
    const running = this._running !== null;
    const job = this._job;
    const button = this._translate_button;

    for (const name of ["suggested-action", "destructive-action", "success"]) {
      button.remove_css_class(name);
    }

    if (running) {
      button.set_label(_("Stop Translation"));
      button.add_css_class("destructive-action");
    } else if (job && Translator.isComplete(job)) {
      button.set_label(_("Save Translation"));
      button.add_css_class("success");
    } else {
      button.set_label(job ? _("Resume Translation") : _("Start Translation"));
      button.add_css_class("suggested-action");
    }
    button.set_sensitive(running || this._source !== null);

    // Keep the file, language and model fixed while a translation runs.
    for (const name of ["open-file", "manage-models"]) {
      const action = this.lookup_action(name);
      if (action instanceof Gio.SimpleAction) action.set_enabled(!running);
    }
    this._target_language_row.set_sensitive(!running);
    this._model_row.set_sensitive(!running);
    this._context_row.set_sensitive(!running);
  }

  // ---- Languages ---------------------------------------------------------

  private _selectedLanguage(): Language | undefined {
    return this._visibleLanguages[this._target_language_row.get_selected()];
  }

  private _selectLanguage(code: string): void {
    const index = this._visibleLanguages.findIndex(l => l.code === code);
    const english = this._visibleLanguages.findIndex(l => l.code === "en");

    this._updatingRows = true;
    this._target_language_row.set_selected(index >= 0 ? index : english);
    this._updatingRows = false;
  }

  // Only offers the languages the active model can translate into.
  private _refreshLanguages(): void {
    const current =
      this._job?.language.code ??
      this._selectedLanguage()?.code ??
      this._settings.get_string("target-language");

    const model = this._activeModel;
    this._visibleLanguages = languages.filter(
      ({code}) => !model || Models.supportsLanguage(model, code),
    );

    const list = Gtk.StringList.new(null);
    for (const {flag, name} of this._visibleLanguages) {
      list.append(`${flag}  ${_(name)}`);
    }

    this._updatingRows = true;
    this._target_language_row.set_model(list);
    this._updatingRows = false;
    this._selectLanguage(current);
  }

  private async _onLanguageSelected(): Promise<void> {
    if (this._updatingRows) return;

    const language = this._selectedLanguage();
    if (!language) return;

    // An unsaved translation is in the language it was started with.
    const job = this._job;
    if (job && job.language.code !== language.code) {
      if (!(await this._confirmDiscard())) {
        this._selectLanguage(job.language.code);
        return;
      }
    }

    this._settings.set_string("target-language", language.code);
  }

  // ---- Models ------------------------------------------------------------

  private _activateModel(model: Models.CatalogModel): void {
    this._activeModel = model;
    this._settings.set_string("model-id", model.id);
    this._refreshLanguages();
    this._status_label.set_label(fmt(_("Loading %s…"), model.name));

    // Warm up the engine so the first translation starts right away.
    server.ensureRunning(Models.modelPath(model)).then(
      () => {
        if (this._activeModel === model && !this._running) {
          this._status_label.set_label(
            fmt(_("Ready to translate with %s"), model.name),
          );
        }
      },
      (e: unknown) => {
        console.error("Could not load the model:", e);
        if (this._activeModel === model) {
          this._status_label.set_label(
            fmt(_("Could not load %s: %s"), model.name, errorMessage(e)),
          );
        }
      },
    );
  }

  private _refreshModelRow(): void {
    this._installed = Models.installedModels();
    const list = Gtk.StringList.new(null);
    for (const model of this._installed) {
      list.append(model.name);
    }

    const active = this._activeModel;
    this._updatingRows = true;
    this._model_row.set_model(list);
    const index = active ? this._installed.indexOf(active) : -1;
    if (index >= 0) this._model_row.set_selected(index);
    this._updatingRows = false;

    this._model_row.set_subtitle(active ? _(active.description) : "");
  }

  private async _onModelSelected(): Promise<void> {
    if (this._updatingRows) return;

    const model = this._installed[this._model_row.get_selected()];
    if (!model || model === this._activeModel) return;

    // A translation can carry on with another model, unless that model
    // doesn't know the language.
    const job = this._job;
    if (job && !Models.supportsLanguage(model, job.language.code)) {
      if (!(await this._confirmDiscard())) {
        this._refreshModelRow();
        return;
      }
    }

    this._activateModel(model);
    this._model_row.set_subtitle(_(model.description));
  }

  private _updateDownloadButton(): void {
    const button = this._download_button;
    const chosen = this._chosenModel;

    button.remove_css_class("suggested-action");
    button.remove_css_class("destructive-action");
    button.set_sensitive(chosen !== undefined);

    if (this._download) {
      button.set_label(_("Cancel Download"));
      button.add_css_class("destructive-action");
    } else if (chosen && Models.isInstalled(chosen)) {
      button.set_label(_("Use This Model"));
      button.add_css_class("suggested-action");
    } else {
      button.set_label(
        chosen
          ? fmt(_("Download Model (%s)"), Models.formatSize(chosen.sizeBytes))
          : _("Download Model"),
      );
      button.add_css_class("suggested-action");
    }
  }

  private async _confirmDeleteModel(model: Models.CatalogModel): Promise<void> {
    const dialog = new Adw.AlertDialog({
      heading: fmt(_("Delete %s?"), model.name),
      body: fmt(
        _(
          "This frees %s of disk space. You can download the model again later.",
        ),
        Models.formatSize(model.sizeBytes),
      ),
      close_response: "cancel",
      default_response: "cancel",
    });
    dialog.add_response("cancel", _("_Cancel"));
    dialog.add_response("delete", _("_Delete"));
    dialog.set_response_appearance(
      "delete",
      Adw.ResponseAppearance.DESTRUCTIVE,
    );

    if ((await dialog.choose(this, null)) !== "delete") return;

    if (model === this._activeModel) {
      server.stop();
      this._activeModel = null;
      this._settings.set_string("model-id", "");
    }
    try {
      Models.deleteModel(model);
    } catch (e) {
      console.error("Could not delete the model:", e);
      this._download_status.set_label(errorMessage(e));
    }
    this._showModelManager();
  }

  private _rebuildModelChoices(): void {
    for (const row of this._choiceRows) this._model_choice_group.remove(row);
    this._choiceRows = [];

    let radioGroup: Gtk.CheckButton | null = null;
    for (const model of Models.catalog) {
      const details = [
        fmt(_("%s download"), Models.formatSize(model.sizeBytes)),
        ...(model.minMemoryGB > 0
          ? [fmt(_("needs %s GB of memory"), model.minMemoryGB)]
          : []),
      ];
      const row = new Adw.ActionRow({
        title: model.name,
        subtitle: `${_(model.description)}\n${details.join(" · ")}`,
      });

      const radio = new Gtk.CheckButton({
        valign: Gtk.Align.CENTER,
        active: model === this._chosenModel,
      });
      if (radioGroup) radio.set_group(radioGroup);
      else radioGroup = radio;
      radio.connect("toggled", () => {
        if (radio.get_active()) {
          this._chosenModel = model;
          this._updateDownloadButton();
        }
      });
      row.add_prefix(radio);
      row.set_activatable_widget(radio);

      if (model === this._suggestedModel) {
        const tag = new Gtk.Label({
          label: _("Recommended"),
          valign: Gtk.Align.CENTER,
        });
        tag.add_css_class("caption-heading");
        tag.add_css_class("accent");
        row.add_suffix(tag);
      }

      if (Models.isInstalled(model)) {
        const deleteButton = new Gtk.Button({
          icon_name: "user-trash-symbolic",
          tooltip_text: _("Delete Model"),
          valign: Gtk.Align.CENTER,
        });
        deleteButton.add_css_class("flat");
        deleteButton.connect(
          "clicked",
          () => void this._confirmDeleteModel(model),
        );
        row.add_suffix(deleteButton);
      }

      this._model_choice_group.add(row);
      this._choiceRows.push(row);
    }
  }

  private _showModelManager(): void {
    if (this._running) return;

    const hasModels = Models.installedModels().length > 0;
    if (!this._chosenModel || (this._activeModel && hasModels)) {
      this._chosenModel = this._activeModel ?? this._suggestedModel;
    }

    this._onboarding_title.set_label(
      hasModels ? _("Manage Models") : this._welcomeTitle,
    );
    this._onboarding_description.set_label(
      hasModels
        ? _(
            "Larger models translate better but need more memory and take longer. Models run entirely on your computer.",
          )
        : this._welcomeDescription,
    );
    this._rebuildModelChoices();
    this._updateDownloadButton();
    this._download_status.set_label("");

    this._back_button.set_visible(hasModels);
    this._main_stack.set_visible_child_name("onboarding");
  }

  private _showTranslator(): void {
    // The active model may have been deleted in the model manager.
    if (!this._activeModel) {
      const fallback = Models.installedModels()[0];
      if (fallback) this._activateModel(fallback);
    }

    this._back_button.set_visible(false);
    this._refreshModelRow();
    this._main_stack.set_visible_child_name("translate");
  }

  private async _onDownloadClicked(): Promise<void> {
    if (this._download) {
      this._download.cancel();
      return;
    }

    const model = this._chosenModel;
    if (!model) return;

    if (!Models.isInstalled(model)) {
      const cancellable = new Gio.Cancellable();
      this._download = cancellable;
      this._model_choice_group.set_sensitive(false);
      this._back_button.set_sensitive(false);
      this._download_progress.set_fraction(0);
      this._download_progress.set_text(null);
      this._download_progress.set_visible(true);
      this._updateDownloadButton();

      try {
        await Models.downloadModel(
          model,
          (phase, done, total) => {
            this._download_status.set_label(
              phase === "verifying"
                ? _("Checking the download…")
                : fmt(_("Downloading %s…"), model.name),
            );
            this._download_progress.set_fraction(total > 0 ? done / total : 0);
            this._download_progress.set_text(
              fmt(
                _("%s of %s"),
                Models.formatSize(done),
                Models.formatSize(total),
              ),
            );
          },
          cancellable,
        );
      } catch (e) {
        if (isDismissed(e)) {
          this._download_status.set_label(
            _("Download paused. It will resume where it left off."),
          );
        } else {
          console.error("Model download failed:", e);
          this._download_status.set_label(errorMessage(e));
        }
        return;
      } finally {
        this._download = null;
        this._model_choice_group.set_sensitive(true);
        this._back_button.set_sensitive(true);
        this._download_progress.set_visible(false);
        this._updateDownloadButton();
      }
    }

    this._activateModel(model);
    this._showTranslator();
  }

  private _showAboutDialog(): void {
    const dialog = new Adw.AboutDialog({
      application_icon: Config.APP_ID,
      application_name: GLib.get_application_name() ?? "",
      copyright: "© 2025 tduarte",
      developer_name: "tduarte",
      developers: ["tduarte https://github.com/tduarte"],
      issue_url: "https://github.com/tduarte/pipoca/issues",
      license: _(
        "This application comes with absolutely no warranty. See the <a href='https://blueoakcouncil.org/license/1.0.0'>Blue Oak Model License 1.0.0</a> for details.",
      ),
      translator_credits: _("translator-credits"),
      version: Config.VERSION,
    });

    dialog.present(this);
  }
}

export default MainWindow;
