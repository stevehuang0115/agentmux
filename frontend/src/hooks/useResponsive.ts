import { useState, useEffect } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536
};

export const useResponsive = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Debounce resize events
    let timeoutId: NodeJS.Timeout;
    const debouncedHandleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedHandleResize);
    
    // Set initial size
    handleResize();

    return () => {
      window.removeEventListener('resize', debouncedHandleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const getCurrentBreakpoint = (): Breakpoint => {
    const width = windowSize.width;
    
    if (width >= breakpoints['2xl']) return '2xl';
    if (width >= breakpoints.xl) return 'xl';
    if (width >= breakpoints.lg) return 'lg';
    if (width >= breakpoints.md) return 'md';
    if (width >= breakpoints.sm) return 'sm';
    return 'xs';
  };

  const isBreakpoint = (breakpoint: Breakpoint): boolean => {
    return windowSize.width >= breakpoints[breakpoint];
  };

  const isAboveBreakpoint = (breakpoint: Breakpoint): boolean => {
    return windowSize.width > breakpoints[breakpoint];
  };

  const isBelowBreakpoint = (breakpoint: Breakpoint): boolean => {
    return windowSize.width < breakpoints[breakpoint];
  };

  const isMobile = isBelowBreakpoint('md');
  const isTablet = isBreakpoint('md') && isBelowBreakpoint('lg');
  const isDesktop = isBreakpoint('lg');

  return {
    windowSize,
    currentBreakpoint: getCurrentBreakpoint(),
    isBreakpoint,
    isAboveBreakpoint,
    isBelowBreakpoint,
    isMobile,
    isTablet,
    isDesktop
  };
};

// Hook for responsive values
export const useResponsiveValue = <T>(values: Partial<Record<Breakpoint, T>>): T | undefined => {
  const { currentBreakpoint } = useResponsive();
  
  // Find the most appropriate value based on current breakpoint
  const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'];
  const currentIndex = breakpointOrder.indexOf(currentBreakpoint);
  
  // Look for value starting from current breakpoint going down
  for (let i = currentIndex; i < breakpointOrder.length; i++) {
    const bp = breakpointOrder[i];
    if (values[bp] !== undefined) {
      return values[bp];
    }
  }
  
  return undefined;
};

// Hook for responsive grid columns
export const useResponsiveGrid = () => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  
  const getGridColumns = (mobile: number, tablet: number, desktop: number): number => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    return desktop;
  };

  const getGridClass = (mobile: number, tablet: number, desktop: number): string => {
    return `grid-cols-${getGridColumns(mobile, tablet, desktop)}`;
  };

  return {
    getGridColumns,
    getGridClass,
    isMobile,
    isTablet,
    isDesktop
  };
};