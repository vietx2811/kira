import Foundation
import NaturalLanguage

let path = CommandLine.arguments[1]
let text = try String(contentsOfFile: path, encoding: .utf8)
let stopWords: Set<String> = [
  "the", "and", "for", "with", "from", "this", "that", "are", "was", "were",
  "not", "you", "your", "have", "has", "had", "can", "will", "into", "onto",
  "over", "under", "screen", "image", "photo", "copy", "final"
]

let tagger = NLTagger(tagSchemes: [.lexicalClass])
tagger.string = text

var terms: [String] = []
let range = text.startIndex..<text.endIndex
let options: NLTagger.Options = [.omitWhitespace, .omitPunctuation, .joinNames]

tagger.enumerateTags(in: range, unit: .word, scheme: .lexicalClass, options: options) { tag, tokenRange in
  guard let tag else { return true }
  guard tag == .noun || tag == .adjective || tag == .verb || tag == .personalName || tag == .placeName || tag == .organizationName else {
    return true
  }

  let term = text[tokenRange]
    .lowercased()
    .trimmingCharacters(in: .whitespacesAndNewlines)
  guard term.count > 2, !stopWords.contains(term) else { return true }
  if !terms.contains(term) {
    terms.append(term)
  }
  return terms.count < 10
}

print(terms.joined(separator: "\n"))
