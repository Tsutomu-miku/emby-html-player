Bundled native playback artifacts live here.

Expected layout:

- `darwin/arm64/ehp_mpv_player.node`
- `darwin/arm64/libmpv.2.dylib`
- `darwin/arm64/*.dylib`
- `darwin/x64/ehp_mpv_player.node`
- `darwin/x64/libmpv.2.dylib`
- `darwin/x64/*.dylib`
- `linux/x64/ehp_mpv_player.node`
- `linux/x64/libmpv.so`
- `linux/x64/*.so*`
- `win32/x64/ehp_mpv_player.node`
- `win32/x64/libmpv.dll`
- `win32/x64/*.dll`

The app intentionally does not search the system `PATH` for player binaries and
does not spawn mpv as a separate process. Playback is embedded through libmpv.
Packaged builds must include the matching platform artifact here; `pnpm package`
runs `scripts/verify-native-resources.mjs` and fails before packaging if the
artifact is missing.

All media requests still go through centralized Emby identity headers from
`electron/main/embyIdentity.ts`.
