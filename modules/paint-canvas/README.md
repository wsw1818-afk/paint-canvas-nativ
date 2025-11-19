# paint-canvas-native

Expo native module for paint-by-numbers canvas with touch painting functionality.

## Features

- Touch-based painting on Android devices
- Configurable canvas size and color palette
- Native performance using Expo Modules API
- Compatible with Expo SDK 51+

## Installation

```bash
npm install paint-canvas-native
# or
yarn add paint-canvas-native
# or
pnpm add paint-canvas-native
```

## Usage

```javascript
import { PaintCanvasView } from 'paint-canvas-native';

function MyComponent() {
  return (
    <PaintCanvasView
      style={{ width: '100%', height: 400 }}
      // Add your props here
    />
  );
}
```

## Requirements

- Expo SDK 51.0.0 or higher
- React Native
- Android (iOS support coming soon)

## License

MIT

## Author

wisangwon1
