'use client'

import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { ExternalLink } from 'lucide-react'
import { formatDate, POST_TYPE_COLORS } from '@/lib/utils'
import type { Post } from '@/types'

const MOCK_COMMENTS = [
  { id: 1, name: 'Mia Berg', body: 'Great share — this changes a few things for how we approach this sprint.', time: '30m ago' },
  { id: 2, name: 'Jonas Lie', body: 'Worth integrating into our workflow. Let me try it out and report back.', time: '15m ago' },
]

interface PostDetailModalProps {
  post: Post | null
  onClose: () => void
}

export default function PostDetailModal({ post, onClose }: PostDetailModalProps) {
  if (!post) return null

  return (
    <Modal open={!!post} onClose={onClose} title="Post" className="max-w-xl">
      {/* Author row */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={post.author?.name ?? 'User'} src={post.author?.avatar_url} size="sm" />
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{post.author?.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(post.created_at)}</p>
        </div>
        <Badge className={`ml-auto ${POST_TYPE_COLORS[post.type]}`}>{post.type}</Badge>
      </div>

      {/* Content */}
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
        {post.title}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{post.body}</p>

      {post.source_url && (
        <a
          href={post.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium mb-5"
        >
          View source <ExternalLink size={11} />
        </a>
      )}

      {/* Comments */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Comments
        </p>
        <div className="flex flex-col gap-4">
          {MOCK_COMMENTS.map((c) => (
            <div key={c.id} className="flex items-start gap-3">
              <Avatar name={c.name} size="sm" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{c.time}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{c.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comment input placeholder */}
        <div className="mt-4 flex items-center gap-2">
          <input
            placeholder="Write a comment..."
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
            Send
          </button>
        </div>
      </div>
    </Modal>
  )
}
