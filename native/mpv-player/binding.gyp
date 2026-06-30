{
  "targets": [
    {
      "target_name": "ehp_mpv_player",
      "sources": ["src/mpv_player.m"],
      "include_dirs": ["/opt/homebrew/include"],
      "libraries": ["/opt/homebrew/lib/libmpv.dylib"],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "CLANG_ENABLE_OBJC_ARC": "YES",
            "OTHER_LDFLAGS": [
              "-framework", "AppKit",
              "-framework", "OpenGL",
              "-Wl,-rpath,@loader_path"
            ]
          }
        }]
      ]
    }
  ]
}
