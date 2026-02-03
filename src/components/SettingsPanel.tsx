import React from 'react';
import { PlaybackSettings } from '../types';
import './SettingsPanel.css';

interface SettingsPanelProps {
  settings: PlaybackSettings;
  onSettingsChange: (settings: Partial<PlaybackSettings>) => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onClose,
}) => {
  return (
    <div className="settings-panel" role="dialog" aria-label="Reading settings">
      <div className="settings-container">
        <div className="settings-header">
          <h2>Reading Preferences</h2>
          <button onClick={onClose} className="btn-close" aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* Font Family */}
          <div className="setting-group">
            <label htmlFor="font-family">Font Family</label>
            <select
              id="font-family"
              value={settings.fontFamily}
              onChange={(e) =>
                onSettingsChange({
                  fontFamily: e.target.value,
                })
              }
              className="setting-select"
            >
              <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Merriweather, serif">Merriweather</option>
              <option value="OpenDyslexic, sans-serif">OpenDyslexic</option>
              <option value="Courier New, monospace">Monospace</option>
            </select>
          </div>

          {/* Font Size */}
          <div className="setting-group">
            <label htmlFor="font-size">Font Size: {settings.fontSize}px</label>
            <input
              id="font-size"
              type="range"
              min="24"
              max="96"
              step="4"
              value={settings.fontSize}
              onChange={(e) =>
                onSettingsChange({
                  fontSize: parseInt(e.target.value),
                })
              }
              className="setting-slider"
              aria-label="Font size"
            />
          </div>

          {/* Line Height */}
          <div className="setting-group">
            <label htmlFor="line-height">Line Height: {settings.focusLineHeight}</label>
            <input
              id="line-height"
              type="range"
              min="1"
              max="2.5"
              step="0.1"
              value={settings.focusLineHeight}
              onChange={(e) =>
                onSettingsChange({
                  focusLineHeight: parseFloat(e.target.value),
                })
              }
              className="setting-slider"
              aria-label="Line height"
            />
          </div>

          {/* Focal Letter Boldness */}
          <div className="setting-group">
            <label htmlFor="focal-boldness">Focal Letter Boldness: {settings.focalLetterBoldness}</label>
            <input
              id="focal-boldness"
              type="range"
              min="400"
              max="900"
              step="100"
              value={settings.focalLetterBoldness}
              onChange={(e) =>
                onSettingsChange({
                  focalLetterBoldness: parseInt(e.target.value),
                })
              }
              className="setting-slider"
              aria-label="Focal letter boldness"
            />
          </div>

          {/* TTS Rate */}
          <div className="setting-group">
            <label htmlFor="tts-rate">TTS Speed: {settings.ttsRate.toFixed(1)}x</label>
            <input
              id="tts-rate"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.ttsRate}
              onChange={(e) =>
                onSettingsChange({
                  ttsRate: parseFloat(e.target.value),
                })
              }
              className="setting-slider"
              aria-label="Text-to-speech rate"
            />
          </div>

          {/* TTS Pitch */}
          <div className="setting-group">
            <label htmlFor="tts-pitch">TTS Pitch: {settings.ttsPitch.toFixed(1)}x</label>
            <input
              id="tts-pitch"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.ttsPitch}
              onChange={(e) =>
                onSettingsChange({
                  ttsPitch: parseFloat(e.target.value),
                })
              }
              className="setting-slider"
              aria-label="Text-to-speech pitch"
            />
          </div>

          {/* Toggles */}
          <div className="settings-toggles">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(e) =>
                  onSettingsChange({
                    highContrast: e.target.checked,
                  })
                }
                className="toggle-checkbox"
              />
              <span>High Contrast</span>
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.dyslexiaFriendlyFont}
                onChange={(e) =>
                  onSettingsChange({
                    dyslexiaFriendlyFont: e.target.checked,
                  })
                }
                className="toggle-checkbox"
              />
              <span>Dyslexia-Friendly Font</span>
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) =>
                  onSettingsChange({
                    darkMode: e.target.checked,
                  })
                }
                className="toggle-checkbox"
              />
              <span>Dark Mode</span>
            </label>
          </div>
        </div>

        <div className="settings-footer">
          <button onClick={onClose} className="btn-done">
            Done
          </button>
        </div>
      </div>

      {/* Overlay to close on click outside */}
      <div className="settings-overlay" onClick={onClose} />
    </div>
  );
};

export default SettingsPanel;
