# Wavelength

Wavelength is a React Native podcast studio built with Expo. Record, edit, and publish microcasts to your Micro.blog.

## Prerequisites

- [Bun](https://bun.sh)
- Node.js
- **iOS:** Xcode and CocoaPods
- **Android:** Android Studio with an emulator or device

## Getting started

Install dependencies:

```bash
bun install
```

The `ios/` and `android/` folders are not checked into git. Generate them before your first build:

```bash
bunx expo prebuild --clean
```

`bun ios` and `bun android` will run prebuild automatically if those folders are missing, but without `--clean`. Prefer the command above on first setup, and run it again after changing Expo plugins in `app.json`, upgrading native dependencies, or if native builds get into a bad state. The `--clean` flag removes any existing native folders before regenerating them.

Start the Metro bundler:

```bash
bun start
```

Run on a simulator or device:

```bash
bun ios
# or
bun android
```

## Tests

```bash
bun test
```
