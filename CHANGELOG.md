# Changelog

## [0.2.2] - 2026-01-27

### Added

- **Progress-Based Animation** - Animate text programmatically without scroll
  - `progress` prop on `ManimScroll` for controlled mode (0-1 value)
  - `play(duration | options)` method for time-based playback
  - `seek(progress)` and `setProgress(progress)` for position control
  - Easing support: `linear`, `ease-in`, `ease-out`, `ease-in-out`, `smooth`
  - Loop and reverse playback options

- **Runtime Playback API** (`NativeTextPlayer`)
  - `setProgress(value)` - Render at exact progress
  - `play(options)` - Animate over duration
  - `pause()` - Stop playback
  - `seek(progress)` - Jump to position
  - `isPlaying` / `progress` getters

### Changed

- `useNativeAnimation` hook now returns: `play`, `seek`, `setProgress`, `isPlaying`
- Scroll binding is skipped when `progress` prop is provided

## [0.2.1] - 2026-01-26

- Initial public release with native mode, scroll-driven animations
