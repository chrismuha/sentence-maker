import AppKit
import Foundation

// Compare the volume artwork to an actual Finder app icon, rather than merely
// asserting that the source PNG has some transparent padding.
guard (CommandLine.arguments.count == 2 || CommandLine.arguments.count == 3),
      let volumeIcon = NSImage(contentsOfFile: CommandLine.arguments[1]) else {
    fatalError("Usage: swift verify-dmg-icon-size.swift volume.icns reference.app")
}
let referencePath = CommandLine.arguments.count == 3 ? CommandLine.arguments[2] : "/System/Applications/App Store.app"
guard FileManager.default.fileExists(atPath: referencePath) else { fatalError("Reference app is missing") }
let referenceIcon = NSWorkspace.shared.icon(forFile: referencePath)
func visibleSize(_ icon: NSImage, _ size: Int) -> (Int, Int) {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    icon.draw(in: NSRect(x: 0, y: 0, width: size, height: size),
        from: .zero, operation: .copy, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
    var left = size, right = -1, top = size, bottom = -1
    for y in 0..<size {
        for x in 0..<size {
            if bitmap.colorAt(x: x, y: y)!.alphaComponent > 0.5 {
                left = min(left, x); right = max(right, x)
                top = min(top, y); bottom = max(bottom, y)
            }
        }
    }
    guard right >= left && bottom >= top else { fatalError("Missing artwork at \(size)px") }
    return (right - left + 1, bottom - top + 1)
}
for size in [32, 64, 128, 256, 512] {
    let actual = visibleSize(volumeIcon, size)
    let reference = visibleSize(referenceIcon, size)
    guard actual.0 == reference.0 && actual.1 == reference.1 else {
        fatalError("At \(size)px: DMG \(actual), reference \(reference)")
    }
    print("\(size)px: DMG \(actual.0)×\(actual.1), reference \(reference.0)×\(reference.1)")
}
