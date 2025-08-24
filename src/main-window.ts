import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";

import {gettext as _} from "gettext";

import Template from "./main-window.ui";
import * as Translator from "./translator";
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

    "translate-button",
    "progress-bar",
    "status-label",
    "model-info-group",
    "model-name-row",
    "model-size-row"
  ]
};

class MainWindow extends Adw.ApplicationWindow {
  private readonly _settings = Gio.Settings.new(Config.APP_ID);

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

    const translateBtn = (this as any)._translate_button as Gtk.Button;
    const progressBar = (this as any)._progress_bar as Gtk.ProgressBar;
    const statusLabel = (this as any)._status_label as Gtk.Label;
    const modelInfoGroup = (this as any)._model_info_group as Adw.PreferencesGroup;
    const modelNameRow = (this as any)._model_name_row as Adw.ActionRow;
    const modelSizeRow = (this as any)._model_size_row as Adw.ActionRow;

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

    // Function to show file dialog
    const showFileDialog = () => {
      const dialog = new Gtk.FileChooserNative({
        transient_for: this,
        action: Gtk.FileChooserAction.OPEN,
        accept_label: "Select",
        cancel_label: "Cancel",
      });

      const filter = new Gtk.FileFilter();
      filter.set_name("SRT Files");
      filter.add_pattern("*.srt");
      dialog.add_filter(filter);

      dialog.connect("response", (dialog: Gtk.FileChooserNative, response_id: number) => {
        if (response_id === Gtk.ResponseType.ACCEPT) {
          const file = dialog.get_file();
          if (file) {
            const filePath = file.get_path();
            if (filePath) {
              handleFileSelection(filePath);
            }
          }
        }
        dialog.destroy();
      });

      dialog.show();
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

    // Populate target languages (20 most popular) with language codes for file naming
    const popularLanguages = [
      ["en", "English"],
      ["es", "Spanish"], 
      ["zh", "Chinese"],
      ["hi", "Hindi"],
      ["ar", "Arabic"],
      ["pt", "Portuguese"],
      ["bn", "Bengali"],
      ["ru", "Russian"],
      ["ja", "Japanese"],
      ["fr", "French"],
      ["de", "German"],
      ["ko", "Korean"],
      ["it", "Italian"],
      ["tr", "Turkish"],
      ["vi", "Vietnamese"],
      ["pl", "Polish"],
      ["uk", "Ukrainian"],
      ["nl", "Dutch"],
      ["th", "Thai"],
      ["el", "Greek"]
    ];

    // Create string list for Adw.ComboRow
    const languageStringList = Gtk.StringList.new(null);
    for (const [code, name] of popularLanguages) {
      languageStringList.append(name || "");
    }
    targetLangRow.set_model(languageStringList);
    targetLangRow.set_selected(0); // Default to English



    // Connect drop zone button click to file dialog
    dropZoneButton.connect("clicked", showFileDialog);
    
    // Connect change file button to file dialog  
    changeFileButton.connect("clicked", showFileDialog);

    // populate models
    statusLabel.set_label("Loading models...");
    let allModels: Array<{name: string; size?: string; display?: string}> = [];
    
    (async () => {
      try {
        const installed = await Translator.listInstalledModels();
        console.log("Installed models:", installed);
        
        // Use only installed models
        allModels = [...installed];

        // Create string list for models
        const modelStringList = Gtk.StringList.new(null);
        for (const model of allModels) {
          const displayText = model.name + (model.size ? ` (${model.size})` : "");
          modelStringList.append(displayText);
        }
        
        modelRow.set_model(modelStringList);
        if (allModels.length > 0) {
          modelRow.set_selected(0);
        }
        
        statusLabel.set_label(`Found ${installed.length} installed models`);
      } catch (error) {
        console.error("Error loading models:", error);
        statusLabel.set_label("Error loading models. Is Ollama running?");
      }
    })();

    // Update model info when selection changes
    const updateModelInfo = async () => {
      const selectedIndex = modelRow.get_selected();
      const selectedModel = allModels[selectedIndex];
      
      if (selectedModel) {
        modelNameRow.set_subtitle(selectedModel.name);
        modelSizeRow.set_subtitle(selectedModel.size || "Unknown");
        modelInfoGroup.set_visible(true);
        
        // Use the size info we already have from the models list
        modelSizeRow.set_subtitle(selectedModel.size || "Unknown");
      } else {
        modelInfoGroup.set_visible(false);
      }
    };
    
    modelRow.connect("notify::selected", updateModelInfo);

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
    };

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
        const selectedLangIndex = targetLangRow.get_selected();
        const langCode = popularLanguages[selectedLangIndex]?.[0] || "en";
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
        
        const saveDialog = new Gtk.FileChooserNative({
          transient_for: this,
          action: Gtk.FileChooserAction.SAVE,
          accept_label: "Save",
          cancel_label: "Cancel",
        });
        saveDialog.set_current_name(suggestedName);
        
        saveDialog.connect("response", (dialog: Gtk.FileChooserNative, response_id: number) => {
          if (response_id === Gtk.ResponseType.ACCEPT) {
            const file = dialog.get_file();
            if (file && translationOutput) {
              try {
                const outputData = new TextEncoder().encode(translationOutput);
                file.replace_contents(outputData, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                statusLabel.set_label(`Translation saved as ${file.get_basename()}`);
                
                // Reset state for new translation
                translationOutput = null;
                isTranslated = false;
                isTranslating = false;
                translationCancellation = null;
                updateButtonState();
              } catch (e) {
                statusLabel.set_label(`Error saving file: ${e}`);
              }
            }
          }
          dialog.destroy();
        });
        
        saveDialog.show();
      } else {
        // Translate mode - start translation
        const selectedLangIndex = targetLangRow.get_selected();
        const targetLang = popularLanguages[selectedLangIndex]?.[1] || "English";
        const langCode = popularLanguages[selectedLangIndex]?.[0] || "en";
        
        const selectedModelIndex = modelRow.get_selected();
        const model = allModels[selectedModelIndex]?.name || "llama3.2:latest";

        // Start translation
        isTranslating = true;
        translationCancellation = new Translator.TranslationCancellation();
        updateButtonState();

        progressBar.set_visible(true);
        statusLabel.set_label("Translating...");

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
