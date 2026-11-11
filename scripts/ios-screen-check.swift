import Foundation
import Vision
import ImageIO
import Darwin

// CI-only pixel verification. This code is not part of the distributed app.
// A living process or a painted background does not prove that React rendered.
guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("Usage: ios-screen-check screenshot.png\n".utf8))
    exit(64)
}
let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    FileHandle.standardError.write(Data("Could not read the simulator screenshot.\n".utf8))
    exit(65)
}
let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-US"]
request.usesLanguageCorrection = false
try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
let lines = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }
print(lines.joined(separator: "\n"))
let text = lines.joined(separator: " ").lowercased()
let expected = ["big possibilities", "one clear next step", "add an opportunity"]
let missing = expected.filter { !text.contains($0) }
if !missing.isEmpty {
    let message = "Native home screen is not visibly ready. Missing text: \(missing.joined(separator: ", "))\n"
    FileHandle.standardError.write(Data(message.utf8))
    exit(1)
}
print("PASS: Momentum home heading and primary action are visible in the simulator screenshot.")
