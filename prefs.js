import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Adw from 'gi://Adw';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class AlwaysOnTopIndicatorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Create a preferences page
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // Create a preferences group
        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of the border'),
        });
        page.add(group);

        const settings = this.getSettings();

        // Border thickness spinner
        const thicknessRow = new Adw.SpinRow({
            title: _('Border Thickness'),
            subtitle: _('Thickness of the border in pixels'),
            adjustment: new Gtk.Adjustment({
                lower: 0.25,
                upper: 10.0,
                step_increment: 0.25,
                page_increment: 1.0,
                value: 2.0,
            }),
            digits: 2,
            width_chars: 6,
        });
        group.add(thicknessRow);
        settings.bind('border-thickness', thicknessRow, 'value',
            Gio.SettingsBindFlags.DEFAULT);

        // Border color button
        const colorRow = new Adw.ActionRow({
            title: _('Border Color'),
            subtitle: _('Choose the border color'),
        });

        const colorButton = new Gtk.ColorButton();
        colorRow.add_suffix(colorButton);
        group.add(colorRow);

        // Update color button from settings
        const updateColorButton = () => {
            const hexColor = settings.get_string('border-color');
            const rgba = new Gdk.RGBA();
            rgba.parse('#' + hexColor);
            colorButton.set_rgba(rgba);
        };
        updateColorButton();

        // Connect color button changes
        colorButton.connect('color-set', () => {
            const rgba = colorButton.get_rgba();
            // Convert RGBA to hex format (RRGGBB)
            const r = Math.round(rgba.red * 255).toString(16).padStart(2, '0');
            const g = Math.round(rgba.green * 255).toString(16).padStart(2, '0');
            const b = Math.round(rgba.blue * 255).toString(16).padStart(2, '0');
            const hexColor = r + g + b;
            settings.set_string('border-color', hexColor);
        });

        settings.connect('changed::border-color', () => {
            updateColorButton();
        });

        // Border alpha/transparency slider
        const alphaRow = new Adw.ActionRow({
            title: _('Transparency'),
            subtitle: _('0 = Fully transparent, 1 = Fully opaque'),
        });

        const alphaScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.05,
                page_increment: 0.1,
                value: 1.0,
            }),
            draw_value: true,
            digits: 2,
            width_request: 200,
            hexpand: true,
        });
        alphaRow.add_suffix(alphaScale);
        group.add(alphaRow);

        settings.bind('border-alpha', alphaScale.adjustment, 'value',
            Gio.SettingsBindFlags.DEFAULT);
    }
}