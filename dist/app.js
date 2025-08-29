// src/app.ts
import Adw2 from "gi://Adw";
import GLib3 from "gi://GLib";
import GObject2 from "gi://GObject";

// src/main-window.ts
import Adw from "gi://Adw";
import Gio2 from "gi://Gio";
import GObject from "gi://GObject";
import { gettext as _ } from "gettext";

// src/main-window.ui
var main_window_default = '<?xml version="1.0" encoding="UTF-8"?>\n<interface>\n  <template class="PipocaMainWindow" parent="AdwApplicationWindow">\n    <property name="default-height">400</property>\n    <property name="default-width">600</property>\n\n    <property name="content">\n      <object class="GtkOverlay">\n        <child>\n          <object class="AdwToolbarView">\n            <child type="top">\n              <object class="AdwHeaderBar">\n                <child type="end">\n                  <object class="GtkMenuButton">\n                    <property name="direction">none</property>\n                    <property name="menu-model">primary-menu</property>\n                    <property name="primary">yes</property>\n                  </object>\n                </child>\n              </object>\n            </child>\n\n            <property name="content">\n          <object class="AdwClamp">\n            <property name="maximum-size">600</property>\n            <property name="margin-top">24</property>\n            <property name="margin-bottom">24</property>\n            <property name="margin-start">24</property>\n            <property name="margin-end">24</property>\n            \n            <child>\n              <object class="GtkBox">\n                <property name="orientation">vertical</property>\n                <property name="spacing">24</property>\n                \n                <!-- File Selection Card -->\n                <child>\n                  <object class="AdwPreferencesGroup">\n                    <property name="title" translatable="yes">Source File</property>\n                    <child>\n                      <object class="GtkBox">\n                        <property name="orientation">vertical</property>\n                        <property name="spacing">12</property>\n                        <property name="margin-top">12</property>\n                        <property name="margin-bottom">12</property>\n                        <property name="margin-start">12</property>\n                        <property name="margin-end">12</property>\n                        \n                        <!-- Drop Zone -->\n                        <child>\n                          <object class="GtkButton" id="drop-zone-button">\n                            <property name="height-request">120</property>\n                            <property name="hexpand">true</property>\n                            <style>\n                              <class name="card" />\n                              <class name="drop-zone" />\n                            </style>\n                            \n                            <child>\n                              <object class="GtkBox" id="drop-zone-content">\n                                <property name="orientation">vertical</property>\n                                <property name="spacing">8</property>\n                                <property name="halign">center</property>\n                                <property name="valign">center</property>\n                                \n                                <child>\n                                  <object class="GtkImage" id="drop-zone-icon">\n                                    <property name="icon-name">folder-download-symbolic</property>\n                                    <property name="pixel-size">48</property>\n                                    <style>\n                                      <class name="dim-label" />\n                                    </style>\n                                  </object>\n                                </child>\n                                \n                                <child>\n                                  <object class="GtkLabel" id="drop-zone-label">\n                                    <property name="label" translatable="yes">Drop .srt file here or click to select</property>\n                                    <property name="wrap">true</property>\n                                    <property name="justify">center</property>\n                                    <style>\n                                      <class name="dim-label" />\n                                    </style>\n                                  </object>\n                                </child>\n                              </object>\n                            </child>\n                          </object>\n                        </child>\n                        \n                        <!-- Selected File Display -->\n                        <child>\n                          <object class="GtkBox" id="selected-file-display">\n                            <property name="orientation">vertical</property>\n                            <property name="spacing">8</property>\n                            <property name="halign">center</property>\n                            <property name="visible">false</property>\n                            \n                            <child>\n                              <object class="GtkImage" id="file-type-icon">\n                                <property name="icon-name">application-x-srt</property>\n                                <property name="pixel-size">64</property>\n                              </object>\n                            </child>\n                            \n                            <child>\n                              <object class="GtkLabel" id="file-name-label">\n                                <property name="label" translatable="yes">filename.srt</property>\n                                <property name="wrap">true</property>\n                                <property name="justify">center</property>\n                                <style>\n                                  <class name="title-2" />\n                                </style>\n                              </object>\n                            </child>\n                            \n                            <child>\n                              <object class="GtkButton" id="change-file-button">\n                                <property name="label" translatable="yes">Change File</property>\n                                <property name="halign">center</property>\n                                <style>\n                                  <class name="pill" />\n                                </style>\n                              </object>\n                            </child>\n                          </object>\n                        </child>\n                      </object>\n                    </child>\n                  </object>\n                </child>\n\n                <!-- Translation Settings Card -->\n                <child>\n                  <object class="AdwPreferencesGroup">\n                    <property name="title" translatable="yes">Translation Settings</property>\n                    <child>\n                      <object class="AdwComboRow" id="target-language-row">\n                        <property name="title" translatable="yes">Target Language</property>\n                        <property name="subtitle" translatable="yes">Language to translate subtitles to</property>\n                      </object>\n                    </child>\n                    <child>\n                      <object class="AdwComboRow" id="model-row">\n                        <property name="title" translatable="yes">AI Model</property>\n                        <property name="subtitle" translatable="yes">Choose the model for translation</property>\n                      </object>\n                    </child>\n\n                  </object>\n                </child>\n\n                <!-- Model Information Card -->\n                <child>\n                  <object class="AdwPreferencesGroup" id="model-info-group">\n                    <property name="title" translatable="yes">Model Information</property>\n                    <property name="visible">false</property>\n                    <child>\n                      <object class="AdwActionRow" id="model-name-row">\n                        <property name="title" translatable="yes">Model Name</property>\n                        <child type="prefix">\n                          <object class="GtkImage">\n                            <property name="icon-name">computer-symbolic</property>\n                          </object>\n                        </child>\n                      </object>\n                    </child>\n                    <child>\n                      <object class="AdwActionRow" id="model-size-row">\n                        <property name="title" translatable="yes">Model Size</property>\n                        <child type="prefix">\n                          <object class="GtkImage">\n                            <property name="icon-name">drive-harddisk-symbolic</property>\n                          </object>\n                        </child>\n                      </object>\n                    </child>\n                    <child>\n                      <object class="AdwActionRow" id="model-recommendation-row">\n                        <property name="title" translatable="yes">Recommended</property>\n                        <child type="prefix">\n                          <object class="GtkImage">\n                            <property name="icon-name">starred-symbolic</property>\n                          </object>\n                        </child>\n                        <child type="suffix">\n                          <object class="GtkImage" id="model-recommendation-icon">\n                            <property name="icon-name">dialog-question-symbolic</property>\n                            <property name="pixel-size">16</property>\n                          </object>\n                        </child>\n                      </object>\n                    </child>\n                  </object>\n                </child>\n\n                <!-- Action Button -->\n                <child>\n                  <object class="GtkButton" id="translate-button">\n                    <property name="label" translatable="yes">Start Translation</property>\n                    <style>\n                      <class name="pill" />\n                      <class name="suggested-action" />\n                    </style>\n                  </object>\n                </child>\n\n                <!-- Progress Display -->\n                <child>\n                  <object class="GtkBox">\n                    <property name="orientation">vertical</property>\n                    <property name="spacing">6</property>\n                    \n                    <child>\n                      <object class="GtkProgressBar" id="progress-bar">\n                        <property name="visible">false</property>\n                      </object>\n                    </child>\n\n                    <child>\n                      <object class="GtkLabel" id="status-label">\n                        <property name="label" translatable="yes">Ready</property>\n                        <style>\n                          <class name="dim-label" />\n                        </style>\n                      </object>\n                    </child>\n                  </object>\n                </child>\n\n                <!-- Primary Menu -->\n                <child>\n                  <object class="GtkPopoverMenu" id="primary-menu">\n                    <property name="menu-model">primary-menu</property>\n                  </object>\n                </child>\n              </object>\n            </child>\n          </object>\n            </property>\n          </object>\n        </child>\n      </object>\n    </property>\n  </template>\n  \n  <menu id="primary-menu">\n    <section>\n      <item>\n        <attribute name="label" translatable="yes">_About</attribute>\n        <attribute name="action">app.show-about-dialog</attribute>\n      </item>\n    </section>\n  </menu>\n</interface>\n';

