import { Columns3, List, CalendarDays, BarChart3, Settings, MessageCircle } from 'lucide-react';
import { useWhatsAppInbox } from '@/hooks/useWhatsAppInbox';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Pipeline', url: '/pipeline', icon: Columns3 },
  { title: 'Leads', url: '/leads', icon: List },
  { title: 'Hoje', url: '/hoje', icon: CalendarDays },
  { title: 'Conversas', url: '/conversas', icon: MessageCircle },
  { title: 'Dashboard', url: '/dashboard', icon: BarChart3 },
  { title: 'Configurações', url: '/configuracoes', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { unread } = useWhatsAppInbox();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-4">
        {!collapsed && (
          <div className="px-4 pb-4 mb-2 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-sidebar-accent flex items-center justify-center shrink-0">
                <span className="text-sidebar-accent-foreground font-bold text-sm font-display">AE</span>
              </div>
              <span className="text-sidebar-primary font-semibold text-sm leading-tight font-display">
                CRM Atacado<br />Exponencial
              </span>
            </div>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <span className="relative mr-2 inline-flex">
                        <item.icon className="h-4 w-4" />
                        {item.url === '/conversas' && unread > 0 && collapsed && (
                          <span className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                        )}
                      </span>
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && item.url === '/conversas' && unread > 0 && (
                        <span
                          className="ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] px-1.5"
                          aria-label={`${unread} mensagens não lidas`}
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
