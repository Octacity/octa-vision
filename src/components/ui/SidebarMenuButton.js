// Inside SidebarMenuButton component logic
const { isMobile, state: sidebarState } = useSidebar(); //
const buttonSize = sidebarState === 'collapsed' && !isMobile ? 'icon' : size;
// ... rest of the component
// In the returned JSX
<Comp
  ref={ref}
  data-sidebar="menu-button"
  data-size={buttonSize} // Use the dynamically determined size
  data-active={isActive}
  className={cn(
    sidebarMenuButtonVariants({ variant, size: buttonSize }), // Pass buttonSize here
    className
  )}
  {...props}
>
  {children}
</Comp>
    