// Prefs for the patched Firefox build used to run this app. See firefox/README.md.

// Exposes CanvasRenderingContext2D.drawWindow to web content (added by firefox.patch)
user_pref("gfx.canvas.drawWindow.content.enabled", true);

// Keeps 2D canvases in CPU memory. drawWindow renders on the CPU, so GPU canvases are slow to capture.
user_pref("gfx.canvas.accelerated", false);

user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
