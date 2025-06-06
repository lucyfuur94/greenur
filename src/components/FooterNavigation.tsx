import React from 'react';
import { Home, BarChart3, Bot } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface FooterNavigationProps {
  activeTab: string;
  onNavigate: (page: string) => void;
}

const FooterNavigation: React.FC<FooterNavigationProps> = ({ activeTab, onNavigate }) => {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 z-10">
      <div className="grid grid-cols-3 h-[84px] px-2 pt-2 pb-6">
        <div
          className={`flex flex-col items-center justify-center cursor-pointer ${
            activeTab === "home" ? "text-[#17A34A] bg-[#ECFDF5] rounded-xl px-4 py-2" : "text-gray-500"
          }`}
          onClick={() => onNavigate('home')}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">Home</span>
        </div>
        <div
          className={`flex flex-col items-center justify-center cursor-pointer ${
            activeTab === "track" ? "text-[#17A34A] bg-[#ECFDF5] rounded-xl px-4 py-2" : "text-gray-500"
          }`}
          onClick={() => onNavigate('track')}
        >
          <BarChart3 className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">Track</span>
        </div>
        <div
          className={`flex flex-col items-center justify-center cursor-pointer relative ${
            activeTab === "ai" ? "text-[#17A34A] bg-[#ECFDF5] rounded-xl px-4 py-2" : "text-gray-500"
          }`}
          onClick={() => onNavigate('ai')}
        >
          <Bot className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">Arth AI</span>
          <Badge className="absolute -top-1 -right-1 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5">
            TBD
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default FooterNavigation; 