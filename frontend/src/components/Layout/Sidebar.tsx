import React, { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMessageCircle,
  FiCamera,
  FiDatabase,
  FiGrid,
  FiSettings,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';
import { useAppStore } from '../../store/index';

interface NavItem {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'assistant', label: 'Assistant', Icon: FiMessageCircle, path: '/' },
  { id: 'vision', label: 'Vision', Icon: FiCamera, path: '/vision' },
  { id: 'memory', label: 'Memory', Icon: FiDatabase, path: '/memory' },
  { id: 'plugins', label: 'Plugins', Icon: FiGrid, path: '/plugins' },
  { id: 'settings', label: 'Settings', Icon: FiSettings, path: '/settings' },
];

const sidebarVariants = {
  expanded: { width: 220 },
  collapsed: { width: 64 },
};

const labelVariants = {
  expanded: { opacity: 1, width: 'auto', marginLeft: 12 },
  collapsed: { opacity: 0, width: 0, marginLeft: 0 },
};

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  const isActive = useCallback(
    (path: string) => {
      if (path === '/') return location.pathname === '/';
      return location.pathname.startsWith(path);
    },
    [location.pathname]
  );

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate]
  );

  return (
    <motion.aside
      initial={false}
      animate={sidebarCollapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex flex-col h-full glass border-r border-jarvis-glass-border overflow-hidden z-40 shrink-0"
      role="navigation"
      aria-label="Mode Navigation"
    >
      {/* Navigation items */}
      <div className="flex flex-col gap-1 p-2 flex-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <motion.button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={`sidebar-item ${active ? 'active' : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              title={sidebarCollapsed ? item.label : undefined}
              layout
              transition={{ duration: 0.2 }}
            >
              <span className="flex-shrink-0 flex items-center justify-center">
                <item.Icon
                  size={20}
                  className={active ? 'text-jarvis-500' : 'text-gray-400'}
                />
              </span>
              <AnimatePresence initial={false}>
                {!sidebarCollapsed && (
                  <motion.span
                    key="label"
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    variants={labelVariants}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="text-sm font-medium truncate overflow-hidden whitespace-nowrap text-left"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="mx-2 h-px bg-gradient-to-r from-transparent via-jarvis-500/20 to-transparent" />

      {/* Collapse toggle button */}
      <div className="p-2">
        <motion.button
          onClick={toggleSidebar}
          className="sidebar-item justify-center w-full"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={
            sidebarCollapsed
              ? 'Expand (Ctrl+B)'
              : 'Collapse (Ctrl+B)'
          }
          whileTap={{ scale: 0.95 }}
        >
          <span className="flex items-center justify-center">
            {sidebarCollapsed ? (
              <FiChevronRight size={18} className="text-gray-400" />
            ) : (
              <FiChevronLeft size={18} className="text-gray-400" />
            )}
          </span>
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.span
                key="collapse-label"
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                variants={labelVariants}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="text-sm font-medium truncate overflow-hidden whitespace-nowrap text-left text-gray-400"
              >
                {sidebarCollapsed ? 'Expand' : 'Collapse'}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
