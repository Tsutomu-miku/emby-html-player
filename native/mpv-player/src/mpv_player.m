#include <node_api.h>

#define GL_SILENCE_DEPRECATION 1

#import <AppKit/AppKit.h>
#import <OpenGL/gl3.h>
#import <QuartzCore/QuartzCore.h>
#import <dispatch/dispatch.h>

#include <dlfcn.h>
#include <mpv/client.h>
#include <mpv/render.h>
#include <mpv/render_gl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct PlayerState PlayerState;

@interface EhpMpvOpenGLView : NSOpenGLView
@property(nonatomic, assign) PlayerState* player;
@end

struct PlayerState {
  mpv_handle* mpv;
  mpv_render_context* render;
  EhpMpvOpenGLView* view;
  void* glHandle;
  int firstFrameRendered;
  int firstFrameEventPending;
};

static napi_value Throw(napi_env env, const char* message) {
  napi_throw_error(env, NULL, message);
  return NULL;
}

static char* ReadString(napi_env env, napi_value value) {
  size_t length = 0;
  napi_get_value_string_utf8(env, value, NULL, 0, &length);
  char* result = calloc(length + 1, sizeof(char));
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

static PlayerState* ReadPlayer(napi_env env, napi_value value) {
  char* handle = ReadString(env, value);
  PlayerState* player = (PlayerState*)(uintptr_t)ParsePointer(handle, 10);
  free(handle);
  return player;
}

static NSRect ToCocoaFrame(NSView* rootView, double x, double y, double width, double height) {
  const NSRect bounds = [rootView bounds];
  return NSMakeRect(x, NSHeight(bounds) - y - height, width, height);
}

static void RunOnMainSync(dispatch_block_t block) {
  if ([NSThread isMainThread]) {
    block();
    return;
  }
  dispatch_sync(dispatch_get_main_queue(), block);
}

static void* GetProcAddress(void* ctx, const char* name) {
  PlayerState* player = (PlayerState*)ctx;
  if (!player->glHandle) {
    player->glHandle = dlopen("/System/Library/Frameworks/OpenGL.framework/OpenGL", RTLD_LAZY);
  }
  return player->glHandle ? dlsym(player->glHandle, name) : NULL;
}

static void RenderUpdate(void* ctx) {
  PlayerState* player = (PlayerState*)ctx;
  if (!player || !player->view) return;
  dispatch_async(dispatch_get_main_queue(), ^{
    [player->view setNeedsDisplay:YES];
  });
}

@implementation EhpMpvOpenGLView

- (void)prepareOpenGL {
  [super prepareOpenGL];
  GLint swapInterval = 1;
  [[self openGLContext] setValues:&swapInterval forParameter:NSOpenGLContextParameterSwapInterval];
}

- (void)drawRect:(NSRect)dirtyRect {
  (void)dirtyRect;
  if (!_player || !_player->render) return;
  [[self openGLContext] makeCurrentContext];
  NSRect bounds = [self bounds];
  CGFloat scale = [[self window] backingScaleFactor];
  int width = (int)MAX(1, bounds.size.width * scale);
  int height = (int)MAX(1, bounds.size.height * scale);
  uint64_t updateFlags = mpv_render_context_update(_player->render);
  glViewport(0, 0, width, height);
  mpv_opengl_fbo fbo = {0, width, height, 0};
  int flipY = 1;
  mpv_render_param params[] = {
    {MPV_RENDER_PARAM_OPENGL_FBO, &fbo},
    {MPV_RENDER_PARAM_FLIP_Y, &flipY},
    {MPV_RENDER_PARAM_INVALID, NULL},
  };
  mpv_render_context_render(_player->render, params);
  if (!_player->firstFrameRendered && (updateFlags & MPV_RENDER_UPDATE_FRAME)) {
    _player->firstFrameRendered = 1;
    _player->firstFrameEventPending = 1;
  }
  [[self openGLContext] flushBuffer];
}

- (NSView*)hitTest:(NSPoint)point {
  (void)point;
  return nil;
}

@end

static int CheckMpv(napi_env env, int status, const char* action) {
  if (status >= 0) return 1;
  char message[256];
  snprintf(message, sizeof(message), "%s failed: %s", action, mpv_error_string(status));
  napi_throw_error(env, NULL, message);
  return 0;
}

static EhpMpvOpenGLView* CreateView(NSView* rootView, double x, double y, double width, double height) {
  NSOpenGLPixelFormatAttribute attrs[] = {
    NSOpenGLPFADoubleBuffer,
    NSOpenGLPFAAccelerated,
    NSOpenGLPFAOpenGLProfile, NSOpenGLProfileVersion3_2Core,
    NSOpenGLPFAColorSize, 24,
    NSOpenGLPFAAlphaSize, 8,
    NSOpenGLPFADepthSize, 0,
    0,
  };
  NSOpenGLPixelFormat* format = [[NSOpenGLPixelFormat alloc] initWithAttributes:attrs];
  EhpMpvOpenGLView* view = [[EhpMpvOpenGLView alloc] initWithFrame:ToCocoaFrame(rootView, x, y, width, height) pixelFormat:format];
  [view setWantsBestResolutionOpenGLSurface:YES];
  [rootView addSubview:view];
  [[view openGLContext] makeCurrentContext];
  return view;
}

static napi_value Create(napi_env env, napi_callback_info info) {
  size_t argc = 5;
  napi_value args[5];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc != 5) return Throw(env, "create(rootViewHandle, x, y, width, height) requires 5 arguments");

  char* rootViewHandle = ReadString(env, args[0]);
  NSView* rootView = (__bridge NSView*)((void*)(uintptr_t)ParsePointer(rootViewHandle, 10));
  free(rootViewHandle);
  if (!rootView || ![(id)rootView isKindOfClass:[NSView class]]) {
    return Throw(env, "Electron native handle is not an NSView");
  }
  const double x = ReadDouble(env, args[1]);
  const double y = ReadDouble(env, args[2]);
  const double width = ReadDouble(env, args[3]);
  const double height = ReadDouble(env, args[4]);

  PlayerState* player = calloc(1, sizeof(PlayerState));
  __block NSString* viewError = nil;
  RunOnMainSync(^{
    @try {
      player->view = CreateView(rootView, x, y, width, height);
      player->view.player = player;
    } @catch (NSException* exception) {
      viewError = [exception reason];
    }
  });
  if (viewError) {
    free(player);
    return Throw(env, [viewError UTF8String]);
  }
  if (!player->view) {
    free(player);
    return Throw(env, "Failed to create MPV OpenGL view");
  }

  player->mpv = mpv_create();
  if (!player->mpv) {
    RunOnMainSync(^{
      player->view.player = NULL;
      [player->view removeFromSuperview];
      player->view = nil;
    });
    free(player);
    return Throw(env, "mpv_create failed");
  }
  mpv_request_log_messages(player->mpv, "info");
  mpv_set_option_string(player->mpv, "config", "no");
  mpv_set_option_string(player->mpv, "terminal", "no");
  mpv_set_option_string(player->mpv, "idle", "yes");
  mpv_set_option_string(player->mpv, "vo", "libmpv");
  if (!CheckMpv(env, mpv_initialize(player->mpv), "mpv_initialize")) {
    mpv_terminate_destroy(player->mpv);
    RunOnMainSync(^{
      player->view.player = NULL;
      [player->view removeFromSuperview];
      player->view = nil;
    });
    free(player);
    return NULL;
  }

  __block int renderStatus = 0;
  RunOnMainSync(^{
    [[player->view openGLContext] makeCurrentContext];
    mpv_opengl_init_params glInit = {GetProcAddress, player};
    mpv_render_param params[] = {
      {MPV_RENDER_PARAM_API_TYPE, (void*)MPV_RENDER_API_TYPE_OPENGL},
      {MPV_RENDER_PARAM_OPENGL_INIT_PARAMS, &glInit},
      {MPV_RENDER_PARAM_INVALID, NULL},
    };
    renderStatus = mpv_render_context_create(&player->render, player->mpv, params);
    if (renderStatus >= 0) {
      mpv_render_context_set_update_callback(player->render, RenderUpdate, player);
    }
  });
  if (!CheckMpv(env, renderStatus, "mpv_render_context_create")) {
    mpv_terminate_destroy(player->mpv);
    RunOnMainSync(^{
      player->view.player = NULL;
      [player->view removeFromSuperview];
      player->view = nil;
    });
    free(player);
    return NULL;
  }

  mpv_observe_property(player->mpv, 1, "time-pos", MPV_FORMAT_DOUBLE);
  mpv_observe_property(player->mpv, 2, "duration", MPV_FORMAT_DOUBLE);
  mpv_observe_property(player->mpv, 3, "pause", MPV_FORMAT_FLAG);
  mpv_observe_property(player->mpv, 4, "cache-speed", MPV_FORMAT_DOUBLE);

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
  mpv_node* values = calloc(length, sizeof(mpv_node));
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
  int status = mpv_set_property(mpv, "http-header-fields", MPV_FORMAT_NODE, &node);
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
  if (strlen(userAgent) > 0) mpv_set_property_string(player->mpv, "user-agent", userAgent);
  if (strlen(referer) > 0) mpv_set_property_string(player->mpv, "referrer", referer);
  int headerStatus = SetHeaderFields(env, player->mpv, args[6]);
  if (!CheckMpv(env, headerStatus, "set http-header-fields")) return NULL;
  player->firstFrameRendered = 0;
  player->firstFrameEventPending = 0;

  const char* cmd[] = {"loadfile", url, "replace", NULL};
  int status = mpv_command(player->mpv, cmd);
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
    status = mpv_set_property(player->mpv, strcmp(command, "set-pause") == 0 ? "pause" : "mute", MPV_FORMAT_FLAG, &flag);
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
      status = mpv_command(player->mpv, seek);
    } else if (strcmp(command, "set-audio-track") == 0 || strcmp(command, "set-subtitle-track") == 0) {
      char track[32];
      if (strcmp(command, "set-subtitle-track") == 0 && value < 0) {
        snprintf(track, sizeof(track), "no");
      } else {
        snprintf(track, sizeof(track), "%d", (int)value);
      }
      status = mpv_set_property_string(player->mpv, strcmp(command, "set-audio-track") == 0 ? "aid" : "sid", track);
    } else {
      status = mpv_set_property(player->mpv, strcmp(command, "set-volume") == 0 ? "volume" : "speed", MPV_FORMAT_DOUBLE, &value);
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
  if (!player || !player->view) return Throw(env, "MPV player view is not available");
  const double x = ReadDouble(env, args[1]);
  const double y = ReadDouble(env, args[2]);
  const double width = ReadDouble(env, args[3]);
  const double height = ReadDouble(env, args[4]);
  __block NSString* error = nil;
  RunOnMainSync(^{
    @try {
      NSView* rootView = [player->view superview];
      if (rootView) {
        [player->view setFrame:ToCocoaFrame(rootView, x, y, width, height)];
        [player->view setNeedsDisplay:YES];
      }
    } @catch (NSException* exception) {
      error = [exception reason];
    }
  });
  if (error) return Throw(env, [error UTF8String]);
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
  if (player->firstFrameEventPending) {
    player->firstFrameEventPending = 0;
    napi_value result;
    napi_create_object(env, &result);
    napi_value type;
    napi_create_string_utf8(env, "rendered", NAPI_AUTO_LENGTH, &type);
    napi_set_named_property(env, result, "type", type);
    return result;
  }
  mpv_event* event = mpv_wait_event(player->mpv, 0);
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
        snprintf(message, sizeof(message), "MPV 加载失败：%s", mpv_error_string(end->error));
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
  PlayerState* player = ReadPlayer(env, args[0]);
  if (!player) {
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
  }
  if (player->render) {
    RunOnMainSync(^{
      if (player->view) {
        [[player->view openGLContext] makeCurrentContext];
      }
      mpv_render_context_free(player->render);
    });
    player->render = NULL;
  }
  if (player->mpv) {
    mpv_terminate_destroy(player->mpv);
    player->mpv = NULL;
  }
  RunOnMainSync(^{
    if (player->view) {
      player->view.player = NULL;
      [player->view removeFromSuperview];
      player->view = nil;
    }
  });
  if (player->glHandle) dlclose(player->glHandle);
  free(player);
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
