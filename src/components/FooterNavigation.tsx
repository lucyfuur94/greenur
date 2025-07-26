import React from 'react';
import { Home, BarChart3, Bot, Leaf } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface FooterNavigationProps {
  activeTab: string;
  onNavigate: (page: string) => void;
}

const FooterNavigation: React.FC<FooterNavigationProps> = ({ activeTab, onNavigate }) => {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-background border-t border-border z-10">
      <div 
        className="grid grid-cols-4 px-2 pt-2 pb-6 safe-bottom relative"
        style={{ 
          height: 'calc(100px + var(--safe-area-inset-bottom, 0px))',
          paddingBottom: 'calc(1.5rem + var(--safe-area-inset-bottom, 0px))'
        }}
      >
        {[
          { 
            page: 'home', 
            icon: Home, 
            label: 'Home' 
          },
          { 
            page: 'plants', 
            icon: Leaf, 
            label: 'Plants' 
          },
          { 
            page: 'track', 
            icon: BarChart3, 
            label: 'Track' 
          },
          { 
            page: 'ai', 
            icon: Bot, 
            label: 'Arth AI',
            badge: true 
          }
        ].map((item) => (
          <div
            key={item.page}
            className={`
              flex flex-col items-center justify-center cursor-pointer touch-manipulation relative
              ${activeTab === item.page 
                ? 'text-primary' 
                : 'text-muted-foreground'}
            `}
            onClick={() => onNavigate(item.page)}
          >
            {/* Horizontal line for selected tab - positioned to overlap border */}
            {activeTab === item.page && (
              <div className="absolute -top-[8px] left-0 right-0 h-1 bg-primary rounded-b-full" />
            )}
            
            <item.icon className={`
              w-6 h-6 
              ${activeTab === item.page 
                ? 'text-primary' 
                : 'text-muted-foreground'}
            `} />
            
            <span className={`
              text-xs mt-2 font-medium
              ${activeTab === item.page 
                ? 'text-primary' 
                : 'text-muted-foreground'}
            `}>
              {item.label}
            </span>
            
            {item.badge && activeTab !== 'ai' && (
              <Badge className="absolute -top-1 -right-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 text-[10px] px-1.5 py-0.5">
                TBD
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FooterNavigation; 