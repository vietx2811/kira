import Foundation
import FoundationModels

enum Mode: String {
  case availability
  case tags
}

func printAvailability() {
  if #available(macOS 26.0, *) {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
      print("available")
    case .unavailable(let reason):
      print("unavailable\t\(reason)")
    @unknown default:
      print("unavailable\tunknown")
    }
  } else {
    print("unavailable\tmacos-version")
  }
}

func normalizeTags(contextPath: String) async throws {
  let context = try String(contentsOfFile: contextPath, encoding: .utf8)

  if #available(macOS 26.0, *) {
    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
      let instructions = """
      You normalize visual research metadata into concise interface tags.
      Return only 3 to 6 lowercase tag phrases separated by commas.
      Do not add explanations, numbering, markdown, or quotation marks.
      """
      let session = LanguageModelSession(instructions: instructions)
      let prompt = """
      Normalize these existing image reference fields into concise tags.
      Prefer concrete visual, material, mood, and concept terms.

      \(context)
      """
      let response = try await session.respond(to: prompt)
      print(response.content)
    case .unavailable(let reason):
      fputs("unavailable: \(reason)\n", stderr)
      exit(3)
    @unknown default:
      fputs("unavailable: unknown\n", stderr)
      exit(3)
    }
  } else {
    fputs("unavailable: macos-version\n", stderr)
    exit(3)
  }
}

let mode = CommandLine.arguments.dropFirst().first.flatMap(Mode.init(rawValue:))

switch mode {
case .availability:
  printAvailability()
case .tags:
  guard CommandLine.arguments.count > 2 else {
    fputs("missing context path\n", stderr)
    exit(2)
  }
  try await normalizeTags(contextPath: CommandLine.arguments[2])
case .none:
  fputs("usage: kira-foundation-models-helper availability|tags [context-path]\n", stderr)
  exit(2)
}
