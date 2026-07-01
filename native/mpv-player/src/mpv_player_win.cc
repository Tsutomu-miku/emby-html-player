#include <node_api.h>

#include <windows.h>
#include <GL/gl.h>
#include <mpv/client.h>
#include <mpv/render.h>
#include <mpv/render_gl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define EHP_RENDER_MESSAGE (WM_APP + 191)

struct MpvApi {
  HMODULE dll;
  HMODULE opengl32;
  mpv_handle* (*mpv_create)(void);
  int (*mpv_initialize)(mpv_handle*);
  void (*mpv_terminate_destroy)(mpv_handle*);
  const char* (*mpv_error_string)(int);
  int (*mpv_request_log_messages)(mpv_handle*, const char*);
  int (*mpv_set_option_string)(mpv_handle*, const char*, const char*);
  int (*mpv_set_property)(mpv_handle*, const char*, mpv_format, void*);
  int (*mpv_set_property_string)(mpv_handle*, const char*, const char*);
  int (*mpv_command)(mpv_handle*, const char**);
  int (*mpv_observe_property)(mpv_handle*, uint64_t, const char*, mpv_format);
  mpv_event* (*mpv_wait_event)(mpv_handle*, double);
  int (*mpv_render_context_create)(mpv_render_context**, mpv_handle*, mpv_render_param*);
  void (*mpv_render_context_set_update_callback)(mpv_render_context*, mpv_render_update_fn, void*);
  void (*mpv_render_context_render)(mpv_render_context*, mpv_render_param*);
  void (*mpv_render_context_free)(mpv_render_context*);
};

struct PlayerState {
  mpv_handle* mpv;
  mpv_render_context* render;
  HWND hwnd;
  HDC hdc;
  HGLRC glrc;
};

static MpvApi g_mpv = {};
static ATOM g_windowClass = 0;
static DWORD g_lastMpvLoadError = ERROR_SUCCESS;

static napi_value Throw(napi_env env, const char* message) {
  napi_throw_error(env, NULL, message);
  return NULL;
}

static char* ReadString(napi_env env, napi_value value) {
  size_t length = 0;
  napi_get_value_string_utf8(env, value, NULL, 0, &length);
  char* result = (char*)calloc(length + 1, sizeof(char));
  napi_get_value_string_utf8(env, value, result, length + 1, &length);
  return result;
}

static double ReadDouble(napi_env env, napi_value value) {
  double result = 0;
  napi_get_value_double(env, value, &result);
  return result;
}

static uint64_t ParsePointer(const char* value, int base) {
  return strtoull(value, NULL, base);
}

static int MaxInt(int left, int right) {
  return left > right ? left : right;
}

static PlayerState* ReadPlayer(napi_env env, napi_value value) {
  char* handle = ReadString(env, value);
  PlayerState* player = (PlayerState*)(uintptr_t)ParsePointer(handle, 10);
  free(handle);
  return player;
}

static void AddPathFileName(wchar_t* path, size_t pathLength, const wchar_t* fileName) {
  size_t length = wcslen(path);
  while (length > 0 && path[length - 1] != L'\\' && path[length - 1] != L'/') {
    path[--length] = L'\0';
  }
  wcsncat_s(path, pathLength, fileName, _TRUNCATE);
}

static bool GetAddonDirectory(wchar_t* buffer, size_t bufferLength) {
  HMODULE module = NULL;
  if (!GetModuleHandleExW(
        GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
        (LPCWSTR)&GetAddonDirectory,
        &module)) {
    return false;
  }
  DWORD length = GetModuleFileNameW(module, buffer, (DWORD)bufferLength);
  if (length == 0 || length >= bufferLength) return false;
  while (length > 0 && buffer[length - 1] != L'\\' && buffer[length - 1] != L'/') {
    buffer[--length] = L'\0';
  }
  return true;
}

static FARPROC LoadMpvSymbol(const char* name) {
  return g_mpv.dll ? GetProcAddress(g_mpv.dll, name) : NULL;
}

