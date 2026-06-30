{
  "variables": {
    "mpv_include_dir%": ""
  },
  "targets": [
    {
      "target_name": "ehp_mpv_player",
      "sources": [],
      "conditions": [
        ["OS=='mac'", {
          "sources": ["src/mpv_player.m"],
          "include_dirs": ["/opt/homebrew/include"],
          "libraries": ["/opt/homebrew/lib/libmpv.dylib"],
          "xcode_settings": {
            "CLANG_ENABLE_OBJC_ARC": "YES",
            "OTHER_LDFLAGS": [
              "-framework", "AppKit",
              "-framework", "OpenGL",
              "-Wl,-rpath,@loader_path"
            ]
          }
        }],
        ["OS=='win'", {
          "sources": ["src/mpv_player_win.cc"],
          "include_dirs": ["<(mpv_include_dir)"],
          "defines": ["UNICODE", "_UNICODE", "WIN32_LEAN_AND_MEAN"],
          "libraries": [
            "user32.lib",
            "gdi32.lib",
            "opengl32.lib"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}
