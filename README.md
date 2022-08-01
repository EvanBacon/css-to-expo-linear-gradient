# @bacons/css-to-expo-linear-gradient

Convert a CSS linear gradient function to `expo-linear-gradient` props

## Add the package to your npm dependencies

```
yarn add @bacons/css-to-expo-linear-gradient
```

## Usage

```tsx
import { fromCSS } from "@bacons/css-to-expo-linear-gradient";
import { LinearGradient } from "expo-linear-gradient";

function App() {
  return (
    <LinearGradient
      {...fromCSS(
        `linear-gradient(0deg, #ff008450 0%, #fca40040 25%, #ffff0030 40%, #00ff8a20 60%, #00cfff40 75%, #cc4cfa50 100%);`
      )}
    />
  );
}
```

## Attribution

Most of the code is adapted from [this project](https://github.com/niklasvh/html2canvas/tree/eeda86bd5e81fb4e97675fe9bee3d4d15899997f) which converts CSS linear gradients to canvas gradients.
