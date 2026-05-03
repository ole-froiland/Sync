'use client'

import { Newspaper, Cpu, BookOpen, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { NewsItem } from '@/types'

function timeSince(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const mockAINews = [
  {
    id: 1,
    title: 'Anthropic releases Claude 4 Opus with extended context and faster thinking mode',
    source: 'Anthropic Blog',
    url: 'https://anthropic.com',
    time: '2h ago',
  },
  {
    id: 2,
    title: 'OpenAI launches GPT-5 with multimodal reasoning and improved code generation',
    source: 'OpenAI Blog',
    url: 'https://openai.com',
    time: '4h ago',
  },
  {
    id: 3,
    title: 'Google DeepMind unveils Gemini Ultra 2 — new SOTA on math and science benchmarks',
    source: 'Google Research',
    url: 'https://deepmind.google',
    time: '6h ago',
  },
  {
    id: 4,
    title: 'Meta AI open-sources LLaMA 4 with 400B parameter variant under permissive license',
    source: 'Meta AI',
    url: 'https://ai.meta.com',
    time: '1d ago',
  },
  {
    id: 5,
    title: 'Mistral releases new 7B model with 128k context window and tool use support',
    source: 'Mistral AI',
    url: 'https://mistral.ai',
    time: '2d ago',
  },
]

const mockRecommended = [
  {
    id: 1,
    title: 'Building production RAG systems: what nobody tells you',
    source: 'LangChain Blog',
    url: 'https://blog.langchain.dev',
    time: '1d ago',
  },
  {
    id: 2,
    title: 'How to use prompt caching to cut API costs by 80%',
    source: 'Anthropic Cookbook',
    url: 'https://anthropic.com',
    time: '2d ago',
  },
  {
    id: 3,
    title: 'Tree-sitter: write better code parsers for AI-powered developer tools',
    source: 'GitHub Blog',
    url: 'https://github.blog',
    time: '3d ago',
  },
  {
    id: 4,
    title: 'The hidden cost of context windows in production LLM apps',
    source: 'Scale AI',
    url: 'https://scale.com',
    time: '4d ago',
  },
]

interface DiscoverViewProps {
  news: NewsItem[]
  newsLoading: boolean
  onFetchNews: () => void
}

export default function DiscoverView({ news, newsLoading, onFetchNews }: DiscoverViewProps) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Two-column top section */}
      <div className="grid grid-cols-2 gap-8">
        {/* AI News */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
            <Cpu size={14} className="text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">AI News</h2>
          </div>
          <div className="flex flex-col gap-0">
            {mockAINews.map((item, i) => (
              <div
                key={item.id}
                className={`py-3.5 ${
                  i < mockAINews.length - 1
                    ? 'border-b border-gray-50 dark:border-gray-800/60'
                    : ''
                }`}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block mb-1"
                >
                  {item.title}
                </a>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{item.source}</span>
                  <span className="text-gray-200 dark:text-gray-700">·</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* From Hacker News */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
            <Newspaper size={14} className="text-gray-400 dark:text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              From Hacker News
            </h2>
            <button
              onClick={onFetchNews}
              className="ml-auto text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={11} />
            </button>
          </div>
          <div className="flex flex-col gap-0">
            {newsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="py-3.5 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))
            ) : news.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-3">Could not load news</p>
            ) : (
              news.map((item, i) => (
                <div
                  key={item.id}
                  className={`py-3.5 ${
                    i < news.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''
                  }`}
                >
                  <a
                    href={item.url ?? `https://news.ycombinator.com/item?id=${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors block mb-1 line-clamp-2"
                  >
                    {item.title}
                  </a>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {item.score} pts
                    </span>
                    <span className="text-gray-200 dark:text-gray-700">·</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {timeSince(item.time)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Recommended */}
      <section className="mt-10 flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100 dark:border-gray-800">
          <BookOpen size={14} className="text-gray-400 dark:text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Recommended</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {mockRecommended.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1.5 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:border-gray-200 dark:hover:border-gray-700 transition-colors"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {item.title}
              </p>
              <div className="flex items-center gap-1.5 mt-auto">
                <span className="text-xs text-gray-400 dark:text-gray-500">{item.source}</span>
                <span className="text-gray-200 dark:text-gray-700">·</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{item.time}</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
