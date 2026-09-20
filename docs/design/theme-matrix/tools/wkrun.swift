// Runs a URL in a real WKWebView (the same WebKit the Tauri app embeds) and
// evaluates a list of JS steps against it. Window is off-screen; no screen control.
import Cocoa
import WebKit

let args = CommandLine.arguments
guard args.count >= 4 else { FileHandle.standardError.write("usage: wkrun <url> <steps.json> <out.json>\n".data(using: .utf8)!); exit(2) }
let outPath = args[3]
func log(_ m: String) { try? m.appending("\n").data(using: .utf8)!.write(to: URL(fileURLWithPath: outPath + ".log"), options: []) }
let url = URL(string: args[1])!
let stepsData = try! Data(contentsOf: URL(fileURLWithPath: args[2]))
let steps = try! JSONSerialization.jsonObject(with: stepsData) as! [[String: Any]]

let app = NSApplication.shared
app.setActivationPolicy(.regular)

let cfg = WKWebViewConfiguration()
cfg.preferences.setValue(true, forKey: "developerExtrasEnabled")
let frame = NSRect(x: 0, y: 0, width: 1440, height: 900)
// The view lays out at 1440x900 regardless of how much of the window is on
// screen; parking all but a 60pt corner keeps visibilityState "visible" (so
// WebKit does not throttle) while staying out of the user's way.
let scr = NSScreen.main!.frame
let win = NSWindow(contentRect: NSRect(x: scr.midX - 720, y: scr.midY - 450, width: 1440, height: 900),
                   styleMask: [.titled, .closable], backing: .buffered, defer: false)
win.title = "KIRA WebKit QA probe"
win.isReleasedWhenClosed = false
let web = WKWebView(frame: frame, configuration: cfg)
win.contentView = web
win.orderFrontRegardless()

final class Nav: NSObject, WKNavigationDelegate {
    var done = false
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) { done = true }
    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { done = true }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
        FileHandle.standardError.write("NAVFAIL \(e)\n".data(using: .utf8)!); done = true
    }
}
let nav = Nav()
web.navigationDelegate = nav
web.load(URLRequest(url: url))

func pump(_ seconds: Double) {
    let end = Date().addingTimeInterval(seconds)
    while Date() < end { RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.02)) }
}
func eval(_ js: String, timeout: Double = 30) -> Any? {
    var out: Any? = nil; var finished = false
    web.evaluateJavaScript(js) { r, e in
        if let e = e { out = ["__error": String(describing: e)] } else { out = r }
        finished = true
    }
    let end = Date().addingTimeInterval(timeout)
    while !finished && Date() < end { RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.02)) }
    return out
}

NSApp.activate(ignoringOtherApps: true)
pump(0.6)
win.makeKeyAndOrderFront(nil)
pump(0.6)


var waited = 0.0
while !nav.done && waited < 30 { pump(0.2); waited += 0.2 }
pump(3.0)
NSApp.activate(ignoringOtherApps: true)
win.makeKeyAndOrderFront(nil)
pump(0.8)
let envInfo = "appActive=\(NSApp.isActive) key=\(win.isKeyWindow)"

func snapshot(_ path: String, rect: NSRect?) -> String {
    let cfg = WKSnapshotConfiguration()
    if let r = rect { cfg.rect = r }
    var msg = "pending"; var finished = false
    web.takeSnapshot(with: cfg) { img, err in
        if let img = img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
           let png = rep.representation(using: .png, properties: [:]) {
            do { try png.write(to: URL(fileURLWithPath: path)); msg = "saved \(path)" } catch { msg = "write failed \(error)" }
        } else { msg = "snapshot failed \(String(describing: err))" }
        finished = true
    }
    let end = Date().addingTimeInterval(20)
    while !finished && Date() < end { RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.02)) }
    return msg
}

var results: [Any] = []
for s in steps {
    let wait = (s["wait"] as? Double) ?? 0.6
    if let shot = s["shot"] as? String {
        var rect: NSRect? = nil
        if let r = s["rect"] as? [Double], r.count == 4 { rect = NSRect(x: r[0], y: r[1], width: r[2], height: r[3]) }
        results.append(["name": s["name"] ?? "", "r": snapshot(shot, rect: rect)])
        pump(wait); continue
    }
    let js = s["js"] as! String
    let r = eval(js)
    results.append(["name": s["name"] ?? "", "r": r ?? NSNull()])
    pump(wait)
}
let payload: [String: Any] = ["windowState": envInfo, "results": results]
let outData = try! JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .fragmentsAllowed])
try? outData.write(to: URL(fileURLWithPath: outPath))
exit(0)
