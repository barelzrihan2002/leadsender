import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Send, 
  MessageSquare, 
  BookUser, 
  Flame,
  Settings,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import logoImage from '@/images/lead-logo.png';
import { api } from '@/lib/api';

export default function Sidebar() {
  const { t } = useLanguage();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');

  const navigation = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('accounts'), href: '/accounts', icon: Users },
    { name: t('campaigns'), href: '/campaigns', icon: Send },
    { name: t('inbox'), href: '/inbox', icon: MessageSquare },
    { name: t('contacts'), href: '/contacts', icon: BookUser },
    { name: t('warmup'), href: '/warmup', icon: Flame },
    { name: t('settings'), href: '/settings', icon: Settings },
  ];

  useEffect(() => {
    loadLicenseUser();
  }, []);

  const loadLicenseUser = async () => {
    try {
      const user = await api.license.getUser();
      if (user.name) {
        setUserName(user.name);
      }
      if (user.email) {
        setUserEmail(user.email);
      }
    } catch (error) {
      console.error('Failed to load license user:', error);
    }
  };
  const { dir } = useLanguage();
  
  return (
    <div className={cn(
      "flex h-screen w-72 flex-col bg-card/50 backdrop-blur-xl",
      dir === 'rtl' ? 'border-l' : 'border-r'
    )}>
      <div className="flex h-32 items-center justify-center px-8 border-b border-border/50" style={{ backgroundColor: 'white' }}>
        <img 
          src={logoImage} 
          alt="LeadSender" 
          className="h-20 w-auto object-contain"
        />
      </div>
      
      <nav className="flex-1 space-y-2 px-4 py-6">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 group relative overflow-hidden',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div 
                    className={cn(
                      "absolute top-0 bottom-0 w-1 bg-primary",
                      dir === 'rtl' ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                    )}
                  />
                )}
                <item.icon className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.name}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      
      <div className="p-6 border-t border-border/50">
        <NavLink to="/settings">
          {({ isActive }) => (
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer",
              isActive 
                ? "bg-primary/10 border-primary/30 shadow-sm" 
                : "bg-accent/30 border-border/50 hover:bg-accent/50 hover:border-primary/20"
            )}>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/30 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {userEmail || 'v1.0.0'}
                </p>
              </div>
              {isActive && (
                <Settings className="h-4 w-4 text-primary" />
              )}
            </div>
          )}
        </NavLink>
      </div>
    </div>
  );
}
