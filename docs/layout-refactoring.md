# Layout Refactoring Documentation

## Overview
This document outlines the refactoring changes made to implement Supabase-style layout positioning with proper sidebar, navbar, and body content alignment, including hover expansion functionality.

## Changes Made

### 1. Dashboard Layout (`src/app/(dashboard)/layout.tsx`)

**Key Changes:**
- Updated main content area positioning to account for sidebar width
- Implemented responsive margins:
  - Mobile: `w-full` (no margin)
  - Desktop: `md:ml-16` (account for collapsed sidebar - 64px)
  - Large screens: `lg:ml-64` (account for expanded sidebar - 256px)

**Code Changes:**
```typescript
// Main Content Area - Properly positioned to avoid sidebar overlap
<div className={cn(
  "flex-1 flex flex-col transition-all duration-300 ease-in-out",
  // Mobile: full width, no margin
  "w-full",
  // Desktop: account for collapsed sidebar width
  "md:ml-16",
  // Large screens: account for expanded sidebar width
  "lg:ml-64"
)}>
```

### 2. Sidebar Component (`src/components/layout/Sidebar.tsx`)

**Key Changes:**
- Implemented Supabase-style hover expansion
- Added hover state management with `isHovered` state
- Updated responsive widths:
  - Collapsed: `w-16` (64px)
  - Expanded: `w-64` (256px)
- Added hover expansion on mouse enter/leave

**Code Changes:**
```typescript
// New state management
const [isExpanded, setIsExpanded] = useState(false);
const [isHovered, setIsHovered] = useState(false);

// Hover expansion implementation
<div 
  className={cn(
    "bg-[#1A1F36] text-white h-screen fixed left-0 top-0 z-30 transition-all duration-300 ease-in-out",
    // Responsive widths with hover expansion
    isExpanded ? "w-64" : "w-16",
    // Ensure it doesn't interfere with main content
    "hidden md:block"
  )}
  onMouseEnter={() => !isExpanded && setIsHovered(true)}
  onMouseLeave={() => setIsHovered(false)}
>
  <div className={cn(
    "h-full transition-all duration-300 ease-in-out",
    // Expand on hover when collapsed
    isExpanded ? "w-64" : isHovered ? "w-64" : "w-16"
  )}>
    <SidebarContent />
  </div>
</div>
```

### 3. Navbar Component (`src/components/layout/Navbar.tsx`)

**Key Changes:**
- Updated positioning to account for sidebar width
- Implemented responsive left positioning:
  - Mobile: `left-0` (full width)
  - Desktop: `md:left-16` (account for collapsed sidebar)
  - Large screens: `lg:left-64` (account for expanded sidebar)
- Reduced z-index to `z-30` to ensure proper layering

**Code Changes:**
```typescript
<div className={cn(
  "fixed top-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between z-30 transition-all duration-300",
  // Responsive positioning and padding
  "left-0 px-4", // Mobile: full width
  "md:left-16 md:px-6", // Desktop: account for collapsed sidebar
  "lg:left-64 lg:px-8" // Large screens: account for expanded sidebar
)}>
```

### 4. Global CSS (`src/app/globals.css`)

**Key Changes:**
- Updated CSS custom properties for responsive sidebar widths
- Added hover expansion utility classes
- Updated breakpoint-specific sidebar widths

**Code Changes:**
```css
/* Updated sidebar width variables */
--sidebar-width-md: 64px;
--sidebar-width-lg: 256px;
--sidebar-width-xl: 256px;

--sidebar-collapsed-md: 64px;
--sidebar-collapsed-lg: 64px;
--sidebar-collapsed-xl: 64px;

/* Added hover expansion styles */
@layer components {
  .sidebar-hover-expand {
    @apply transition-all duration-300 ease-in-out;
  }
  
  .sidebar-hover-expand:hover {
    @apply w-64;
  }
}
```

## Layout Structure

### Desktop Layout (> 768px)
```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (64px collapsed, 256px expanded)                │
├─────────────────────────────────────────────────────────┤
│ Navbar (positioned relative to sidebar)                 │
├─────────────────────────────────────────────────────────┤
│ Main Content (margins adjust to sidebar width)          │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Mobile Layout (< 768px)
```
┌─────────────────────────────────────────────────────────┐
│ Navbar (full width)                                     │
├─────────────────────────────────────────────────────────┤
│ Main Content (full width)                               │
│                                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Responsive Breakpoints

- **Mobile (< 768px)**: Full-width layout, sidebar as overlay
- **Desktop (≥ 768px)**: Sidebar fixed, main content with margin
- **Large screens (≥ 1024px)**: Enhanced spacing and typography

## Hover Expansion Behavior

1. **Collapsed State**: Sidebar shows only icons (64px width)
2. **Hover State**: Sidebar expands to show labels (256px width)
3. **Expanded State**: Sidebar remains expanded until manually collapsed
4. **Mobile**: No hover expansion, uses overlay pattern

## Z-Index Hierarchy

- **Mobile menu button**: `z-50`
- **Mobile sidebar**: `z-40`
- **Mobile overlay**: `z-30`
- **Desktop sidebar**: `z-30`
- **Navbar**: `z-30`
- **Tooltips**: `z-50`

## Testing Checklist

- [ ] Sidebar collapses/expands on desktop
- [ ] Hover expansion works when collapsed
- [ ] Navbar positioning adjusts with sidebar state
- [ ] Main content margins adjust properly
- [ ] Mobile overlay works correctly
- [ ] All navigation items are accessible
- [ ] Transitions are smooth
- [ ] No content overlap issues

## Future Enhancements

1. **Keyboard Navigation**: Add keyboard shortcuts for sidebar toggle
2. **Touch Gestures**: Implement swipe gestures for mobile
3. **Animation Optimization**: Use CSS transforms for better performance
4. **Accessibility**: Add ARIA labels and screen reader support
5. **Theme Integration**: Support for dark/light mode transitions 