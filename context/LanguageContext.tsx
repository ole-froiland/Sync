'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  DEFAULT_LOCALE,
  LANGUAGE_STORAGE_KEY,
  coerceLocale,
  languageLabel,
  translateAttribute,
  translateText,
  type Locale,
} from '@/lib/i18n'

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  languageLabel: string
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  toggleLocale: () => {},
  languageLabel: languageLabel(DEFAULT_LOCALE),
})

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'] as const

function shouldSkipElement(element: Element | null) {
  if (!element) return true
  const tagName = element.tagName.toLowerCase()
  return (
    tagName === 'script' ||
    tagName === 'style' ||
    tagName === 'code' ||
    tagName === 'pre' ||
    element.hasAttribute('data-no-translate')
  )
}

function translateNode(node: Node, locale: Locale) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement
    if (shouldSkipElement(parent)) return
    const next = translateText(node.textContent ?? '', locale)
    if (next !== node.textContent) node.textContent = next
    return
  }

  if (!(node instanceof Element) || shouldSkipElement(node)) return

  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    if (!node.hasAttribute(attr)) continue
    const current = node.getAttribute(attr)
    const next = translateAttribute(current, locale)
    if (next !== current && next != null) node.setAttribute(attr, next)
  }

  for (const child of node.childNodes) {
    translateNode(child, locale)
  }
}

function translateDocument(locale: Locale) {
  document.documentElement.lang = locale
  translateNode(document.body, locale)
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale)
    translateDocument(nextLocale)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocaleState((current) => {
      const nextLocale = current === 'en' ? 'no' : 'en'
      localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale)
      translateDocument(nextLocale)
      return nextLocale
    })
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      const stored = coerceLocale(localStorage.getItem(LANGUAGE_STORAGE_KEY))
      setLocaleState(stored)
      translateDocument(stored)
    })
  }, [])

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateNode(mutation.target, locale)
          continue
        }

        if (mutation.type === 'attributes') {
          translateNode(mutation.target, locale)
          continue
        }

        for (const node of mutation.addedNodes) {
          translateNode(node, locale)
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    })

    translateDocument(locale)

    return () => observer.disconnect()
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      languageLabel: languageLabel(locale),
    }),
    [locale, setLocale, toggleLocale]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
