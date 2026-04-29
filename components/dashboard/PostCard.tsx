import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { ExternalLink } from 'lucide-react'
import { formatDate, POST_TYPE_COLORS } from '@/lib/utils'
import type { Post } from '@/types'

interface PostCardProps {
  post: Post
  onClick?: () => void
}

export default function PostCard({ post, onClick }: PostCardProps) {
  return (
    <Card hover padding="md" className="group" onClick={onClick}>
      <div className="flex items-start gap-3">
        <Avatar name={post.author?.name ?? 'User'} src={post.author?.avatar_url} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{post.author?.name}</span>
            <Badge className={POST_TYPE_COLORS[post.type]}>{post.type}</Badge>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{formatDate(post.created_at)}</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5 leading-snug">{post.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{post.body}</p>
          {post.source_url && (
            <a
              href={post.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              View source <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </Card>
  )
}
