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
- **Local AI Translation** - Uses your locally installed Ollama models for privacy and cost
- **20+ Languages** - Supports the world's most popular languages with automatic file naming
- **Smart Auto-Save** - Automatically saves translated files with language codes (e.g., `movie.en.srt`)
- **Model Information** - View detailed information about your selected AI model
- **Modern UI** - Beautiful Libadwaita interface that follows GNOME design guidelines
- **Real-time Progress** - Live translation progress with visual feedback

## 🖼️ Screenshots

![Main Interface](data/screenshots/screenshot1.png)

## 🚀 Installation

### Prerequisites

1. **Install Ollama** for AI translation:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Download AI models** (recommended):
   ```bash
   # Lightweight, fast models
   ollama pull llama3.2:3b    # 2GB - Great for quick translations
   ollama pull gemma2:2b      # 1.6GB - Efficient and accurate
   
   # More powerful models (optional)
   ollama pull llama3.2:8b    # 4.7GB - Higher quality translations
   ```

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

1. **Start Ollama** (if not running):
   ```bash
   ollama serve
   ```

2. **Launch Pipoca**:
   ```bash
   flatpak run io.github.tduarte.Pipoca
   ```

3. **Translate subtitles**:
   - Drag your `.srt` file into the drop zone OR click to select
   - Choose your target language from 20+ options
   - Select an AI model (installed models + recommended options)
   - Toggle auto-save to automatically name files with language codes
   - Click "Start Translation" and watch the magic happen! ✨

## 🛠️ Development

### Tech Stack

- **Language**: TypeScript
- **UI Framework**: GTK4 + Libadwaita
- **Build System**: Meson + Flatpak
- **AI Backend**: Ollama HTTP API
- **Bundler**: ESBuild


### Project Structure

```
pipoca/
├── src/                          # TypeScript source code
│   ├── app.ts                    # Application entry point
│   ├── main-window.ts            # Main window logic & UI handling
│   ├── main-window.ui            # GTK UI definition
│   └── translator.ts             # SRT parsing & Ollama integration
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
- **HTTP Client**: libsoup for Ollama API communication
- **UI Components**: Libadwaita widgets (`AdwPreferencesGroup`, `AdwComboRow`, etc.)
- **Async Operations**: GJS async/await patterns with proper error handling

## Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues

1. Check if the issue already exists in [GitHub Issues](https://github.com/tduarte/pipoca/issues)
2. Provide detailed information:
   - Pipoca version
   - Operating system
   - Ollama version and installed models
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

**Models not loading:**
- Verify Ollama is running: `ollama ps`
- Check Ollama API: `curl http://localhost:11434/api/tags`
- Ensure network permissions are enabled in Flatpak

**Translation fails:**
- Verify the selected model is downloaded: `ollama list`
- Check Ollama logs for errors
- Ensure the SRT file is properly formatted

**Performance issues:**
- Try smaller models (gemma2:2b, llama3.2:3b)
- Close other applications to free up RAM
- Consider using GPU acceleration if available

### Debug Mode

Run with debug output:
```bash
PIPOCA_DEBUG=1 flatpak run io.github.tduarte.Pipoca
```

## 📝 License

This project is licensed under the [Blue Oak Model License](LICENSE.md).

## Acknowledgments

- **GNOME Team** for the amazing GTK4 and Libadwaita frameworks
- **Ollama Team** for the incredible local AI model platform
- **nyx_lyb3ra** for the [GNOME TypeScript Template](https://codeberg.org/nyx_lyb3ra/gnome-ts-template)
- **Flatpak Team** for modern application distribution

---

<div align="center">

**Made with ❤️ by [Thiago Duarte](https://github.com/tduarte)**

</div>