// src/translator.ts
import Gio from "gi://Gio";
import Soup from "gi://Soup";
import GLib from "gi://GLib";
var modelRecommendations = {
  "llama3.2:latest": true,
  "llama3.1:latest": true,
  "llama3:latest": true,
  "qwen2.5:latest": true,
  "qwen2:latest": true,
  "gemma2:latest": true,
  "gemma3n:latest": true,
  "mistral:latest": true,
  "command-r:latest": true,
  "aya:latest": true,
  "codellama:latest": false,
  "code-llama:latest": false,
  "deepseek-coder:latest": false,
  "magicoder:latest": false,
  "phind-codellama:latest": false,
  "starcoder:latest": false,
  "wizardcoder:latest": false,
  "sqlcoder:latest": false,
  "stable-code:latest": false,
  "codegemma:latest": false
};
function getModelRecommendation(modelName) {
  const normalizedName = modelName.toLowerCase();
  if (modelRecommendations.hasOwnProperty(normalizedName)) {
    return modelRecommendations[normalizedName] ? "recommended" : "not-recommended";
  }
  for (const [key, recommended] of Object.entries(modelRecommendations)) {
    const baseKey = key.replace(":latest", "");
    if (normalizedName.startsWith(baseKey)) {
      return recommended ? "recommended" : "not-recommended";
    }
  }
  const codingKeywords = ["code", "coder", "sql", "programming"];
  if (codingKeywords.some((keyword) => normalizedName.includes(keyword))) {
    return "not-recommended";
  }
  return "unknown";
}
function parseSrt(content) {
  const parts = content.split(/\r?\n\r?\n/);
  const subs = [];
  for (const part of parts) {
    const lines = part.split(/\r?\n/).filter(Boolean);
    if (lines.length >= 3) {
      const [indexLine, ...rest] = lines;
      const index = Number.parseInt(indexLine, 10);
      const slice = rest;
      const times = slice[0];
      const textLines = slice.slice(1);
      const timeSplit = times.split(" --> ");
      if (timeSplit.length !== 2) continue;
      const [start, end] = timeSplit;
      subs.push({ index, start, end, text: textLines.join(" ") });
    }
  }
  return subs;
}
function buildSrt(subs) {
  return subs.map((s) => `${s.index}\n${s.start} --> ${s.end}\n${s.text}\n`).join("\n");
}
async function callOllama(model, prompt) {
  const session = new Soup.Session();
  const data = JSON.stringify({ model, prompt, stream: false });
  const url = "http://127.0.0.1:11434/api/generate";
  console.log(`Calling Ollama at: ${url} with model: ${model}`);
  const message = Soup.Message.new("POST", url);
  const headers = message.get_request_headers();
  headers.append("Content-Type", "application/json");
  const bytes = GLib.Bytes.new(new TextEncoder().encode(data));
  message.set_request_body_from_bytes("application/json", bytes);
  return new Promise((resolve, reject) => {
    session.send_async(message, GLib.PRIORITY_DEFAULT, null, (_session, result) => {
      try {
        const inputStream = session?.send_finish(result);
        if (!inputStream) {
          reject(new Error("Failed to get response from Ollama"));
          return;
        }
        const statusCode = message.get_status();
        console.log(`HTTP Status: ${statusCode}`);
        if (statusCode !== 200) {
          reject(new Error(`HTTP error: ${statusCode}`));
          return;
        }
        const bufferedInputStream = Gio.BufferedInputStream.new(inputStream);
        let responseText = "";
        const readNext = () => {
          bufferedInputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, (stream, result2) => {
            try {
              const bytes2 = stream?.read_bytes_finish(result2);
              if (bytes2 && bytes2.get_size() > 0) {
                const chunk = new TextDecoder().decode(bytes2.get_data());
                responseText += chunk;
                readNext();
              } else {
                console.log("Ollama generate response:", responseText);
                if (responseText.trim()) {
                  try {
                    const parsed = JSON.parse(responseText);
                    if (parsed && parsed.response) {
                      resolve(parsed.response);
                    } else {
                      resolve(responseText.trim());
                    }
                  } catch (e) {
                    resolve(responseText.trim());
                  }
                } else {
                  reject(new Error("Empty response from Ollama"));
                }
              }
            } catch (e) {
              reject(e);
            }
          });
        };
        readNext();
      } catch (e) {
        reject(e);
      }
    });
  });
}
var TranslationCancellation = class {
  _cancelled = false;
  cancel() {
    this._cancelled = true;
  }
  get isCancelled() {
    return this._cancelled;
  }
};
async function translateSrtFile(filePath, targetLanguage, model, onProgress, cancellation) {
  const file = Gio.File.new_for_path(filePath);
  const [, contents] = file.load_contents(null);
  const content = new TextDecoder().decode(contents);
  const subs = parseSrt(content);
  const total = subs.length;
  const translated = [];
  for (const [i, s] of subs.entries()) {
    if (cancellation?.isCancelled) {
      throw new Error("Translation was cancelled");
    }
    const prompt = `Translate the following subtitle text to ${targetLanguage} without changing timing. Respond with only the translated text: ${s.text}`;
    const out = await callOllama(model, prompt);
    translated.push({ index: s.index, start: s.start, end: s.end, text: out.trim() });
    onProgress?.(i + 1, total);
  }
  return buildSrt(translated);
}
async function listInstalledModels() {
  const session = new Soup.Session();
  const urls = ["http://127.0.0.1:11434/api/tags", "http://localhost:11434/api/tags"];
  for (const url of urls) {
    console.log(`Trying to connect to: ${url}`);
    const message = Soup.Message.new("GET", url);
    const result = await new Promise((resolve) => {
      session.send_async(message, GLib.PRIORITY_DEFAULT, null, (_session, result2) => {
        try {
          const inputStream = session?.send_finish(result2);
          if (!inputStream) {
            console.error(`Failed to get input stream from ${url}`);
            resolve([]);
            return;
          }
          const statusCode = message.get_status();
          console.log(`HTTP Status for ${url}: ${statusCode}`);
          if (statusCode !== 200) {
            console.error(`HTTP error: ${statusCode}`);
            resolve([]);
            return;
          }
          const bufferedInputStream = Gio.BufferedInputStream.new(inputStream);
          const readAllData = () => {
            let responseText = "";
            const readNext = () => {
              bufferedInputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, (stream, result3) => {
                try {
                  const bytes = stream?.read_bytes_finish(result3);
                  if (bytes && bytes.get_size() > 0) {
                    const chunk = new TextDecoder().decode(bytes.get_data());
                    responseText += chunk;
                    readNext();
                  } else {
                    console.log(`Complete Ollama response from ${url}:`, responseText);
                    if (responseText.trim()) {
                      try {
                        const parsed = JSON.parse(responseText);
                        console.log(`Parsed response:`, parsed);
                        if (parsed && parsed.models) {
                          const models = parsed.models.map((m) => {
                            const model = {
                              name: m.name ?? m.model ?? m
                            };
                            if (m.size) {
                              model.size = `${Math.round(m.size / (1024 * 1024 * 1024))}GB`;
                            }
                            return model;
                          });
                          console.log(`Mapped models:`, models);
                          resolve(models);
                        } else if (Array.isArray(parsed)) {
                          const models = parsed.map((m) => {
                            const model = {
                              name: m.name ?? m.model ?? m
                            };
                            if (m.size) {
                              model.size = `${Math.round(m.size / (1024 * 1024 * 1024))}GB`;
                            }
                            return model;
                          });
                          console.log(`Mapped array models:`, models);
                          resolve(models);
                        } else {
                          console.error("Unexpected response format:", parsed);
                          resolve([]);
                        }
                      } catch (e) {
                        console.error("Error parsing JSON:", e, "Response:", responseText);
                        resolve([]);
                      }
                    } else {
                      console.error(`Empty response from ${url}`);
                      resolve([]);
                    }
                  }
                } catch (e) {
                  console.error("Error reading chunk:", e);
                  resolve([]);
                }
              });
            };
            readNext();
          };
          readAllData();
        } catch (e) {
          console.error(`Error connecting to ${url}:`, e);
          resolve([]);
        }
      });
    });
    if (result.length > 0) {
      return result;
    }
  }
  return [];
}

