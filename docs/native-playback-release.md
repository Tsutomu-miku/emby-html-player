# Native Playback Release

The app must bundle its libmpv runtime. It must not depend on a player installed
on the user's machine and must not spawn `mpv` as a separate process.

## Runtime Layout

Packaged builds load native playback artifacts from
`resources/native/<platform>/<arch>/`.

Required files:

- macOS: `ehp_mpv_player.node`, `libmpv.2.dylib`, and every bundled `*.dylib`
- Linux: `ehp_mpv_player.node`, `libmpv.so`, and every bundled `*.so*`
- Windows: `ehp_mpv_player.node`, `libmpv.dll`, and every bundled `*.dll`

The runtime is embedded through `libmpv`; the app intentionally does not search
`PATH`, Homebrew, apt, winget, or user-installed player locations.

## Release Steps

macOS:

1. Bundle reviewed libmpv dylibs into `resources/native/darwin/<arch>/`:
   `pnpm bundle:native:mac -- --source=/path/to/libmpv.2.dylib --arch=<arch>`.
2. Build and copy the native host-view addon:
   `pnpm build:native:player`.
3. Run `pnpm verify:native`.
4. Run `pnpm package:mac`.

Linux / Windows:

1. Add reviewed `ehp_mpv_player.node` and libmpv runtime artifacts under
   `resources/native/<platform>/<arch>/`.
2. Run `pnpm verify:native`.
3. Run `pnpm package:<platform>`.

`pnpm package`, `pnpm package:mac`, `pnpm package:linux`, and `pnpm package:win`
all run `verify:native` first. Packaging fails if the runtime is missing.

## Emby Identity

The renderer never constructs media identity headers. MPV media headers are
created only in `electron/main/embyIdentity.ts` and applied by the main process.
