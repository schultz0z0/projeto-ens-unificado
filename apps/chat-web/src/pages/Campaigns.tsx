import React from 'react';
import CampaignLayout from '@/components/campaigns/CampaignLayout';
import CampaignDashboard from '@/components/campaigns/dashboard/CampaignDashboard';
import CampaignListView from '@/components/campaigns/list/CampaignListView';
import MarketIntelligenceView from '@/components/campaigns/market-intelligence/MarketIntelligenceView';
import { TabsContent } from '@/components/ui/tabs';
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

const Campaigns = () => {
  return (
    <div className="min-h-screen relative">
      <Sidebar />
      <TopBar />
      
      <main className="ml-0 md:ml-20 pt-[calc(env(safe-area-inset-top)+6rem)] md:pt-24 px-0 pb-[calc(env(safe-area-inset-bottom)+2rem)] md:pb-8 min-h-screen">
        <CampaignLayout>
          <TabsContent value="dashboard" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
            <CampaignDashboard />
          </TabsContent>
          
          <TabsContent value="campaigns" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
            <CampaignListView />
          </TabsContent>

          <TabsContent value="market-intelligence" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
            <MarketIntelligenceView />
          </TabsContent>
        </CampaignLayout>
      </main>
    </div>
  );
};

export default Campaigns;
