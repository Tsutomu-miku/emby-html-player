# Native Playback Release

The app must bundle its libmpv runtime. It must not depend on a player installed
on the user's machine and must not spawn `mpv` as a separate process.

## Runtime Layout

Packaged builds load native playback artifacts from
`resources/native/<platform>/<arch>/`.

Required files:

- macOS: `ehp_mpv_player.node`, `libmpv.2.dylib`, and every bundled `*.dylib`
- Windows: `ehp_mpv_player.node`, `libmpv.dll`, and every bundled `*.dll`
- Windows build-time headers: `include/mpv/{client,render,render_gl}.h`
- Linux: `ehp_mpv_player.node`, `libmpv.so`, and every bundled `*.so*`

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

Windows:

1. Put reviewed libmpv runtime artifacts under `vendor/mpv/win32/x64/`.
   The directory must contain a supported libmpv DLL name (`libmpv.dll`,
   `mpv-2.dll`, or `libmpv-2.dll`), all dependent DLLs, and
   `include/mpv/{client,render,render_gl}.h`.
2. Run `pnpm stage:native -- --platform=win32 --arch=x64`.
3. Run `pnpm build:native:player` on Windows.
4. Run `pnpm verify:native`.
5. Run `pnpm package:win`.

Linux:

The Linux native host-view addon is not implemented yet. Once it exists, use the
same reviewed-runtime flow:

1. Put reviewed libmpv runtime artifacts under `vendor/mpv/linux/x64/`.
2. Run `pnpm stage:native -- --platform=linux --arch=x64`.
3. Run `pnpm build:native:player`.
4. Run `pnpm verify:native`.
5. Run `pnpm package:linux`.

`pnpm package`, `pnpm package:mac`, `pnpm package:linux`, and `pnpm package:win`
all run `verify:native` first. Packaging fails if the runtime is missing.

## GitHub Actions

`.github/workflows/package.yml` builds installers on macOS and Windows by
default. Linux is present as an opt-in job for the future native addon.

For CI, provide reviewed native runtimes in a zip with this layout:

```text
vendor/mpv/win32/x64/libmpv.dll
vendor/mpv/win32/x64/*.dll
vendor/mpv/win32/x64/include/mpv/client.h
vendor/mpv/win32/x64/include/mpv/render.h
vendor/mpv/win32/x64/include/mpv/render_gl.h
```

Pass the zip URL through the manual workflow input `native_runtime_url`, or set
the repository secret `NATIVE_RUNTIME_URL` for tag-triggered release builds.
macOS can use the same zip layout; if no macOS runtime is provided, CI falls
back to Homebrew `mpv` to bundle libmpv on the macOS runner.

If the Windows runtime is not provided, the Windows job still runs typecheck and
lint, then skips installer packaging with a workflow notice. It cannot produce
an `.exe` until the reviewed DLLs and headers above are available.

## Emby Identity

The renderer never constructs media identity headers. MPV media headers are
created only in `electron/main/embyIdentity.ts` and applied by the main process.