// src/main-window.ts
var options = {
  GTypeName: "PipocaMainWindow",
  Template: main_window_default,
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
    "model-size-row",
    "model-recommendation-row",
    "model-recommendation-icon"
  ]
};
var MainWindow = class extends Adw.ApplicationWindow {
  _settings = Gio2.Settings.new(Config.APP_ID);
  constructor(props) {
    super(props);
    this.set_default_size(this._settings.get_int("window-width"), this._settings.get_int("window-height"));
    if (this._settings.get_boolean("maximized")) {
      this.maximize();
    }
    this.add_action_entries([{ activate: this.showAboutDialog.bind(this), name: "show-about-dialog" }]);
  }
  static {
    GObject.registerClass(options, this);
  }
  vfunc_close_request() {
    const [width, height] = this.get_default_size();
    this._settings.set_int("window-width", width);
    this._settings.set_int("window-height", height);
    this._settings.set_boolean("maximized", this.is_maximized());
    return super.vfunc_close_request();
  }
  vfunc_map() {
    super.vfunc_map();
    const dropZoneButton = this._drop_zone_button;
    const dropZoneContent = this._drop_zone_content;
    const dropZoneIcon = this._drop_zone_icon;
    const dropZoneLabel = this._drop_zone_label;
    const selectedFileDisplay = this._selected_file_display;
    const fileTypeIcon = this._file_type_icon;
    const fileNameLabel = this._file_name_label;
    const changeFileButton = this._change_file_button;
    const targetLangRow = this._target_language_row;
    const modelRow = this._model_row;
    const translateBtn = this._translate_button;
    const progressBar = this._progress_bar;
    const statusLabel = this._status_label;
    const modelInfoGroup = this._model_info_group;
    const modelNameRow = this._model_name_row;
    const modelSizeRow = this._model_size_row;
    let selectedFile = null;
    const handleFileSelection = (filePath) => {
      selectedFile = filePath;
      const file = Gio2.File.new_for_path(filePath);
      const fileName = file.get_basename() || "";
      const iconName = fileName.toLowerCase().endsWith(".srt") ? "application-x-srt" : "document-text-symbolic";
      let displayName = fileName;
      if (fileName.length > 25) {
        const lastDot = fileName.lastIndexOf(".");
        if (lastDot > 0) {
          const baseName = fileName.substring(0, lastDot);
          const extension = fileName.substring(lastDot);
          displayName = baseName.substring(0, 20) + "..." + extension;
        } else {
          displayName = fileName.substring(0, 25) + "...";
        }
      }
      fileTypeIcon.set_from_icon_name(iconName);
      fileNameLabel.set_label(displayName);
      selectedFileDisplay.set_visible(true);
      dropZoneButton.set_visible(false);
      this.set_title(fileName);
      statusLabel.set_label("File selected. Choose settings and start translation.");
    };
    const openFilePicker = () => {
      const dialog = new Gio2.FileDialog({ title: _("Select Subtitle File") });
      dialog.open(this, null, (_obj, res) => {
        try {
          const file = dialog.open_finish(res);
          const path = file.get_path();
          if (path) {
            handleFileSelection(path);
          }
        } catch (e) {
          console.debug("File dialog cancelled or failed", e);
        }
      });
    };
    changeFileButton.connect("clicked", () => openFilePicker());
    dropZoneButton.connect("clicked", () => openFilePicker());
    const dropTarget = new (imports.gi.Gtk).DropTarget({ actions: (imports.gi.Gdk).DragAction.COPY, autostart: true, formats: (imports.gi.Gdk).ContentFormats.new_for_gtype((imports.gi.Gio).File.$gtype) });
    dropTarget.connect("accept", (_drop, value) => value instanceof Gio2.File);
    dropTarget.connect("drop", (_drop, value) => {
      if (value instanceof Gio2.File) {
        const path = value.get_path();
        if (path) {
          handleFileSelection(path);
        }
      }
      return true;
    });
    dropZoneButton.add_controller(dropTarget);
    const languages = [
      { label: _("English"), value: "English" },
      { label: _("Portuguese"), value: "Portuguese" },
      { label: _("Spanish"), value: "Spanish" },
      { label: _("French"), value: "French" },
      { label: _("German"), value: "German" },
      { label: _("Italian"), value: "Italian" },
      { label: _("Japanese"), value: "Japanese" },
      { label: _("Korean"), value: "Korean" },
      { label: _("Chinese"), value: "Chinese" },
      { label: _("Hindi"), value: "Hindi" },
      { label: _("Russian"), value: "Russian" },
      { label: _("Arabic"), value: "Arabic" }
    ];
    const langStore = new (imports.gi.Gtk).StringList();
    for (const l of languages) {
      langStore.append(l.label);
    }
    targetLangRow.set_model(langStore);
    targetLangRow.set_selected(0);
    const initial = [{ label: _("llama3.2:3b (recommended)"), value: "llama3.2:3b" }, { label: _("gemma2:2b (recommended)"), value: "gemma2:2b" }, { label: _("llama3.2:8b"), value: "llama3.2:8b" }, { label: _("qwen2.5:7b"), value: "qwen2.5:7b" }];
    const modelStore = new (imports.gi.Gtk).StringList();
    const models = [...initial];
    try {
      listInstalledModels().then((installed) => {
        if (installed && installed.length > 0) {
          const names = new Set(initial.map((m) => m.value));
          for (const m of installed) {
            const humanName = m.size ? `${m.name} (${m.size})` : m.name;
            if (!names.has(m.name)) {
              models.push({ label: humanName, value: m.name });
            }
          }
          modelStore.splice(0, modelStore.get_n_items(), []);
          for (const m of models) modelStore.append(m.label);
        }
      });
    } catch (e) {
      console.debug("Failed to list installed models", e);
    }
    for (const m of models) modelStore.append(m.label);
    modelRow.set_model(modelStore);
    modelRow.set_selected(0);
    const updateDropVisual = (drag) => {
      const active = drag?.is_active() ?? false;
      dropZoneContent.set_css_classes(["dim-label", ...active ? ["drag-over"] : []]);
      dropZoneIcon.set_css_classes(["dim-label", ...active ? ["drag-over"] : []]);
      dropZoneLabel.set_css_classes(["dim-label", ...active ? ["drag-over"] : []]);
    };
    dropZoneButton.add_controller(new (imports.gi.Gtk).DropControllerMotion({}));
    dropZoneButton.connect("drag-enter", (_b, drag) => updateDropVisual(drag));
    dropZoneButton.connect("drag-leave", (_b, drag) => updateDropVisual(drag));
    const setModelInfo = (modelName) => {
      const rec = getModelRecommendation(modelName);
      modelInfoGroup.set_visible(rec !== "unknown");
      modelNameRow.set_title(`${_("Model Name")}: ${modelName}`);
      modelSizeRow.set_title(_("Model Size"));
      const icon = rec === "recommended" ? "emblem-ok-symbolic" : "dialog-warning-symbolic";
      this._model_recommendation_icon.set_from_icon_name(icon);
      const msg = rec === "recommended" ? _("This model is recommended for subtitles.") : rec === "not-recommended" ? _("This model is not ideal for translation.") : _("Recommendation unknown.");
      this._model_recommendation_row.set_title(msg);
    };
    modelRow.connect("notify::selected", () => {
      const idx = modelRow.get_selected();
      const text = modelRow.get_selected_item()?.get_string();
      if (idx >= 0 && text) {
        const modelName = models[idx]?.value ?? text;
        setModelInfo(modelName);
      }
    });
    setModelInfo(models[0].value);
    const translateSubtitles = async () => {
      if (!selectedFile) {
        statusLabel.set_label("Please select a .srt file first.");
        return;
      }
      const modelName = models[modelRow.get_selected()].value;
      const targetLanguage = languages[targetLangRow.get_selected()].value;
      const cancellation = new TranslationCancellation();
      translateBtn.set_sensitive(false);
      progressBar.set_visible(true);
      progressBar.set_fraction(0);
      statusLabel.set_label("Starting translation...");
      try {
        const out = await translateSrtFile(selectedFile, targetLanguage, modelName, (done, total) => {
          progressBar.set_fraction(done / total);
          statusLabel.set_label(`Translating ${done}/${total}...`);
        }, cancellation);
        const f = Gio2.File.new_for_path(selectedFile);
        const parent = f.get_parent();
        const base = f.get_basename() ?? "subtitles.srt";
        const newname = base.replace(/\.srt$/i, "");
        const outname = `${newname}.${targetLanguage.toLowerCase().slice(0, 2)}.srt`;
        const outpath = parent?.get_child(outname)?.get_path();
        if (!outpath) throw new Error("Unable to resolve output path");
        const outfile = Gio2.File.new_for_path(outpath);
        outfile.replace_contents(new TextEncoder().encode(out), null, false, Gio2.FileCreateFlags.REPLACE_DESTINATION, null);
        statusLabel.set_label(`Saved: ${outname}`);
      } catch (e) {
        console.error(e);
        statusLabel.set_label("Translation failed. Check logs.");
      } finally {
        translateBtn.set_sensitive(true);
        progressBar.set_visible(false);
      }
    };
    translateBtn.connect("clicked", () => translateSubtitles());
  }
  showAboutDialog() {
    const about = new Adw.AboutDialog({
      applicationName: "Pipoca",
      applicationIcon: Config.APP_ID,
      developerName: "Thiago Duarte",
      version: Config.VERSION,
      website: "https://github.com/tduarte/Pipoca",
      issueUrl: "https://github.com/tduarte/Pipoca/issues",
      licenseType: (imports.gi.Gtk).License.CUSTOM,
      copyright: "Blue Oak Model License 1.0.0"
    });
    about.present(this);
  }
};

// src/app.ts
var options2 = { GTypeName: "PipocaApp" };
var App = class extends Adw2.Application {
  static {
    GObject2.registerClass(options2, this);
  }
  quit() {
    super.quit();
  }
  vfunc_activate() {
    this.activeWindow.present();
  }
  vfunc_startup() {
    super.vfunc_startup();
    GLib3.set_application_name("Pipoca");
    GLib3.set_prgname("pipoca");
    this.add_action_entries([{ activate: this.quit.bind(this), name: "quit" }]);
    this.set_accels_for_action("app.quit", ["<Ctrl>Q"]);
    this.set_accels_for_action("window.close", ["<Ctrl>W"]);
    new MainWindow({ application: this });
  }
};
var app_default = App;
export {
  app_default as default
};

