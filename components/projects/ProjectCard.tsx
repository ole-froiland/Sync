import Link from 'next/link'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import { GitBranch, ExternalLink, CheckSquare, Users } from 'lucide-react'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/utils'
import type { Project } from '@/types'

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card hover padding="md" className="flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{project.name}</h3>
            {project.description && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{project.description}</p>
            )}
          </div>
          <Badge className={STATUS_COLORS[project.status]}>
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>

        {/* Tech stack */}
        {project.tech_stack && project.tech_stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tech_stack.map((tech) => (
              <span key={tech} className="text-xs bg-gray-100 text-gray-600 rounded-md px-2 py-0.5">{tech}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50 mt-auto">
          <div className="flex items-center gap-3">
            {/* Members avatars */}
            {project.members && project.members.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {project.members.slice(0, 4).map((m) => (
                  <Avatar key={m.id} name={m.name} src={m.avatar_url} size="xs" className="ring-2 ring-white" />
                ))}
                {(project.member_count ?? 0) > 4 && (
                  <span className="text-xs text-gray-400 pl-2">+{(project.member_count ?? 0) - 4}</span>
                )}
              </div>
            )}
            {project.task_count !== undefined && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <CheckSquare size={11} />
                {project.task_count}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <GitBranch size={14} />
              </a>
            )}
            {project.demo_url && (
              <a
                href={project.demo_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}
