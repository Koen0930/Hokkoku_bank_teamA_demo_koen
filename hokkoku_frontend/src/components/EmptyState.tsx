import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-6 text-center",
      className
    )}>
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary-100 rounded-full blur-2xl opacity-50 animate-pulse-slow"></div>
        <div className="relative w-20 h-20 bg-gradient-to-br from-primary-50 to-primary-100 rounded-full flex items-center justify-center">
          <Icon className="w-10 h-10 text-primary-600" />
        </div>
      </div>
      
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-sm mb-6">{description}</p>
      
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 transition-colors duration-200 hover:shadow-lg hover:shadow-primary-600/20 hover:-translate-y-0.5 transform"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}