#define LOAD_MPV_SYMBOL(name) \
  do { \
    g_mpv.name = reinterpret_cast<decltype(g_mpv.name)>(LoadMpvSymbol(#name)); \
    if (!g_mpv.name) return false; \
  } while (0)

static bool LoadMpvDllFromAddonDirectory() {
  if (g_mpv.dll) return true;
  wchar_t directory[MAX_PATH];
  if (!GetAddonDirectory(directory, MAX_PATH)) return false;
  g_lastMpvLoadError = ERROR_SUCCESS;
  const wchar_t* names[] = {L"libmpv.dll", L"mpv-2.dll", L"libmpv-2.dll"};
  for (const wchar_t* name : names) {
    wchar_t candidate[MAX_PATH];
    wcscpy_s(candidate, directory);
    wcsncat_s(candidate, MAX_PATH, name, _TRUNCATE);
    g_mpv.dll = LoadLibraryExW(
      candidate,
      NULL,
      LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
    if (!g_mpv.dll) {
      g_lastMpvLoadError = GetLastError();
    }
    if (g_mpv.dll) break;
  }
  return g_mpv.dll != NULL;
}

static napi_value ThrowMpvLoadError(napi_env env) {
  char message[256];
  snprintf(
    message,
    sizeof(message),
    "Failed to load bundled libmpv.dll from native resource directory. Win32 error: %lu",
    (unsigned long)g_lastMpvLoadError);
  return Throw(env, message);
}

static bool EnsureMpvApiLoaded() {
  if (g_mpv.mpv_create) return true;
  if (!LoadMpvDllFromAddonDirectory()) return false;
  g_mpv.opengl32 = LoadLibraryW(L"opengl32.dll");
  LOAD_MPV_SYMBOL(mpv_create);
  LOAD_MPV_SYMBOL(mpv_initialize);
  LOAD_MPV_SYMBOL(mpv_terminate_destroy);
  LOAD_MPV_SYMBOL(mpv_error_string);
  LOAD_MPV_SYMBOL(mpv_request_log_messages);
  LOAD_MPV_SYMBOL(mpv_set_option_string);
  LOAD_MPV_SYMBOL(mpv_set_property);
  LOAD_MPV_SYMBOL(mpv_set_property_string);
  LOAD_MPV_SYMBOL(mpv_command);
  LOAD_MPV_SYMBOL(mpv_observe_property);
  LOAD_MPV_SYMBOL(mpv_wait_event);
  LOAD_MPV_SYMBOL(mpv_render_context_create);
  LOAD_MPV_SYMBOL(mpv_render_context_set_update_callback);
  LOAD_MPV_SYMBOL(mpv_render_context_render);
  LOAD_MPV_SYMBOL(mpv_render_context_free);
  return true;
}

static void* GetOpenGlProcAddress(void* ctx, const char* name) {
  (void)ctx;
  PROC proc = wglGetProcAddress(name);
  if (proc && proc != (PROC)1 && proc != (PROC)2 && proc != (PROC)3 && proc != (PROC)-1) {
    return reinterpret_cast<void*>(proc);
  }
  return g_mpv.opengl32 ? reinterpret_cast<void*>(GetProcAddress(g_mpv.opengl32, name)) : NULL;
}

static void Render(PlayerState* player) {
  if (!player || !player->render || !player->hdc || !player->glrc) return;
  RECT rect;
  if (!GetClientRect(player->hwnd, &rect)) return;
  int width = MaxInt(1, rect.right - rect.left);
  int height = MaxInt(1, rect.bottom - rect.top);
  wglMakeCurrent(player->hdc, player->glrc);
  glViewport(0, 0, width, height);
  mpv_opengl_fbo fbo = {0, width, height, 0};
  int flipY = 0;
  mpv_render_param params[] = {
    {MPV_RENDER_PARAM_OPENGL_FBO, &fbo},
    {MPV_RENDER_PARAM_FLIP_Y, &flipY},
    {MPV_RENDER_PARAM_INVALID, NULL},
  };
  g_mpv.mpv_render_context_render(player->render, params);
  SwapBuffers(player->hdc);
}

static void RenderUpdate(void* ctx) {
  PlayerState* player = (PlayerState*)ctx;
  if (!player || !player->hwnd) return;
  PostMessageW(player->hwnd, EHP_RENDER_MESSAGE, 0, 0);
}

static LRESULT CALLBACK MpvWindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
  PlayerState* player = (PlayerState*)GetWindowLongPtrW(hwnd, GWLP_USERDATA);
  if (message == WM_NCCREATE) {
    CREATESTRUCTW* create = (CREATESTRUCTW*)lParam;
    SetWindowLongPtrW(hwnd, GWLP_USERDATA, (LONG_PTR)create->lpCreateParams);
    return TRUE;
  }
  switch (message) {
    case WM_ERASEBKGND:
      return 1;
    case WM_SIZE:
    case EHP_RENDER_MESSAGE:
      Render(player);
      return 0;
    case WM_PAINT: {
      PAINTSTRUCT ps;
      BeginPaint(hwnd, &ps);
      Render(player);
      EndPaint(hwnd, &ps);
      return 0;
    }
    default:
      return DefWindowProcW(hwnd, message, wParam, lParam);
  }
}

static bool RegisterMpvWindowClass() {
  if (g_windowClass) return true;
  WNDCLASSEXW klass = {};
  klass.cbSize = sizeof(klass);
  klass.style = CS_OWNDC;
  klass.lpfnWndProc = MpvWindowProc;
  klass.hInstance = GetModuleHandleW(NULL);
  klass.hCursor = LoadCursor(NULL, IDC_ARROW);
  klass.lpszClassName = L"EhpEmbeddedMpvWindow";
  g_windowClass = RegisterClassExW(&klass);
  return g_windowClass != 0;
}

static bool CreateOpenGlContext(PlayerState* player) {
  player->hdc = GetDC(player->hwnd);
  if (!player->hdc) return false;
  PIXELFORMATDESCRIPTOR pfd = {};
  pfd.nSize = sizeof(pfd);
  pfd.nVersion = 1;
  pfd.dwFlags = PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER;
  pfd.iPixelType = PFD_TYPE_RGBA;
  pfd.cColorBits = 32;
  pfd.cAlphaBits = 8;
  pfd.cDepthBits = 0;
  pfd.iLayerType = PFD_MAIN_PLANE;
  int format = ChoosePixelFormat(player->hdc, &pfd);
  if (format == 0 || !SetPixelFormat(player->hdc, format, &pfd)) return false;
  player->glrc = wglCreateContext(player->hdc);
  if (!player->glrc) return false;
  return wglMakeCurrent(player->hdc, player->glrc) == TRUE;
}

static int CheckMpv(napi_env env, int status, const char* action) {
  if (status >= 0) return 1;
  char message[256];
  snprintf(message, sizeof(message), "%s failed: %s", action, g_mpv.mpv_error_string(status));
  napi_throw_error(env, NULL, message);
  return 0;
}

static void CleanupPlayer(PlayerState* player) {
  if (!player) return;
  if (player->render) {
    if (player->hdc && player->glrc) wglMakeCurrent(player->hdc, player->glrc);
    g_mpv.mpv_render_context_free(player->render);
    player->render = NULL;
  }
  if (player->mpv) {
    g_mpv.mpv_terminate_destroy(player->mpv);
    player->mpv = NULL;
  }
  if (player->glrc) {
    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(player->glrc);
    player->glrc = NULL;
  }
  if (player->hwnd && player->hdc) {
    ReleaseDC(player->hwnd, player->hdc);
    player->hdc = NULL;
  }
  if (player->hwnd) {
    DestroyWindow(player->hwnd);
    player->hwnd = NULL;
  }
  free(player);
}

static napi_value Create(napi_env env, napi_callback_info info) {
  size_t argc = 5;
  napi_value args[5];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc != 5) return Throw(env, "create(rootWindowHandle, x, y, width, height) requires 5 arguments");
  if (!EnsureMpvApiLoaded()) return ThrowMpvLoadError(env);
  if (!RegisterMpvWindowClass()) return Throw(env, "Failed to register MPV child window class");

  char* rootHandle = ReadString(env, args[0]);
  HWND parent = (HWND)(uintptr_t)ParsePointer(rootHandle, 10);
  free(rootHandle);
  if (!parent || !IsWindow(parent)) return Throw(env, "Electron native handle is not a HWND");

  const int x = (int)ReadDouble(env, args[1]);
  const int y = (int)ReadDouble(env, args[2]);
  const int width = MaxInt(1, (int)ReadDouble(env, args[3]));
  const int height = MaxInt(1, (int)ReadDouble(env, args[4]));

  PlayerState* player = (PlayerState*)calloc(1, sizeof(PlayerState));
  player->hwnd = CreateWindowExW(
    WS_EX_NOACTIVATE,
    L"EhpEmbeddedMpvWindow",
    L"",
    WS_CHILD | WS_VISIBLE | WS_CLIPSIBLINGS | WS_CLIPCHILDREN,
    x,
    y,
    width,
    height,
    parent,
    NULL,
    GetModuleHandleW(NULL),
    player);
  if (!player->hwnd) {
    CleanupPlayer(player);
    return Throw(env, "Failed to create MPV child window");
  }
  if (!CreateOpenGlContext(player)) {
    CleanupPlayer(player);
    return Throw(env, "Failed to create MPV OpenGL context");
  }

  player->mpv = g_mpv.mpv_create();
  if (!player->mpv) {
    CleanupPlayer(player);
    return Throw(env, "mpv_create failed");
  }
  g_mpv.mpv_request_log_messages(player->mpv, "info");
  g_mpv.mpv_set_option_string(player->mpv, "config", "no");
  g_mpv.mpv_set_option_string(player->mpv, "terminal", "no");
  g_mpv.mpv_set_option_string(player->mpv, "idle", "yes");
  g_mpv.mpv_set_option_string(player->mpv, "vo", "libmpv");
  if (!CheckMpv(env, g_mpv.mpv_initialize(player->mpv), "mpv_initialize")) {
    CleanupPlayer(player);
    return NULL;
  }

  mpv_opengl_init_params glInit = {GetOpenGlProcAddress, player};
  mpv_render_param params[] = {
    {MPV_RENDER_PARAM_API_TYPE, (void*)MPV_RENDER_API_TYPE_OPENGL},
    {MPV_RENDER_PARAM_OPENGL_INIT_PARAMS, &glInit},
    {MPV_RENDER_PARAM_INVALID, NULL},
  };
  int renderStatus = g_mpv.mpv_render_context_create(&player->render, player->mpv, params);
  if (renderStatus >= 0) {
    g_mpv.mpv_render_context_set_update_callback(player->render, RenderUpdate, player);
  }
  if (!CheckMpv(env, renderStatus, "mpv_render_context_create")) {
    CleanupPlayer(player);
    return NULL;
  }

  g_mpv.mpv_observe_property(player->mpv, 1, "time-pos", MPV_FORMAT_DOUBLE);
  g_mpv.mpv_observe_property(player->mpv, 2, "duration", MPV_FORMAT_DOUBLE);
  g_mpv.mpv_observe_property(player->mpv, 3, "pause", MPV_FORMAT_FLAG);
  g_mpv.mpv_observe_property(player->mpv, 4, "cache-speed", MPV_FORMAT_DOUBLE);

  char pointer[32];
  snprintf(pointer, sizeof(pointer), "%llu", (unsigned long long)(uintptr_t)player);
  napi_value result;
  napi_create_string_utf8(env, pointer, NAPI_AUTO_LENGTH, &result);
  return result;
}

static int SetHeaderFields(napi_env env, mpv_handle* mpv, napi_value fieldsValue) {
  bool isArray = false;
  napi_is_array(env, fieldsValue, &isArray);
  if (!isArray) return 1;
  uint32_t length = 0;
  napi_get_array_length(env, fieldsValue, &length);
  mpv_node* values = (mpv_node*)calloc(length, sizeof(mpv_node));
  for (uint32_t index = 0; index < length; index++) {
    napi_value item;
    napi_get_element(env, fieldsValue, index, &item);
    values[index].format = MPV_FORMAT_STRING;
    values[index].u.string = ReadString(env, item);
  }
  mpv_node_list list;
  list.num = (int)length;
  list.values = values;
  list.keys = NULL;
  mpv_node node;
  node.format = MPV_FORMAT_NODE_ARRAY;
  node.u.list = &list;
  int status = g_mpv.mpv_set_property(mpv, "http-header-fields", MPV_FORMAT_NODE, &node);
  for (uint32_t index = 0; index < length; index++) free(values[index].u.string);
  free(values);
  return status;
}

static napi_value Load(napi_env env, napi_callback_info info) {
  size_t argc = 7;
  napi_value args[7];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc != 7) return Throw(env, "load(player, url, title, startSeconds, userAgent, referer, headers) requires 7 arguments");
  PlayerState* player = ReadPlayer(env, args[0]);
  if (!player || !player->mpv) return Throw(env, "MPV player is not available");

  char* url = ReadString(env, args[1]);
  char* userAgent = ReadString(env, args[4]);
  char* referer = ReadString(env, args[5]);
  if (strlen(userAgent) > 0) g_mpv.mpv_set_property_string(player->mpv, "user-agent", userAgent);
  if (strlen(referer) > 0) g_mpv.mpv_set_property_string(player->mpv, "referrer", referer);
  int headerStatus = SetHeaderFields(env, player->mpv, args[6]);
  if (!CheckMpv(env, headerStatus, "set http-header-fields")) return NULL;

  const char* cmd[] = {"loadfile", url, "replace", NULL};
  int status = g_mpv.mpv_command(player->mpv, cmd);
  free(url);
  free(userAgent);
  free(referer);
  if (!CheckMpv(env, status, "loadfile")) return NULL;
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

static napi_value Command(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc != 3) return Throw(env, "command(player, command, value) requires 3 arguments");
  PlayerState* player = ReadPlayer(env, args[0]);
  if (!player || !player->mpv) return Throw(env, "MPV player is not available");
  char* command = ReadString(env, args[1]);
  int status = 0;
  if (strcmp(command, "set-pause") == 0 || strcmp(command, "set-muted") == 0) {
    bool value = false;
    napi_get_value_bool(env, args[2], &value);
    int flag = value ? 1 : 0;
    status = g_mpv.mpv_set_property(player->mpv, strcmp(command, "set-pause") == 0 ? "pause" : "mute", MPV_FORMAT_FLAG, &flag);
  } else if (
    strcmp(command, "seek-absolute") == 0 ||
    strcmp(command, "set-volume") == 0 ||
    strcmp(command, "set-rate") == 0 ||
    strcmp(command, "set-audio-track") == 0 ||
    strcmp(command, "set-subtitle-track") == 0
  ) {
    double value = ReadDouble(env, args[2]);
    if (strcmp(command, "seek-absolute") == 0) {
      char seconds[64];
      snprintf(seconds, sizeof(seconds), "%f", value);
      const char* seek[] = {"seek", seconds, "absolute", NULL};
      status = g_mpv.mpv_command(player->mpv, seek);
    } else if (strcmp(command, "set-audio-track") == 0 || strcmp(command, "set-subtitle-track") == 0) {
      char track[32];
      if (strcmp(command, "set-subtitle-track") == 0 && value < 0) snprintf(track, sizeof(track), "no");
      else snprintf(track, sizeof(track), "%d", (int)value);
      status = g_mpv.mpv_set_property_string(player->mpv, strcmp(command, "set-audio-track") == 0 ? "aid" : "sid", track);
    } else {
      status = g_mpv.mpv_set_property(player->mpv, strcmp(command, "set-volume") == 0 ? "volume" : "speed", MPV_FORMAT_DOUBLE, &value);
    }
  } else {
    free(command);
    return Throw(env, "Unsupported MPV command");
  }
  free(command);
  if (!CheckMpv(env, status, "mpv command")) return NULL;
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

static napi_value SetBounds(napi_env env, napi_callback_info info) {
  size_t argc = 5;
  napi_value args[5];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc != 5) return Throw(env, "setBounds(player, x, y, width, height) requires 5 arguments");
  PlayerState* player = ReadPlayer(env, args[0]);
  if (!player || !player->hwnd) return Throw(env, "MPV player window is not available");
  MoveWindow(
    player->hwnd,
    (int)ReadDouble(env, args[1]),
    (int)ReadDouble(env, args[2]),
    MaxInt(1, (int)ReadDouble(env, args[3])),
    MaxInt(1, (int)ReadDouble(env, args[4])),
    TRUE);
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

static napi_value PollEvent(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc != 1) return Throw(env, "pollEvent(player) requires 1 argument");
  PlayerState* player = ReadPlayer(env, args[0]);
  if (!player || !player->mpv) return Throw(env, "MPV player is not available");
  mpv_event* event = g_mpv.mpv_wait_event(player->mpv, 0);
  if (!event || event->event_id == MPV_EVENT_NONE) {
    napi_value result;
    napi_get_null(env, &result);
    return result;
  }
  napi_value result;
  napi_create_object(env, &result);
  napi_value type;
  switch (event->event_id) {
    case MPV_EVENT_LOG_MESSAGE: {
      mpv_event_log_message* log = (mpv_event_log_message*)event->data;
      if (!log) {
        napi_get_null(env, &result);
        return result;
      }
      napi_create_string_utf8(env, "log", NAPI_AUTO_LENGTH, &type);
      napi_set_named_property(env, result, "type", type);
      napi_value level;
      napi_create_string_utf8(env, log->level ? log->level : "unknown", NAPI_AUTO_LENGTH, &level);
      napi_set_named_property(env, result, "level", level);
      napi_value prefix;
      napi_create_string_utf8(env, log->prefix ? log->prefix : "mpv", NAPI_AUTO_LENGTH, &prefix);
      napi_set_named_property(env, result, "prefix", prefix);
      napi_value message;
      napi_create_string_utf8(env, log->text ? log->text : "", NAPI_AUTO_LENGTH, &message);
      napi_set_named_property(env, result, "message", message);
      break;
    }
    case MPV_EVENT_FILE_LOADED:
      napi_create_string_utf8(env, "started", NAPI_AUTO_LENGTH, &type);
      napi_set_named_property(env, result, "type", type);
      break;
    case MPV_EVENT_END_FILE: {
      mpv_event_end_file* end = (mpv_event_end_file*)event->data;
      if (end && end->reason == MPV_END_FILE_REASON_ERROR) {
        napi_create_string_utf8(env, "error", NAPI_AUTO_LENGTH, &type);
        napi_set_named_property(env, result, "type", type);
        char message[256];
        snprintf(message, sizeof(message), "MPV 加载失败：%s", g_mpv.mpv_error_string(end->error));
        napi_value errorMessage;
        napi_create_string_utf8(env, message, NAPI_AUTO_LENGTH, &errorMessage);
        napi_set_named_property(env, result, "message", errorMessage);
      } else {
        napi_create_string_utf8(env, "ended", NAPI_AUTO_LENGTH, &type);
        napi_set_named_property(env, result, "type", type);
      }
      break;
    }
    case MPV_EVENT_PROPERTY_CHANGE: {
      mpv_event_property* prop = (mpv_event_property*)event->data;
      if (!prop || !prop->data) {
        napi_get_null(env, &result);
        return result;
      }
      if (strcmp(prop->name, "time-pos") == 0 || strcmp(prop->name, "duration") == 0) {
        napi_create_string_utf8(env, strcmp(prop->name, "time-pos") == 0 ? "time" : "duration", NAPI_AUTO_LENGTH, &type);
        napi_set_named_property(env, result, "type", type);
        napi_value seconds;
        napi_create_double(env, *(double*)prop->data, &seconds);
        napi_set_named_property(env, result, "seconds", seconds);
      } else if (strcmp(prop->name, "pause") == 0) {
        napi_create_string_utf8(env, "paused", NAPI_AUTO_LENGTH, &type);
        napi_set_named_property(env, result, "type", type);
        napi_value paused;
        napi_get_boolean(env, *(int*)prop->data != 0, &paused);
        napi_set_named_property(env, result, "paused", paused);
      } else if (strcmp(prop->name, "cache-speed") == 0) {
        napi_create_string_utf8(env, "network", NAPI_AUTO_LENGTH, &type);
        napi_set_named_property(env, result, "type", type);
        napi_value bytesPerSecond;
        napi_create_double(env, *(double*)prop->data, &bytesPerSecond);
        napi_set_named_property(env, result, "bytesPerSecond", bytesPerSecond);
      } else {
        napi_get_null(env, &result);
      }
      break;
    }
    case MPV_EVENT_SHUTDOWN:
      napi_create_string_utf8(env, "ended", NAPI_AUTO_LENGTH, &type);
      napi_set_named_property(env, result, "type", type);
      break;
    default:
      napi_get_null(env, &result);
      break;
  }
  return result;
}

static napi_value Destroy(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc != 1) return Throw(env, "destroy(player) requires 1 argument");
  CleanupPlayer(ReadPlayer(env, args[0]));
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
    {"create", NULL, Create, NULL, NULL, NULL, napi_default, NULL},
    {"load", NULL, Load, NULL, NULL, NULL, napi_default, NULL},
    {"command", NULL, Command, NULL, NULL, NULL, napi_default, NULL},
    {"setBounds", NULL, SetBounds, NULL, NULL, NULL, napi_default, NULL},
    {"pollEvent", NULL, PollEvent, NULL, NULL, NULL, napi_default, NULL},
    {"destroy", NULL, Destroy, NULL, NULL, NULL, napi_default, NULL},
  };
  napi_define_properties(env, exports, 6, descriptors);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
