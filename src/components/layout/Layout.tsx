import { Outlet } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Sidebar from './Sidebar';

export default function Layout() {
  const { dir } = useLanguage();
  
  return (
    <div className="flex h-screen overflow-hidden" dir={dir}>
      <Sidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
