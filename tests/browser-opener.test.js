import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openerArgv } from "../apps/cli/src/lib/browser-opener.js";

describe("openerArgv", () => {
  it("uses `open` with the path on darwin", () => {
    assert.deepEqual(openerArgv("darwin", "/tmp/x.html"), {
      cmd: "open",
      args: ["/tmp/x.html"],
    });
  });

  it("uses `xdg-open` with the path on linux", () => {
    assert.deepEqual(openerArgv("linux", "/tmp/x.html"), {
      cmd: "xdg-open",
      args: ["/tmp/x.html"],
    });
  });

  it("uses cmd.exe with the empty title arg on win32 (start is a builtin, not an exe)", () => {
    assert.deepEqual(openerArgv("win32", "C:\\Users\\x\\dash.html"), {
      cmd: "cmd.exe",
      args: ["/c", "start", "", "C:\\Users\\x\\dash.html"],
    });
  });

  it("falls back to xdg-open for unknown platforms", () => {
    assert.deepEqual(openerArgv("freebsd", "/tmp/x.html"), {
      cmd: "xdg-open",
      args: ["/tmp/x.html"],
    });
  });
});
