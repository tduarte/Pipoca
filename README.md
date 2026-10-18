# 🍿 Pipoca - AI-Powered Subtitle Translator

<div align="center">

![Pipoca Logo](data/icons/io.github.tduarte.Pipoca.svg)

**A beautiful, modern GNOME application for translating subtitle files using local AI models**

[![Built with GTK4](https://img.shields.io/badge/Built%20with-GTK4-blue.svg)](https://gtk.org/)
[![Powered by Libadwaita](https://img.shields.io/badge/Powered%20by-Libadwaita-green.svg)](https://gnome.pages.gitlab.gnome.org/libadwaita/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Flatpak](https://img.shields.io/badge/Flatpak-4A90E2?logo=flathub&logoColor=white)](https://flatpak.org/)

</div>

## ✨ Features

- **Drag & Drop Interface** - Simply drag your `.srt` files into the beautiful drop zone
- **Local AI Translation** - Runs translation models on your own computer with a bundled [llama.cpp](https://github.com/ggml-org/llama.cpp) engine (GPU-accelerated via Vulkan)
- **Guided Setup** - Suggests a model that suits your computer's memory and downloads it for you
- **20+ Languages** - Supports the world's most popular languages with automatic file naming
- **Smart Auto-Save** - Automatically saves translated files with language codes (e.g., `movie.en.srt`)
- **Modern UI** - Beautiful Libadwaita interface that follows GNOME design guidelines
- **Real-time Progress** - Live translation progress with visual feedback

## 🖼️ Screenshots

![Main Interface](data/screenshots/screenshot1.png)

## 🚀 Installation

Pipoca has no external dependencies. The translation engine is bundled with the app, and on first launch Pipoca offers these models:

| Model | Download | Notes |
|---|---|---|
| [Index-Translate 2B](https://huggingface.co/IndexTeam/Index-Translate-2B-GGUF) | 1.3 GB | Small and fast; suggested for computers with less than 12 GB of memory |
| [Index-Translate 9B](https://huggingface.co/IndexTeam/Index-Translate-9B-GGUF) | 5.8 GB | Best quality; suggested for computers with 12 GB of memory or more |
| [Hy-MT2 7B](https://huggingface.co/tencent/Hy-MT2-7B-GGUF) | 4.6 GB | Alternative from Tencent; does not support Greek |

Models are stored in `~/.var/app/io.github.tduarte.Pipoca/data/models` and can be added or removed from **Manage Models**.

### Installing Pipoca

#### Option 1: Build from Source (Recommended for Contributors)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tduarte/pipoca.git
   cd pipoca
   ```

2. **Install Flatpak Builder**:
   ```bash
   flatpak install flathub org.flatpak.Builder
   ```

3. **Build and install**:
   ```bash
   flatpak run org.flatpak.Builder --force-clean --install --user repo io.github.tduarte.Pipoca.json
   ```

4. **Run Pipoca**:
   ```bash
   flatpak run io.github.tduarte.Pipoca
   ```

#### Option 2: Install from Flathub (Coming Soon)

```bash
flatpak install flathub io.github.tduarte.Pipoca
```

## 🎮 Usage

1. **Launch Pipoca**:
   ```bash
   flatpak run io.github.tduarte.Pipoca
   ```

2. **Pick a model** on first launch and wait for the download to finish.

3. **Translate subtitles**:
   - Drag your `.srt` file into the drop zone OR click to select
   - Choose your target language from 20+ options
   - Click "Start Translation" and watch the magic happen! ✨

## 🔒 Sandbox & Portals

- File access: Pipoca uses Flatpak portals exclusively. It cannot see your filesystem unless you pick a file/folder in an open/save dialog or drop a file onto the window. Drag-and-drop also goes through the document portal.
- Open/Save: The app uses `Gtk.FileDialog`, which is portal-aware. You’ll be prompted to choose the input `.srt` and where to save the translated file.
- Network: Used only to download models from Hugging Face. Translation runs in a private `llama-server` process bound to `127.0.0.1`; no subtitle content is sent to remote servers.
- GPU: `--device=dri` gives the bundled engine Vulkan access. If GPU startup fails, Pipoca falls back to the CPU.

## 🛠️ Development

### Tech Stack

- **Language**: TypeScript
- **UI Framework**: GTK4 + Libadwaita
- **Build System**: Meson + Flatpak
- **AI Backend**: Bundled llama.cpp (`llama-server`, Vulkan + CPU backends)
- **Bundler**: ESBuild

### Flatpak Build Notes

- The Flatpak manifest vendors the Node cache for an offline, sandboxed build using the Node 24 SDK extension. No internet is required during the builder phase.
- llama.cpp is built from a pinned release tag with `GGML_BACKEND_DL` and `GGML_CPU_ALL_VARIANTS`, so the right CPU backend is picked at runtime, plus the Vulkan backend for GPUs.
- Outside Flatpak, Pipoca looks for `llama-server` in `PATH`, or uses `PIPOCA_LLAMA_SERVER` if set.
- The app no longer requests broad filesystem access (no `--filesystem=home`). All file interactions use portals.


### Project Structure

```
pipoca/
├── src/                          # TypeScript source code
│   ├── app.ts                    # Application entry point
│   ├── main-window.ts            # Main window logic & UI handling
│   ├── main-window.ui            # GTK UI definition
│   ├── llama-server.ts           # Runs the bundled llama-server
│   ├── models.ts                 # Model catalog & downloads
│   └── translator.ts             # SRT parsing & prompts
├── data/                         # Application data files
│   ├── icons/                    # App icons
│   ├── screenshots/              # Screenshots for README
│   └── *.desktop.in              # Desktop entry
├── scripts/                      # Build scripts
│   └── esbuild.js               # ESBuild configuration
├── io.github.tduarte.Pipoca.json # Flatpak manifest
└── meson.build                   # Build configuration
```

### Key Components

- **Drag & Drop**: GTK4 `DropTarget` with custom CSS styling
- **File Handling**: GIO File APIs for cross-platform file operations
- **HTTP Client**: libsoup for model downloads and the llama-server API
- **UI Components**: Libadwaita widgets (`AdwPreferencesGroup`, `AdwComboRow`, etc.)
- **Async Operations**: GJS async/await patterns with proper error handling

## Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues

1. Check if the issue already exists in [GitHub Issues](https://github.com/tduarte/pipoca/issues)
2. Provide detailed information:
   - Pipoca version
   - Operating system
   - Translation model and GPU
   - Steps to reproduce
   - Expected vs actual behavior

### Code Contributions

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes** following our coding standards:
   - Use TypeScript for type safety
   - Follow existing code formatting
   - Add comments for complex logic
   - Test your changes thoroughly

4. **Build and test**:
   ```bash
   flatpak run org.flatpak.Builder --force-clean --install --user repo io.github.tduarte.Pipoca.json
   flatpak run io.github.tduarte.Pipoca
   ```

5. **Submit a Pull Request** with:
   - Clear description of changes
   - Screenshots if UI changes
   - Testing instructions

### Translation Contributions

Help translate Pipoca into more languages! We use standard gettext (`.po`) files.

## Troubleshooting

### Common Issues

**Pipoca won't start:**
- Ensure Flatpak is properly installed
- Check if all dependencies are available: `flatpak list`

**Model download fails:**
- Check your internet connection and free disk space
- Click download again; interrupted downloads resume where they left off

**Model fails to load or translation fails:**
- Run Pipoca from a terminal to see the engine log (lines prefixed with `[llama-server]`)
- Try a smaller model from **Manage Models**
- Ensure the SRT file is properly formatted

**Performance issues:**
- Try Index-Translate 2B
- Close other applications to free up RAM
- Make sure your GPU drivers support Vulkan (`vulkaninfo --summary`)

### Debug Mode

Run with debug output:
```bash
PIPOCA_DEBUG=1 flatpak run io.github.tduarte.Pipoca
```

## 📝 License

This project is licensed under the [Blue Oak Model License](LICENSE.md).

## Acknowledgments

- **GNOME Team** for the amazing GTK4 and Libadwaita frameworks
- **llama.cpp contributors** for the local inference engine
- **Bilibili Index Team** and **Tencent Hunyuan Team** for the open translation models
- **nyx_lyb3ra** for the [GNOME TypeScript Template](https://codeberg.org/nyx_lyb3ra/gnome-ts-template)
- **Flatpak Team** for modern application distribution

---

<div align="center">

**Made with ❤️ by [Thiago Duarte](https://github.com/tduarte)**

</div>
