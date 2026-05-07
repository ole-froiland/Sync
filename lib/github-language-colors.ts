const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  'C#': '#178600',
  'C++': '#f34b7d',
  C: '#555555',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Shell: '#89e051',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  PHP: '#4f5d95',
  Dart: '#00b4ab',
  Elixir: '#6e4a7e',
  Lua: '#000080',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  R: '#198ce7',
  'Objective-C': '#438eff',
  Solidity: '#aa6746',
  MDX: '#fcb32c',
  Markdown: '#083fa1',
}

export function languageColor(language: string | null | undefined) {
  if (!language) return '#9ca3af'
  return LANGUAGE_COLORS[language] ?? '#9ca3af'
}
