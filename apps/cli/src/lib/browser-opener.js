// Resolve the platform-appropriate command + argv for opening a file in the
// default application (browser). Pure: takes the platform string so the win32
// branch is unit-testable without spawning.
//
// NOTE on win32: `start` is a cmd.exe builtin, NOT an executable — invoking it
// via execFile("start", ...) throws ENOENT. It must be run through cmd.exe.
// The empty-string title argument is mandatory: `start "path"` treats a quoted
// first argument as the window title, so `start "" "path"` is required to make
// the path the thing being opened.
export function openerArgv(platform, targetPath) {
  if (platform === "darwin") {
    return { cmd: "open", args: [targetPath] };
  }
  if (platform === "win32") {
    return { cmd: "cmd.exe", args: ["/c", "start", "", targetPath] };
  }
  return { cmd: "xdg-open", args: [targetPath] };
}
