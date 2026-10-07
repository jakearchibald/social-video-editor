# Running in Firefox

Firefox doesn't support `drawElementImage` or File System Access handles to real directories, so the app has fallbacks:

- **Output capture**: if `drawElementImage` is missing, the output is rendered outside the canvas, and captured with `drawWindow`. This is normally only available to Firefox's own UI and extensions; `firefox.patch` exposes it to web content behind the `gfx.canvas.drawWindow.content.enabled` pref.
- **Files**: if `showDirectoryPicker` is missing, `app/utils/fs-shim.ts` installs an implementation backed by the dev server (`fs-shim/vite-plugin.ts`). It can access anything under `~/dev/videos`, or `FS_SHIM_ROOT` if set, and only accepts same-origin requests from localhost.
- **Encoding**: Firefox's software AV1 encoder is slow, and shifts colours, so hardware H.264 at 100 Mbps is used instead.
- **Video with alpha**: Mediabunny merges color and alpha with WebGL, which is slow in Firefox, as each frame is copied between the CPU and GPU several times. `app/utils/alpha-video-decoder.ts` merges them on the CPU instead. `firefox.patch` also makes `prefer-software` WebCodecs decoders output frames in CPU memory, rather than IOSurfaces that have to be read back.

The capture and file fallbacks are insecure, and only intended for local use.

## Setup

```sh
cd ~/src/firefox
git apply ~/dev/social-video-editor/firefox/firefox.patch
cat > mozconfig-video <<'EOF'
ac_add_options --enable-optimize
ac_add_options --disable-debug
mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/obj-video
EOF
MOZCONFIG=$PWD/mozconfig-video ./mach build
```

The patch was made against Firefox commit `cfd140a311d8`. An optimized build matters: a debug build is far too slow to render and encode with.

## Running

Start the dev server, then launch Firefox with a dedicated profile that has the prefs in `user.js`:

```sh
pnpm dev
./firefox/run.sh http://localhost:5173/
```
