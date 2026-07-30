import AppKit
import ApplicationServices
import Foundation
import Quartz
import Vision

enum ScriptError: Error, CustomStringConvertible {
  case message(String)

  var description: String {
    switch self {
    case .message(let value):
      return value
    }
  }
}

struct Args {
  var appName = "Google Chrome"
  var text = ""
  var mode = "list"
  var match = "contains"
  var clickIndex = 0
  var offsetX: CGFloat = 0
  var offsetY: CGFloat = 0
}

struct OCRHit {
  let text: String
  let center: CGPoint
  let confidence: Float
}

func parseArgs() throws -> Args {
  var args = Args()
  let raw = Array(CommandLine.arguments.dropFirst())
  var index = 0
  while index < raw.count {
    let item = raw[index]
    switch item {
    case "--app":
      index += 1
      args.appName = raw[safe: index] ?? args.appName
    case "--text":
      index += 1
      args.text = raw[safe: index] ?? args.text
    case "--mode":
      index += 1
      args.mode = raw[safe: index] ?? args.mode
    case "--match":
      index += 1
      args.match = raw[safe: index] ?? args.match
    case "--click-index":
      index += 1
      args.clickIndex = Int(raw[safe: index] ?? "0") ?? 0
    case "--offset-x":
      index += 1
      args.offsetX = CGFloat(Double(raw[safe: index] ?? "0") ?? 0)
    case "--offset-y":
      index += 1
      args.offsetY = CGFloat(Double(raw[safe: index] ?? "0") ?? 0)
    default:
      break
    }
    index += 1
  }
  return args
}

func attr(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
  var value: CFTypeRef?
  let error = AXUIElementCopyAttributeValue(element, name as CFString, &value)
  if error == .success {
    return value
  }
  return nil
}

func focusedWindow(for appName: String) throws -> (pid: pid_t, window: AXUIElement, title: String) {
  let apps = NSWorkspace.shared.runningApplications.filter { $0.localizedName == appName }
  guard let app = apps.first else {
    throw ScriptError.message("App \(appName) tidak ditemukan.")
  }
  app.activate(options: [.activateIgnoringOtherApps])
  usleep(300_000)
  let axApp = AXUIElementCreateApplication(app.processIdentifier)
  let raw = attr(axApp, kAXFocusedWindowAttribute) ?? attr(axApp, kAXMainWindowAttribute)
  guard let raw else {
    throw ScriptError.message("Focused window \(appName) tidak ditemukan.")
  }
  let window = unsafeBitCast(raw, to: AXUIElement.self)
  let title = (attr(window, kAXTitleAttribute) as? String) ?? ""
  return (app.processIdentifier, window, title)
}

func windowRect(_ window: AXUIElement) -> CGRect {
  var point = CGPoint.zero
  var size = CGSize.zero
  if let posVal = attr(window, kAXPositionAttribute) {
    AXValueGetValue(posVal as! AXValue, .cgPoint, &point)
  }
  if let sizeVal = attr(window, kAXSizeAttribute) {
    AXValueGetValue(sizeVal as! AXValue, .cgSize, &size)
  }
  return CGRect(origin: point, size: size)
}

func chromeWindowID(for pid: pid_t, title: String, rect: CGRect) throws -> CGWindowID {
  func cg(_ value: Any?) -> CGFloat {
    if let doubleValue = value as? Double { return CGFloat(doubleValue) }
    if let intValue = value as? Int { return CGFloat(intValue) }
    if let numberValue = value as? NSNumber { return CGFloat(numberValue.doubleValue) }
    return 0
  }

  let windows = CGWindowListCopyWindowInfo(.optionAll, kCGNullWindowID) as NSArray? ?? []
  for item in windows {
    guard let info = item as? [String: Any] else { continue }
    let owner = info[kCGWindowOwnerName as String] as? String ?? ""
    let ownerPID = pid_t(info[kCGWindowOwnerPID as String] as? Int ?? 0)
    let name = info[kCGWindowName as String] as? String ?? ""
    guard owner == "Google Chrome" || owner == "Chromium" || owner == "Arc" || ownerPID == pid else {
      continue
    }
    guard let bounds = info[kCGWindowBounds as String] as? [String: Any] else { continue }
    let width = cg(bounds["Width"])
    let height = cg(bounds["Height"])
    let x = cg(bounds["X"])
    let y = cg(bounds["Y"])
    let layer = info[kCGWindowLayer as String] as? Int ?? 0
    let sameRect = abs(width - rect.width) < 2 && abs(height - rect.height) < 2 && abs(x - rect.origin.x) < 2 && abs(y - rect.origin.y) < 2
    if !title.isEmpty && name == title {
      return CGWindowID(info[kCGWindowNumber as String] as? Int ?? 0)
    }
    if !title.isEmpty && title.contains(name) && !name.isEmpty {
      return CGWindowID(info[kCGWindowNumber as String] as? Int ?? 0)
    }
    if sameRect && !name.isEmpty {
      return CGWindowID(info[kCGWindowNumber as String] as? Int ?? 0)
    }
    if sameRect && layer == 0 {
      return CGWindowID(info[kCGWindowNumber as String] as? Int ?? 0)
    }
  }
  throw ScriptError.message("CGWindowID tidak ditemukan untuk window aktif.")
}

