# Always On Top Outline
<img width="2004" height="1253" alt="image" src="https://github.com/user-attachments/assets/2956c2f3-2f35-422a-9c87-4466c5ba62c2" />

A GNOME Shell extension that adds a customizable colored border around windows set to "Always on Top", making them easily identifiable.

![GNOME Shell](https://img.shields.io/badge/GNOME_Shell-45--48-blue)
![License](https://img.shields.io/badge/License-GPL--3.0-green)

## Features

- **Customizable border thickness** — from 0.25px to 10px
- **Any color** — full color picker support
- **Adjustable transparency** — from fully transparent to fully opaque
- **Workspace-aware** — border only shows on the workspace where the window is located
- **Works on Wayland and X11**

## Screenshots

*Window with always-on-top border enabled*

## Installation

### From extensions.gnome.org (Recommended)

The extension can be installed from its page on extensions.gnome.org after it is published and approved.

### Manual Installation

```bash
git clone https://github.com/NikitaYechshenko/always-on-top-outline.git
cd always-on-top-outline
mkdir -p ~/.local/share/gnome-shell/extensions/always-on-top-outline-v2@NikitaYechshenko
cp -r extension.js prefs.js metadata.json schemas ~/.local/share/gnome-shell/extensions/always-on-top-outline-v2@NikitaYechshenko/
```

Then restart GNOME Shell:
- **X11**: Press `Alt+F2`, type `r`, press Enter
- **Wayland**: Log out and log back in

Enable the extension using the Extensions app or GNOME Tweaks.

## Configuration

Open the extension settings through the Extensions app to customize:

| Setting | Description | Default |
|---------|-------------|---------|
| Border Thickness | Width of the border in pixels | 2.0 |
| Border Color | Color of the border | Purple (#bd93f9) |
| Transparency | Opacity of the border (0-1) | 1.0 |

## Requirements

- GNOME Shell 45, 46, 47, or 48
- Wayland or X11

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
