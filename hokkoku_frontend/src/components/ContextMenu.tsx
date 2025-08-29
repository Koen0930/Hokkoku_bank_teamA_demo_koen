import { ReactNode } from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContextMenuItem {
  label?: string
  icon?: ReactNode
  onClick?: () => void
  shortcut?: string
  separator?: boolean
  disabled?: boolean
  submenu?: ContextMenuItem[]
}

interface ContextMenuProps {
  children: ReactNode
  items: ContextMenuItem[]
}

export function ContextMenu({ children, items }: ContextMenuProps) {
  const renderMenuItem = (item: ContextMenuItem, index: number) => {
    if (item.separator) {
      return <ContextMenuPrimitive.Separator key={index} className="h-px bg-neutral-200 my-1" />
    }

    if (item.submenu) {
      return (
        <ContextMenuPrimitive.Sub key={index}>
          <ContextMenuPrimitive.SubTrigger className={cn(
            "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer outline-none",
            "hover:bg-primary-50 hover:text-primary-700 data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700",
            item.disabled && "opacity-50 pointer-events-none"
          )}>
            <span className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </span>
            <ChevronRight className="h-4 w-4" />
          </ContextMenuPrimitive.SubTrigger>
          <ContextMenuPrimitive.Portal>
            <ContextMenuPrimitive.SubContent className="min-w-[180px] bg-white rounded-lg shadow-lg border border-neutral-200 p-1 animate-fade-in">
              {item.submenu.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
            </ContextMenuPrimitive.SubContent>
          </ContextMenuPrimitive.Portal>
        </ContextMenuPrimitive.Sub>
      )
    }

    return (
      <ContextMenuPrimitive.Item
        key={index}
        onClick={item.onClick}
        disabled={item.disabled}
        className={cn(
          "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer outline-none",
          "hover:bg-primary-50 hover:text-primary-700 data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700",
          item.disabled && "opacity-50 pointer-events-none"
        )}
      >
        <span className="flex items-center gap-2">
          {item.icon}
          {item.label}
        </span>
        {item.shortcut && (
          <span className="text-xs text-neutral-500">{item.shortcut}</span>
        )}
      </ContextMenuPrimitive.Item>
    )
  }

  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {children}
      </ContextMenuPrimitive.Trigger>
      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content className="min-w-[220px] bg-white rounded-lg shadow-lg border border-neutral-200 p-1 animate-fade-in-up">
          {items.map((item, index) => renderMenuItem(item, index))}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}