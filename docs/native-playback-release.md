# Native Playback Release

The app must bundle its MPV runtime. It must not depend on a player installed on
the user's machine.

## Runtime Layout

Put reviewed MPV runtime artifacts in `vendor/mpv/<platform>/<arch>/`, then stage
them into `resources/native/<platform>/<arch>/`.

Required binary names:

- macOS: `vendor/mpv/darwin/arm64/mpv` or `vendor/mpv/darwin/x64/mpv`
- Linux: `vendor/mpv/linux/x64/mpv`
- Windows: `vendor/mpv/win32/x64/mpv.exe`

The directory must also contain the dynamic libraries needed by that binary:

- macOS: `*.dylib`
- Linux: `*.so*`
- Windows: `*.dll`

## Release Steps

1. Add the platform runtime under `vendor/mpv/<platform>/<arch>/`.
2. Run `pnpm stage:native -- --platform=<platform> --arch=<arch>`.
3. Run `pnpm verify:native`.
4. Run `pnpm package:<platform>`.

`pnpm package`, `pnpm package:mac`, `pnpm package:linux`, and `pnpm package:win`
all run `verify:native` first. Packaging fails if the runtime is missing.

## Emby Identity

The renderer never constructs media identity headers. MPV media headers are
created only in `electron/main/embyIdentity.ts` and applied by the main process.
