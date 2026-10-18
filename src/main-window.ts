import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

import {gettext as _} from "gettext";

import Template from "./main-window.ui";
import * as Translator from "./translator";
import * as Models from "./models";
import {server} from "./llama-server";
import Gtk from "gi://Gtk";
import GLib from "gi://GLib";
import Gdk from "gi://Gdk";

const options = {
  GTypeName: "PipocaMainWindow", 
  Template,
  InternalChildren: [
    "drop-zone-button",
    "drop-zone-content",
    "drop-zone-icon",
    "drop-zone-label",
    "selected-file-display",
    "file-type-icon",
    "file-name-label",
    "change-file-button",
    "target-language-row", 
    "model-row",
    "manage-models-button",

    "translate-button",
    "progress-bar",
    "status-label",

    "main-stack",
    "back-button",
    "onboarding-icon",
    "onboarding-title",
    "onboarding-description",
    "model-choice-group",
    "download-button",
    "download-progress",
    "download-status"
  ]
};

class MainWindow extends Adw.ApplicationWindow {
  private readonly _settings = Gio.Settings.new(Config.APP_ID);
  private _showModelManager: (() => void) | null = null;

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
      {activate: this.showAboutDialog.bind(this), name: "show-about-dialog"},
      {activate: () => this._showModelManager?.(), name: "manage-models"},
    ]);
  }

  static {
    GObject.registerClass(options, this);
  }

  public override vfunc_close_request(): boolean {
    const [width, height] = this.get_default_size();
    this._settings.set_int("window-width", width);
    this._settings.set_int("window-height", height);

    this._settings.set_boolean("maximized", this.is_maximized());

    return super.vfunc_close_request();
  }

  public override vfunc_map(): void {
    super.vfunc_map();

    const dropZoneButton = (this as any)._drop_zone_button as Gtk.Button;
    const dropZoneContent = (this as any)._drop_zone_content as Gtk.Box;
    const dropZoneIcon = (this as any)._drop_zone_icon as Gtk.Image;
    const dropZoneLabel = (this as any)._drop_zone_label as Gtk.Label;
    const selectedFileDisplay = (this as any)._selected_file_display as Gtk.Box;
    const fileTypeIcon = (this as any)._file_type_icon as Gtk.Image;
    const fileNameLabel = (this as any)._file_name_label as Gtk.Label;
    const changeFileButton = (this as any)._change_file_button as Gtk.Button;
    const targetLangRow = (this as any)._target_language_row as Adw.ComboRow;
    const modelRow = (this as any)._model_row as Adw.ComboRow;
    const manageModelsButton = (this as any)._manage_models_button as Gtk.Button;

    const translateBtn = (this as any)._translate_button as Gtk.Button;
    const progressBar = (this as any)._progress_bar as Gtk.ProgressBar;
    const statusLabel = (this as any)._status_label as Gtk.Label;

    const mainStack = (this as any)._main_stack as Gtk.Stack;
    const backButton = (this as any)._back_button as Gtk.Button;
    const onboardingIcon = (this as any)._onboarding_icon as Gtk.Image;
    const onboardingTitle = (this as any)._onboarding_title as Gtk.Label;
    const onboardingDescription = (this as any)._onboarding_description as Gtk.Label;
    const modelChoiceGroup = (this as any)._model_choice_group as Adw.PreferencesGroup;
    const downloadButton = (this as any)._download_button as Gtk.Button;
    const downloadProgress = (this as any)._download_progress as Gtk.ProgressBar;
    const downloadStatus = (this as any)._download_status as Gtk.Label;

    let selectedFile: string | null = null;

    // Function to handle file selection and display
    const handleFileSelection = (filePath: string) => {
      selectedFile = filePath;
      const file = Gio.File.new_for_path(filePath);
      const fileName = file.get_basename() || "";
      
      // Determine appropriate icon for SRT files - use our custom icon
      const iconName = fileName.toLowerCase().endsWith('.srt') ? 'application-x-srt' : 'document-text-symbolic';
      
      // Truncate filename for display (first 20 chars + extension)
      let displayName = fileName;
      if (fileName.length > 25) {
        const lastDot = fileName.lastIndexOf('.');
        if (lastDot > 0) {
          const baseName = fileName.substring(0, lastDot);
          const extension = fileName.substring(lastDot);
          displayName = baseName.substring(0, 20) + "..." + extension;
        } else {
          displayName = fileName.substring(0, 20) + "...";
        }
      }
      
      // Update UI
      fileTypeIcon.set_from_icon_name(iconName);
      fileNameLabel.set_label(displayName);
      
      // Show selected file display, hide drop zone
      dropZoneButton.set_visible(false);
      selectedFileDisplay.set_visible(true);
      
      // Enable translate button
      translateBtn.set_sensitive(true);
    };

    // Function to show file dialog (portal-aware)
    const showFileDialog = () => {
      const dialog = new Gtk.FileDialog({title: _("Select Subtitle File")});

      // Add *.srt filter
      const srtFilter = new Gtk.FileFilter();
      srtFilter.set_name("SRT Files");
      srtFilter.add_pattern("*.srt");

      const filters = Gio.ListStore.new(Gtk.FileFilter.$gtype);
      filters.append(srtFilter);
      dialog.set_filters(filters);

      dialog.open(this, null, (_obj, res) => {
        try {
          const file = dialog.open_finish(res);
          const filePath = file?.get_path();
          if (filePath) {
            handleFileSelection(filePath);
          }
        } catch (e) {
          // Cancelled or failed; no-op
        }
      });
    };

    // Set up drag and drop for the drop zone
    const dropTarget = Gtk.DropTarget.new(Gio.File.$gtype, Gdk.DragAction.COPY);
    
    dropTarget.connect("drop", (target: Gtk.DropTarget, value: any, x: number, y: number) => {
      if (value instanceof Gio.File) {
        const filePath = value.get_path();
        if (filePath && filePath.toLowerCase().endsWith('.srt')) {
          handleFileSelection(filePath);
          return true;
        }
      }
      return false;
    });

    dropTarget.connect("enter", (target: Gtk.DropTarget, x: number, y: number) => {
      dropZoneButton.add_css_class("drop-active");
      return Gdk.DragAction.COPY;
    });

    dropTarget.connect("leave", (target: Gtk.DropTarget) => {
      dropZoneButton.remove_css_class("drop-active");
    });

    dropZoneButton.add_controller(dropTarget);

    // Add custom CSS for drop zone styling only
    const cssProvider = new Gtk.CssProvider();
    const cssData = `
      .drop-zone {
        border: 2px dashed alpha(@borders, 0.5);
        border-radius: 12px;
        transition: all 200ms ease;
      }
      
      .drop-zone:hover {
        border-color: @accent_color;
        background: alpha(@accent_color, 0.1);
      }
      
      .drop-zone.drop-active {
        border-color: @accent_color;
        background: alpha(@accent_color, 0.2);
        border-style: solid;
      }
    `;
    cssProvider.load_from_data(cssData, cssData.length);
    
    Gtk.StyleContext.add_provider_for_display(
      this.get_display(), 
      cssProvider, 
      Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    );

          // Populate target languages (21 most popular) with language codes for file naming, sorted alphabetically by language name
      const popularLanguages: Translator.Language[] = [
        {code: "ar", flag: "🇸🇦", name: "Arabic"},
        {code: "bn", flag: "🇧🇩", name: "Bengali"},
        {code: "zh", flag: "🇨🇳", name: "Chinese"},
        {code: "nl", flag: "🇳🇱", name: "Dutch"},
        {code: "en", flag: "🇺🇸", name: "English"},
        {code: "fr", flag: "🇫🇷", name: "French"},
        {code: "de", flag: "🇩🇪", name: "German"},
        {code: "el", flag: "🇬🇷", name: "Greek"},
        {code: "hi", flag: "🇮🇳", name: "Hindi"},
        {code: "it", flag: "🇮🇹", name: "Italian"},
        {code: "ja", flag: "🇯🇵", name: "Japanese"},
        {code: "ko", flag: "🇰🇷", name: "Korean"},
        {code: "pl", flag: "🇵🇱", name: "Polish"},
        {code: "pt", flag: "🇵🇹", name: "Portuguese"},
        {code: "pt-BR", flag: "🇧🇷", name: "Portuguese (Brazil)"},
        {code: "ru", flag: "🇷🇺", name: "Russian"},
        {code: "es", flag: "🇪🇸", name: "Spanish"},
        {code: "th", flag: "🇹🇭", name: "Thai"},
        {code: "tr", flag: "🇹🇷", name: "Turkish"},
        {code: "uk", flag: "🇺🇦", name: "Ukrainian"},
        {code: "vi", flag: "🇻🇳", name: "Vietnamese"}
      ];

    // Only offer languages the active model can translate into
    let visibleLanguages = popularLanguages;
    const selectedLanguage = () => visibleLanguages[targetLangRow.get_selected()];

    const refreshLanguages = () => {
      const current = selectedLanguage()?.code ?? "en";
      visibleLanguages = popularLanguages.filter(
        ({code}) => !activeModel || Models.supportsLanguage(activeModel, code),
      );

      // Create string list for Adw.ComboRow
      const languageStringList = Gtk.StringList.new(null);
      for (const {flag, name} of visibleLanguages) {
        languageStringList.append(`${flag}  ${name}`);
      }
      targetLangRow.set_model(languageStringList);

      // Keep the current choice if possible, otherwise default to English
      const index = visibleLanguages.findIndex(({code}) => code === current);
      targetLangRow.set_selected(index >= 0 ? index : visibleLanguages.findIndex(({code}) => code === "en"));
    };



    // Connect drop zone button click to file dialog
    dropZoneButton.connect("clicked", showFileDialog);
    
    // Connect change file button to file dialog  
    changeFileButton.connect("clicked", showFileDialog);

    // State to track translation status
    let translationOutput: string | null = null;
    let isTranslated = false;
    let isTranslating = false;
    let translationCancellation: Translator.TranslationCancellation | null = null;

    const updateButtonState = () => {
      if (isTranslating) {
        translateBtn.set_label("Stop Translation");
        translateBtn.remove_css_class("suggested-action");
        translateBtn.remove_css_class("success");
        translateBtn.add_css_class("destructive-action");
      } else if (isTranslated && translationOutput) {
        translateBtn.set_label("Save Translation");
        translateBtn.remove_css_class("suggested-action");
        translateBtn.remove_css_class("destructive-action");
        translateBtn.add_css_class("success");
      } else {
        translateBtn.set_label("Start Translation");
        translateBtn.remove_css_class("success");
        translateBtn.remove_css_class("destructive-action");
        translateBtn.add_css_class("suggested-action");
      }

      // Keep the model fixed while a translation runs.
      modelRow.set_sensitive(!isTranslating);
      manageModelsButton.set_sensitive(!isTranslating);
    };

    // Model management: onboarding, downloads and the engine
    let activeModel: Models.CatalogModel | null = null;
    let chosenModel: Models.CatalogModel | undefined = Models.suggestedModel();
    let downloadCancellable: Gio.Cancellable | null = null;
    let choiceRows: Adw.ActionRow[] = [];
    let installedList: Models.CatalogModel[] = [];
    let updatingModelRow = false;

    const welcomeTitle = onboardingTitle.get_label();
    const welcomeDescription = onboardingDescription.get_label();
    onboardingIcon.set_from_icon_name(Config.APP_ID);

    const memoryGB = Math.round(Models.totalMemoryGB());
    const suggested = Models.suggestedModel();
    if (memoryGB > 0 && suggested) {
      modelChoiceGroup.set_description(
        `This computer has ${memoryGB} GB of memory. We recommend ${suggested.name}.`,
      );
    }

    const activateModel = (model: Models.CatalogModel) => {
      activeModel = model;
      this._settings.set_string("model-id", model.id);
      refreshLanguages();
      statusLabel.set_label(`Loading ${model.name}...`);

      // Warm up the engine so the first translation starts right away.
      server.ensureRunning(Models.modelPath(model)).then(() => {
        if (activeModel === model && !isTranslating) {
          statusLabel.set_label(`Ready to translate with ${model.name}`);
        }
      }).catch((e: unknown) => {
        if (activeModel === model) {
          statusLabel.set_label(`Could not load ${model.name}: ${e instanceof Error ? e.message : e}`);
        }
      });
    };

    const refreshModelRow = () => {
      installedList = Models.installedModels();
      const modelStringList = Gtk.StringList.new(null);
      for (const model of installedList) {
        modelStringList.append(model.name);
      }

      updatingModelRow = true;
      modelRow.set_model(modelStringList);
      const index = activeModel ? installedList.indexOf(activeModel) : -1;
      if (index >= 0) modelRow.set_selected(index);
      updatingModelRow = false;

      modelRow.set_subtitle(activeModel?.description ?? "");
    };

    modelRow.connect("notify::selected", () => {
      if (updatingModelRow) return;
      const model = installedList[modelRow.get_selected()];
      if (model && model !== activeModel) {
        activateModel(model);
        modelRow.set_subtitle(model.description);
      }
    });

    const updateDownloadButton = () => {
      downloadButton.remove_css_class("suggested-action");
      downloadButton.remove_css_class("destructive-action");
      downloadButton.set_sensitive(chosenModel !== undefined);

      if (downloadCancellable) {
        downloadButton.set_label("Cancel Download");
        downloadButton.add_css_class("destructive-action");
      } else if (chosenModel && Models.isInstalled(chosenModel)) {
        downloadButton.set_label("Use This Model");
        downloadButton.add_css_class("suggested-action");
      } else {
        const size = chosenModel ? ` (${Models.formatSize(chosenModel.sizeBytes)})` : "";
        downloadButton.set_label(`Download Model${size}`);
        downloadButton.add_css_class("suggested-action");
      }
    };

    const confirmDelete = (model: Models.CatalogModel) => {
      const dialog = new Adw.AlertDialog({
        heading: `Delete ${model.name}?`,
        body: `This frees ${Models.formatSize(model.sizeBytes)} of disk space. You can download the model again later.`,
      });
      dialog.add_response("cancel", "Cancel");
      dialog.add_response("delete", "Delete");
      dialog.set_response_appearance("delete", Adw.ResponseAppearance.DESTRUCTIVE);
      dialog.connect("response", (_dialog: Adw.AlertDialog, response: string) => {
        if (response !== "delete") return;
        if (model === activeModel) {
          server.stop();
          activeModel = null;
          this._settings.set_string("model-id", "");
        }
        Models.deleteModel(model);
        showModelManager();
      });
      dialog.present(this);
    };

    const rebuildModelChoices = () => {
      for (const row of choiceRows) modelChoiceGroup.remove(row);
      choiceRows = [];

      let radioGroup: Gtk.CheckButton | null = null;
      for (const model of Models.catalog) {
        const row = new Adw.ActionRow({
          title: model.name,
          subtitle: `${model.description}\n${Models.formatSize(model.sizeBytes)} download${
            model.minMemoryGB > 0 ? ` · needs ${model.minMemoryGB} GB of memory` : ""
          }`,
        });

        const radio = new Gtk.CheckButton({valign: Gtk.Align.CENTER, active: model === chosenModel});
        if (radioGroup) radio.set_group(radioGroup);
        else radioGroup = radio;
        radio.connect("toggled", () => {
          if (radio.get_active()) {
            chosenModel = model;
            updateDownloadButton();
          }
        });
        row.add_prefix(radio);
        row.set_activatable_widget(radio);

        if (model === suggested) {
          const tag = new Gtk.Label({label: "Recommended", valign: Gtk.Align.CENTER});
          tag.add_css_class("caption-heading");
          tag.add_css_class("accent");
          row.add_suffix(tag);
        }

        if (Models.isInstalled(model)) {
          const deleteButton = new Gtk.Button({
            icon_name: "user-trash-symbolic",
            tooltip_text: "Delete Model",
            valign: Gtk.Align.CENTER,
          });
          deleteButton.add_css_class("flat");
          deleteButton.connect("clicked", () => confirmDelete(model));
          row.add_suffix(deleteButton);
        }

        modelChoiceGroup.add(row);
        choiceRows.push(row);
      }
    };

    const showModelManager = () => {
      const hasModels = Models.installedModels().length > 0;
      if (!chosenModel || (activeModel && hasModels)) chosenModel = activeModel ?? suggested;

      onboardingTitle.set_label(hasModels ? "Manage Models" : welcomeTitle);
      onboardingDescription.set_label(
        hasModels
          ? "Larger models translate better but need more memory and take longer. Models run entirely on your computer."
          : welcomeDescription,
      );
      rebuildModelChoices();
      updateDownloadButton();
      downloadStatus.set_label("");

      backButton.set_visible(hasModels);
      mainStack.set_visible_child_name("onboarding");
    };
    this._showModelManager = () => {
      if (!isTranslating) showModelManager();
    };

    const showTranslator = () => {
      // The active model may have been deleted in the model manager.
      if (!activeModel) {
        const fallback = Models.installedModels()[0];
        if (fallback) activateModel(fallback);
      }

      backButton.set_visible(false);
      refreshModelRow();
      mainStack.set_visible_child_name("translate");
    };

    backButton.connect("clicked", () => {
      if (!downloadCancellable) showTranslator();
    });
    manageModelsButton.connect("clicked", () => this._showModelManager?.());

    downloadButton.connect("clicked", async () => {
      if (downloadCancellable) {
        downloadCancellable.cancel();
        return;
      }

      const model = chosenModel;
      if (!model) return;

      if (!Models.isInstalled(model)) {
        downloadCancellable = new Gio.Cancellable();
        modelChoiceGroup.set_sensitive(false);
        backButton.set_sensitive(false);
        downloadProgress.set_fraction(0);
        downloadProgress.set_text(null);
        downloadProgress.set_visible(true);
        downloadStatus.set_label(`Downloading ${model.name}...`);
        updateDownloadButton();

        try {
          await Models.downloadModel(model, (received, total) => {
            downloadProgress.set_fraction(total > 0 ? received / total : 0);
            downloadProgress.set_text(`${Models.formatSize(received)} of ${Models.formatSize(total)}`);
          }, downloadCancellable);
        } catch (e) {
          if (e instanceof GLib.Error && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
            downloadStatus.set_label("Download paused. It will resume where it left off.");
          } else {
            console.error("Model download failed:", e);
            downloadStatus.set_label(e instanceof Error || e instanceof GLib.Error ? e.message : String(e));
          }
          return;
        } finally {
          downloadCancellable = null;
          modelChoiceGroup.set_sensitive(true);
          backButton.set_sensitive(true);
          downloadProgress.set_visible(false);
          updateDownloadButton();
        }
      }

      activateModel(model);
      showTranslator();
    });

    const savedModel = Models.getModel(this._settings.get_string("model-id"));
    const initialModel = savedModel && Models.isInstalled(savedModel) ? savedModel : Models.installedModels()[0];
    if (initialModel) {
      activateModel(initialModel);
      showTranslator();
    } else {
      refreshLanguages();
      showModelManager();
    }


    translateBtn.connect("clicked", async () => {
      if (!selectedFile) return;
      
      if (isTranslating) {
        // Stop mode - cancel translation
        if (translationCancellation) {
          translationCancellation.cancel();
          statusLabel.set_label("Stopping translation...");
        }
        return;
      }
      
      if (isTranslated && translationOutput) {
        // Save mode - show save dialog
        const langCode = selectedLanguage()?.code || "en";
        const inputFile = Gio.File.new_for_path(selectedFile);
        const inputBasename = inputFile.get_basename() || "";
        
        // Generate suggested filename
        const lastDot = inputBasename.lastIndexOf('.');
        let suggestedName = inputBasename;
        if (lastDot > 0) {
          const baseName = inputBasename.substring(0, lastDot);
          const extension = inputBasename.substring(lastDot);
          suggestedName = `${baseName}.${langCode}${extension}`;
        } else {
          suggestedName = `${inputBasename}.${langCode}`;
        }
        
        const saveDialog = new Gtk.FileDialog({title: _("Save Translation")});
        saveDialog.set_initial_name(suggestedName);

        saveDialog.save(this, null, (_obj, res) => {
          try {
            const file = saveDialog.save_finish(res);
            if (file && translationOutput) {
              const outputData = new TextEncoder().encode(translationOutput);
              file.replace_contents(outputData, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
              statusLabel.set_label(`Translation saved as ${file.get_basename()}`);

              // Reset state for new translation
              translationOutput = null;
              isTranslated = false;
              isTranslating = false;
              translationCancellation = null;
              updateButtonState();
            }
          } catch (e) {
            // Cancelled or failed
            statusLabel.set_label(typeof e === 'string' ? e : `Error saving file`);
          }
        });
      } else {
        // Translate mode - start translation
        const targetLang = selectedLanguage();
        const model = activeModel;
        if (!model || !targetLang) {
          showModelManager();
          return;
        }

        // Start translation
        isTranslating = true;
        translationCancellation = new Translator.TranslationCancellation();
        updateButtonState();

        progressBar.set_visible(true);
        statusLabel.set_label(`Loading ${model.name}...`);

        try {
          const output = await Translator.translateSrtFile(selectedFile, targetLang, model, (done, total) => {
            progressBar.set_fraction(done / total);
            statusLabel.set_label(`Translating ${done}/${total} subtitles...`);
          }, translationCancellation);

          // Translation complete - update state
          translationOutput = output;
          isTranslated = true;
          isTranslating = false;
          translationCancellation = null;
          updateButtonState();
          
          progressBar.set_visible(false);
          statusLabel.set_label("Translation complete! Click 'Save Translation' to save your file.");
        } catch (e) {
          // Handle cancellation or error
          isTranslating = false;
          translationCancellation = null;
          updateButtonState();
          
          if (e instanceof Error && e.message.includes("cancelled")) {
            statusLabel.set_label("Translation was stopped.");
          } else {
            statusLabel.set_label(`Translation error: ${e}`);
          }
          progressBar.set_visible(false);
        }
      }
    });
  }

  private showAboutDialog(): void {
    const dialog = new Adw.AboutDialog({
      applicationIcon: Config.APP_ID,
      applicationName: GLib.get_application_name() ?? "",
      copyright: "© 2025 tduarte",
      developerName: "tduarte",
      developers: ["tduarte https://github.com/tduarte"],
      issueUrl: "https://github.com/tduarte/pipoca/issues",
      license: _(
        "This application comes with absolutely no warranty. See the <a href='https://blueoakcouncil.org/license/1.0.0'>Blue Oak Model License 1.0.0</a> for details.",
      ),
      translatorCredits: _("translator-credits"),
      version: Config.VERSION,
    });

    dialog.present(this);
  }
}

export default MainWindow;
