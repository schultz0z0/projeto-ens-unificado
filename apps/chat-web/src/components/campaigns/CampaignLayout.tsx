import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, Brain, Target } from "lucide-react";
import { motion } from "framer-motion";

interface CampaignLayoutProps {
  children: React.ReactNode;
}

const CampaignLayout: React.FC<CampaignLayoutProps> = ({ children }) => {
  return (
    <div className="h-full w-full p-4 md:p-8 space-y-8">
      <Tabs defaultValue="dashboard" className="w-full space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
            >
              Inteligência de Mercado
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground"
            >
              Inteligência competitiva para orientar estratégias, criativos e posicionamento.
            </motion.p>
          </div>

          <div className="flex items-center gap-4">
            <TabsList className="grid w-full grid-cols-3 md:w-[460px] h-10 bg-white/30 backdrop-blur-md border-white/20 text-slate-700">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Concorrentes
              </TabsTrigger>
              <TabsTrigger value="market-intelligence" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Inteligência
              </TabsTrigger>
            </TabsList>
            
            <img 
              src="/Logo da ENS.png" 
              alt="Logo ENS" 
              className="h-12 w-auto object-contain drop-shadow-sm"
            />
          </div>
        </div>

        {/* Content Section with Transition */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="min-h-[500px]"
        >
          {children}
        </motion.div>
      </Tabs>
    </div>
  );
};

export default CampaignLayout;
