import React from 'react';
import { Outlet } from 'react-router-dom';
import { Titlebar } from './Titlebar';
import { Sidebar } from './Sidebar';
import { StatusBar } from '../UI/StatusBar';
import { NotificationToast } from '../UI/NotificationToast';
import { ParticleBackground } from '../UI/ParticleBackground';

export const MainLayout: React.FC = () => {
  return (
    <div
      className="flex flex-col w-screen h-screen bg-jarvis-dark"
      role="main"
      aria-label="JARVIS Main Layout"
    >
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className="flex-1 relative overflow-hidden glass"
          role="region"
          aria-label="Main Content"
        >
          <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
          <div className="absolute inset-0 pointer-events-none">
            <ParticleBackground />
          </div>
          <div className="relative h-full overflow-y-auto scrollbar-thin">
            <Outlet />
          </div>
        </main>
      </div>
      <StatusBar />
      <NotificationToast />
    </div>
  );
};

export default MainLayout;
