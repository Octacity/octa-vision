
"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import type { VariantProps} from "class-variance-authority";
import { cva } from "class-variance-authority"
import { PanelLeft, ArrowLeft, Menu, ArrowRight } from "lucide-react" // Added ArrowRight

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
// Renamed import to avoid conflict with the local useSidebar hook
import { useSidebar as useSidebarContextHook } from "@/hooks/use-sidebar-provider"; 


const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "12rem";
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3.5rem" // Default collapsed width
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextType = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextType | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

// This is the actual SidebarProvider component
export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openMobile, setOpenMobile] = React.useState(false)

    const [_open, _setOpen] = React.useState(() => {
      if (typeof window !== 'undefined') {
        const storedState = document.cookie
          .split("; ")
          .find((row) => row.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
          ?.split("=")[1]
        return storedState ? storedState === 'true' : defaultOpen;
      }
      return defaultOpen;
    })

    const open = openProp ?? _open

    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }
        if (typeof window !== 'undefined') {
          document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
        }
      },
      [setOpenProp, open, _setOpen]
    )

    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((openMobileState) => !openMobileState)
        : setOpen((openState) => !openState)
    }, [isMobile, setOpen, setOpenMobile])

    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar])

    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContextType>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    )

    return (
      <TooltipProvider>
        <SidebarContext.Provider value={contextValue}>
          <div ref={ref} {...props}>
            {children}
          </div>
        </SidebarContext.Provider>
      </TooltipProvider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"


const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "icon",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebarContextHook() // Use the renamed hook

    if (collapsible === "none") {
      return (
        <div
          data-sidebar="sidebar"
          data-variant={variant}
          data-collapsible={collapsible}
          className={cn(
            "flex shrink-0 flex-col overflow-x-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
            side === "left" ? "border-r border-sidebar-border" : "border-l border-sidebar-border",
            "w-[--sidebar-width]",
            className
          )}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
            } as React.CSSProperties
          }
          ref={ref}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
            {...props}
          >
            <div
              data-variant={variant}
              className="flex h-full flex-col"
              ref={ref}
            >
              {children}
            </div>
          </SheetContent>
        </Sheet>
      )
    }

    return (
      <>
        {/* This is what handles the sidebar gap on desktop */}
        <div
          data-sidebar="gap"
          data-state={state}
          className={cn(
            "shrink-0 transition-[width] duration-200 ease-linear",
            state === "expanded" ? "w-[--sidebar-width]" : "w-[--sidebar-width-icon]"
          )}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            } as React.CSSProperties
          }
        />
        <div
          data-sidebar="sidebar"
          data-variant={variant}
          data-collapsible={collapsible}
          data-state={state}
          className={cn(
            "fixed z-40 flex shrink-0 flex-col overflow-x-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
            side === "left"
              ? "left-0 border-r border-sidebar-border"
              : "right-0 border-l border-sidebar-border",
            "h-dvh",
            state === "expanded" ? "w-[--sidebar-width]" : "w-[--sidebar-width-icon]",
            className
          )}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            } as React.CSSProperties
          }
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, state, isMobile } = useSidebarContextHook() // Use the renamed hook

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="outline"
      size="icon"
      className={cn("h-8 w-8 p-1.5 border", className)} // Added border for consistency
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
       {/* Updated icon logic */}
      {state === 'expanded' && !isMobile ? <ArrowLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebarContextHook() // Use the renamed hook

  return (
    <button
      ref={ref}
      type="button"
      data-sidebar="rail"
      className={cn(
        "absolute left-full top-0 z-50 h-full w-10 cursor-col-resize select-none bg-transparent outline-none ring-sidebar-ring focus-visible:ring-2",
        className
      )}
      onClick={toggleSidebar}
      {...props}
    />
  )
})
SidebarRail.displayName = "SidebarRail"

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      data-sidebar="inset"
      className={cn("flex flex-col", className)}
      ref={ref}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = "SidebarInput"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("h-16 border-b border-border flex items-center justify-center px-4 py-5", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("sticky bottom-0 z-10 p-3", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn("h-full overflow-y-auto", className)}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn(
        "group relative flex flex-col gap-1 overflow-x-hidden p-1",
        className
      )}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-hover-background hover:text-sidebar-hover-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group-content"
      className={cn("space-y-px", className)}
      {...props}
    />
  )
})
SidebarGroupContent.displayName = "SidebarGroupContent"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
  return (
    <ul
      ref={ref}
      data-sidebar="menu"
      className={cn("flex flex-col", className)}
      {...props}
    />
  )
})
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => {
  const { state } = useSidebarContextHook() // Use the renamed hook
  return (
    <li
      ref={ref}
      data-sidebar="menu-item"
      className={cn(
        "group/menu-item relative flex flex-col",
        state === 'expanded' ? 'mx-3 my-0.5' : 'mx-0 justify-center items-center mt-1 mb-0.5', // Apply top margin when collapsed
        className
        )}
      {...props}
    />
  )
})
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md text-left outline-none ring-sidebar-ring transition-[width,height,padding] hover:bg-[hsl(var(--sidebar-hover-background))] hover:text-[hsl(var(--sidebar-hover-foreground))] focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-[hsl(var(--sidebar-hover-background))] data-[state=open]:hover:text-[hsl(var(--sidebar-hover-foreground))] [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-[hsl(var(--sidebar-hover-background))] hover:text-[hsl(var(--sidebar-hover-foreground))]",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-[hsl(var(--sidebar-hover-background))] hover:text-[hsl(var(--sidebar-hover-foreground))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-10 text-sm py-3", // Default padding and height
        sm: "h-9 text-xs py-3",
        lg: "h-12 text-sm py-3",
        icon: "h-8 w-8 p-1.5 justify-center", // Ensure icon is centered, adjust padding as needed
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size: propSize,
      tooltip,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    const { isMobile, state: sidebarState } = useSidebarContextHook() // Use the renamed hook

    // Determine size based on sidebar state and mobile view
    const size = sidebarState === 'collapsed' && !isMobile ? 'icon' : propSize || 'default';
    
    // Determine padding based on sidebar state and mobile view
    // When collapsed and not mobile, use padding for 'icon' size. Otherwise, use 'px-3'.
    const paddingClass = sidebarState === 'collapsed' && !isMobile ? 'p-1.5' : 'px-3';


    const buttonContent = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size} // Use the dynamically determined size
        data-active={isActive}
        className={cn(
          sidebarMenuButtonVariants({ variant, size }), // Pass determined size to variants
          paddingClass, // Apply dynamic padding
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );


    if (!tooltip) {
      return buttonContent
    }

    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip,
      }
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={sidebarState !== "collapsed" || isMobile}
          {...tooltip}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-2.5 top-1/2 z-10 flex h-5 w-5 -translate-y-1/2 transform items-center justify-center rounded-md p-0 text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-hover-background hover:text-sidebar-hover-foreground focus-visible:ring-2 group-hover/menu-item:opacity-100 [&>svg]:size-3.5 [&>svg]:shrink-0",
        showOnHover ? "opacity-0" : "opacity-100",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "ml-auto flex h-5 items-center justify-center rounded-full bg-sidebar-primary px-2 text-xs text-sidebar-primary-foreground group-hover/menu-button:bg-sidebar-hover-background group-hover/menu-button:text-sidebar-hover-foreground group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuBadge.displayName = "SidebarMenuBadge"

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-8 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
        className
      )}
      {...props}
    >
      {showIcon && (
        <Skeleton className="h-4 w-4 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
      )}
      <Skeleton
        className="h-4 group-data-[collapsible=icon]:hidden"
        style={{ width }}
      />
    </div>
  )
})
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton"

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "flex flex-col gap-px overflow-hidden pl-6 group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuSub.displayName = "SidebarMenuSub"

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean
    size?: "sm" | "md"
    isActive?: boolean
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-hover-background hover:text-sidebar-hover-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  // SidebarProvider is exported above
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarMenuButtonVariants,
  // useSidebar is already exported above
}
