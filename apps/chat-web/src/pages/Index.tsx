import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ChatInterface } from "@/components/ChatInterface";
import { ImageGenerator } from "@/components/ImageGenerator";
import { EmailGenerator } from "@/components/EmailGenerator";
import { LandingPageGenerator } from "@/components/LandingPageGenerator";

const Index = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"chat" | "image" | "email" | "landing">("chat");

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  const renderContent = () => {
    switch (activeTab) {
      case "chat":
        return (
          <div className="relative h-[calc(100dvh-6rem)] min-h-0">
            <ChatInterface onRequestTabChange={setActiveTab} />
          </div>
        );
      case "image":
        return <ImageGenerator />;
      case "email":
        return <EmailGenerator />;
      case "landing":
        return <LandingPageGenerator />;
      default:
        return (
          <div className="relative h-[calc(100dvh-6rem)] min-h-0">
            <ChatInterface onRequestTabChange={setActiveTab} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <TopBar />
      
      <main className="ml-0 md:ml-20 pt-[calc(env(safe-area-inset-top)+5rem)] md:pt-20 px-0 pb-0 min-h-screen">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
