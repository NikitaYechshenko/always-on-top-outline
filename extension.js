import St from 'gi://St';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class AlwaysOnTopIndicatorExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._borders = new Map();
        this._handlerIds = new Map();
    }

    enable() {
        // Initialize settings - try/catch to provide defaults if schema not found
        try {
            this._settings = this.getSettings('org.gnome.shell.extensions.always-on-top-outline');
            this._borderWidth = this._settings.get_double('border-thickness');
            this._borderColor = this._settings.get_string('border-color');
            this._borderAlpha = this._settings.get_double('border-alpha');
        } catch (e) {
            log('[Always-On-Top] Settings error, using defaults:', e);
            // Use default values if settings fail
            this._settings = null;
            this._borderWidth = 2.0;
            this._borderColor = 'bd93f9';
            this._borderAlpha = 1.0;
        }

        // Watch for settings changes
        if (this._settings) {
            this._settingsChangedId = this._settings.connect('changed::border-thickness', () => {
                const rawWidth = this._settings.get_double('border-thickness');
                const newWidth = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 2.0;
                if (newWidth === this._borderWidth) return; // No change

                this._borderWidth = newWidth;

                // Rebuild borders using a snapshot to avoid mutating the Map during iteration.
                const windowsWithBorders = Array.from(this._borders.keys());
                for (const metaWindow of windowsWithBorders) {
                    this._removeBorder(metaWindow);

                    // Add back only if the window still needs a border.
                    if (metaWindow && metaWindow.is_above() && !metaWindow.minimized) {
                        this._addBorder(metaWindow);
                    }
                }
            });

            this._colorChangedId = this._settings.connect('changed::border-color', () => {
                const newColor = this._settings.get_string('border-color');
                if (newColor === this._borderColor) return;

                this._borderColor = newColor;
                this._updateBorderStyle();
            });

            this._alphaChangedId = this._settings.connect('changed::border-alpha', () => {
                const newAlpha = this._settings.get_double('border-alpha');
                if (newAlpha === this._borderAlpha) return;

                this._borderAlpha = newAlpha;
                this._updateBorderStyle();
            });
        }


        // Connect to window added/removed signals
        this._windowAddedId = global.display.connect('window-created',
            this._onWindowCreated.bind(this));

        // Connect to workspace switch to hide/show borders appropriately
        this._workspaceSwitchId = global.window_manager.connect('switch-workspace',
            this._onWorkspaceSwitch.bind(this));

        // Process existing windows
        const windowActors = global.get_window_actors();
        for (const windowActor of windowActors) {
            const metaWindow = windowActor.meta_window;
            if (metaWindow) {
                this._setupWindow(metaWindow);
            }
        }
    }

    disable() {
        // Disconnect settings
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        if (this._colorChangedId) {
            this._settings.disconnect(this._colorChangedId);
            this._colorChangedId = null;
        }
        if (this._alphaChangedId) {
            this._settings.disconnect(this._alphaChangedId);
            this._alphaChangedId = null;
        }
        this._settings = null;

        // Disconnect signals
        if (this._windowAddedId) {
            global.display.disconnect(this._windowAddedId);
            this._windowAddedId = null;
        }
        if (this._workspaceSwitchId) {
            global.window_manager.disconnect(this._workspaceSwitchId);
            this._workspaceSwitchId = null;
        }

        // Clean up all borders and handlers
        this._borders.forEach((border, metaWindow) => {
            this._removeBorder(metaWindow);
        });

        this._handlerIds.forEach((handlers, metaWindow) => {
            if (metaWindow && handlers) {
                for (const id of Object.values(handlers)) {
                    if (id) {
                        try {
                            metaWindow.disconnect(id);
                        } catch (e) {
                            // Window may be destroyed
                        }
                    }
                }
            }
        });

        this._borders.clear();
        this._handlerIds.clear();
    }

    _onWindowCreated(display, window) {
        this._setupWindow(window);
    }

    _onWorkspaceSwitch() {
        // Update visibility of all borders based on current workspace
        this._borders.forEach((borderInfo, metaWindow) => {
            this._updateBorderVisibility(metaWindow, borderInfo);
        });
    }

    _isWindowOnCurrentWorkspace(metaWindow) {
        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const windowWorkspace = metaWindow.get_workspace();
        return windowWorkspace === activeWorkspace || metaWindow.is_on_all_workspaces();
    }

    _updateBorderVisibility(metaWindow, borderInfo) {
        if (!borderInfo || !borderInfo.actors) return;
        
        const visible = this._isWindowOnCurrentWorkspace(metaWindow);
        borderInfo.actors.forEach(actor => {
            if (actor) {
                actor.visible = visible;
            }
        });
    }

    _getBorderStyle() {
        // Parse HEX color to RGB components
        const hex = this._borderColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // Use rgba() format - GNOME Shell CSS engine doesn't support 8-digit HEX
        return `background-color: rgba(${r}, ${g}, ${b}, ${this._borderAlpha});`;
    }

    _updateBorderStyle() {
        this._borders.forEach((borderInfo, metaWindow) => {
            if (borderInfo.actors) {
                const style = this._getBorderStyle();
                borderInfo.actors.forEach(actor => {
                    if (actor) {
                        actor.set_style(style);
                    }
                });
            }
        });
    }

    _setupWindow(metaWindow) {
        if (!metaWindow || metaWindow.get_window_type() !== Meta.WindowType.NORMAL) {
            return;
        }

        // Store all handler IDs in an object
        const handlers = {};
        
        // Connect to above state changes
        handlers.above = metaWindow.connect('notify::above', () => {
            this._updateWindowBorder(metaWindow);
        });
        
        // Connect to minimize/unminimize
        handlers.minimize = metaWindow.connect('notify::minimized', () => {
            this._updateWindowBorder(metaWindow);
        });

        // Connect to workspace changes for this window
        handlers.workspace = metaWindow.connect('workspace-changed', () => {
            const borderInfo = this._borders.get(metaWindow);
            if (borderInfo) {
                this._updateBorderVisibility(metaWindow, borderInfo);
            }
        });
        
        // Connect to window unmanaged signal for cleanup
        handlers.unmanaged = metaWindow.connect('unmanaged', () => {
            this._cleanupWindow(metaWindow);
        });
        
        this._handlerIds.set(metaWindow, handlers);

        // Initial border update
        this._updateWindowBorder(metaWindow);
    }

    _cleanupWindow(metaWindow) {
        const handlers = this._handlerIds.get(metaWindow);
        if (handlers) {
            for (const id of Object.values(handlers)) {
                if (id) {
                    try {
                        metaWindow.disconnect(id);
                    } catch (e) {
                        // Window may be destroyed
                    }
                }
            }
            this._handlerIds.delete(metaWindow);
        }
        
        this._removeBorder(metaWindow);
    }

    _updateWindowBorder(metaWindow) {
        const isAbove = metaWindow.is_above();
        const isMinimized = metaWindow.minimized;
        log(`[Always-On-Top] Window: ${metaWindow.get_title()}, is_above: ${isAbove}, minimized: ${isMinimized}`);
        
        if (isAbove && !isMinimized) {
            log(`[Always-On-Top] Adding border to: ${metaWindow.get_title()}`);
            this._addBorder(metaWindow);
        } else {
            this._removeBorder(metaWindow);
        }
    }

    _addBorder(metaWindow) {
        // Remove existing border if any
        this._removeBorder(metaWindow);

        const windowActor = metaWindow.get_compositor_private();
        if (!windowActor) {
            log(`[Always-On-Top] No window actor for: ${metaWindow.get_title()}`);
            return;
        }

        // Create 4 border actors (top, right, bottom, left) for better control
        const borderTop = new St.Bin({
            reactive: false,
            can_focus: false,
            track_hover: false,
            style: this._getBorderStyle()
        });

        const borderRight = new St.Bin({
            reactive: false,
            can_focus: false,
            track_hover: false,
            style: this._getBorderStyle()
        });

        const borderBottom = new St.Bin({
            reactive: false,
            can_focus: false,
            track_hover: false,
            style: this._getBorderStyle()
        });

        const borderLeft = new St.Bin({
            reactive: false,
            can_focus: false,
            track_hover: false,
            style: this._getBorderStyle()
        });

        // Set border size and position
        const updateBorderGeometry = () => {
            try {
                const rect = metaWindow.get_frame_rect();
                const bw = this._borderWidth;
                
                // Top border
                borderTop.set_position(rect.x - bw, rect.y - bw);
                borderTop.set_size(rect.width + 2 * bw, bw);
                
                // Right border
                borderRight.set_position(rect.x + rect.width, rect.y);
                borderRight.set_size(bw, rect.height);
                
                // Bottom border
                borderBottom.set_position(rect.x - bw, rect.y + rect.height);
                borderBottom.set_size(rect.width + 2 * bw, bw);
                
                // Left border
                borderLeft.set_position(rect.x - bw, rect.y);
                borderLeft.set_size(bw, rect.height);
            } catch (e) {
                // Window may have been destroyed
            }
        };

        updateBorderGeometry();

        // Add to UI group with higher stack level
        Main.layoutManager.addChrome(borderTop, { affectsInputRegion: false });
        Main.layoutManager.addChrome(borderRight, { affectsInputRegion: false });
        Main.layoutManager.addChrome(borderBottom, { affectsInputRegion: false });
        Main.layoutManager.addChrome(borderLeft, { affectsInputRegion: false });
        
        log(`[Always-On-Top] Border added successfully for: ${metaWindow.get_title()}`);

        // Keep border updated with window geometry
        const sizeChangedId = metaWindow.connect('size-changed', updateBorderGeometry);
        const positionChangedId = metaWindow.connect('position-changed', updateBorderGeometry);

        // Store border actors and their handler IDs
        const borderInfo = {
            actors: [borderTop, borderRight, borderBottom, borderLeft],
            sizeChangedId: sizeChangedId,
            positionChangedId: positionChangedId
        };
        this._borders.set(metaWindow, borderInfo);

        // Set initial visibility based on current workspace
        this._updateBorderVisibility(metaWindow, borderInfo);
    }

    _removeBorder(metaWindow) {
        const borderInfo = this._borders.get(metaWindow);
        if (borderInfo) {
            // Disconnect handlers
            if (borderInfo.sizeChangedId && metaWindow) {
                try {
                    metaWindow.disconnect(borderInfo.sizeChangedId);
                } catch (e) {
                    // Window may be destroyed
                }
            }
            if (borderInfo.positionChangedId && metaWindow) {
                try {
                    metaWindow.disconnect(borderInfo.positionChangedId);
                } catch (e) {
                    // Window may be destroyed
                }
            }
            
            // Remove border actors
            if (borderInfo.actors) {
                borderInfo.actors.forEach(actor => {
                    if (actor) {
                        Main.layoutManager.removeChrome(actor);
                        actor.destroy();
                    }
                });
            }
            
            this._borders.delete(metaWindow);
        }
    }
}