func captureWindow(windowID: CGWindowID) throws -> URL {
  let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("chrome-ocr-\(windowID).png")
  let task = Process()
  task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
  task.arguments = ["-l", "\(windowID)", url.path]
  try task.run()
  task.waitUntilExit()
  guard task.terminationStatus == 0 else {
    throw ScriptError.message("Gagal capture window \(windowID).")
  }
  return url
}

func recognizeText(at url: URL, windowRect: CGRect) throws -> [OCRHit] {
  guard let image = NSImage(contentsOf: url) else {
    throw ScriptError.message("Gagal membaca screenshot \(url.path).")
  }
  var proposed = CGRect.zero
  guard let cgImage = image.cgImage(forProposedRect: &proposed, context: nil, hints: nil) else {
    throw ScriptError.message("Gagal mengubah screenshot menjadi CGImage.")
  }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.recognitionLanguages = ["id-ID", "en-US"]

  let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
  try handler.perform([request])

  let observations = request.results ?? []
  return observations.compactMap { observation in
    guard let candidate = observation.topCandidates(1).first else { return nil }
    let normalized = observation.boundingBox
    let x = windowRect.origin.x + normalized.midX * windowRect.width
    let y = windowRect.origin.y + (1 - normalized.midY) * windowRect.height
    return OCRHit(text: candidate.string, center: CGPoint(x: x, y: y), confidence: candidate.confidence)
  }
}

func matches(_ source: String, target: String, mode: String) -> Bool {
  let lhs = source.lowercased()
  let rhs = target.lowercased()
  switch mode {
  case "equals":
    return lhs == rhs
  case "startsWith":
    return lhs.hasPrefix(rhs)
  default:
    return lhs.contains(rhs)
  }
}

func click(at point: CGPoint) {
  guard let source = CGEventSource(stateID: .hidSystemState) else { return }
  let move = CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
  let down = CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)
  let up = CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)
  move?.post(tap: .cghidEventTap)
  down?.post(tap: .cghidEventTap)
  up?.post(tap: .cghidEventTap)
}

let args = try parseArgs()
let trusted = AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary)
guard trusted else {
  throw ScriptError.message("Accessibility permission belum aktif.")
}

let focused = try focusedWindow(for: args.appName)
let rect = windowRect(focused.window)
let resolvedWindowID = try chromeWindowID(for: focused.pid, title: focused.title, rect: rect)
let screenshot = try captureWindow(windowID: resolvedWindowID)
let hits = try recognizeText(at: screenshot, windowRect: rect)

if args.mode == "list" || args.text.isEmpty {
  for hit in hits {
    print("\(hit.text) | x=\(Int(hit.center.x)) y=\(Int(hit.center.y)) conf=\(String(format: "%.2f", hit.confidence))")
  }
  exit(0)
}

let matchesFound = hits.filter { matches($0.text, target: args.text, mode: args.match) }
guard args.clickIndex < matchesFound.count else {
  throw ScriptError.message("Teks '\(args.text)' tidak ditemukan di window aktif.")
}

let target = matchesFound[args.clickIndex]
if args.mode == "click" {
  click(at: CGPoint(x: target.center.x + args.offsetX, y: target.center.y + args.offsetY))
}

print("\(target.text) | x=\(Int(target.center.x + args.offsetX)) y=\(Int(target.center.y + args.offsetY)) conf=\(String(format: "%.2f", target.confidence))")

extension Array {
  subscript(safe index: Int) -> Element? {
    guard index >= 0 && index < count else { return nil }
    return self[index]
  }
}
