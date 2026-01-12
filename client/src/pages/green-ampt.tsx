import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplets, Layers, Calculator, Info, ArrowDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { motion, AnimatePresence } from "framer-motion";

interface GreenAmptParams {
  suctionHead: number;
  conductivity: number;
  initialDeficit: number;
}

interface ModifiedGreenAmptParams extends GreenAmptParams {
  saturatedContent: number;
  fieldCapacity: number;
  redistributionTime: number;
}

function calculateGreenAmptInfiltration(params: GreenAmptParams, duration: number, timestep: number = 0.1) {
  const { suctionHead, conductivity, initialDeficit } = params;
  const data: { time: number; infiltrationRate: number; cumulativeInfiltration: number }[] = [];
  
  let F = 0.001;
  let time = 0;
  
  while (time <= duration) {
    const f = conductivity * (1 + (suctionHead * initialDeficit) / F);
    
    data.push({
      time: parseFloat(time.toFixed(2)),
      infiltrationRate: parseFloat(f.toFixed(4)),
      cumulativeInfiltration: parseFloat(F.toFixed(4))
    });
    
    F += f * timestep;
    time += timestep;
  }
  
  return data;
}

function calculateModifiedGreenAmptInfiltration(params: ModifiedGreenAmptParams, duration: number, timestep: number = 0.1) {
  const { suctionHead, conductivity, initialDeficit, saturatedContent, fieldCapacity, redistributionTime } = params;
  const data: { time: number; infiltrationRate: number; cumulativeInfiltration: number; moistureContent: number }[] = [];
  
  let F = 0.001;
  let time = 0;
  let theta = saturatedContent - initialDeficit;
  
  while (time <= duration) {
    const redistributionFactor = Math.exp(-time / Math.max(redistributionTime, 0.1));
    const effectiveDeficit = initialDeficit * (1 - redistributionFactor * 0.3);
    
    const f = conductivity * (1 + (suctionHead * effectiveDeficit) / F);
    
    theta = Math.min(saturatedContent, theta + (f * timestep * 0.01));
    if (theta > fieldCapacity) {
      theta = fieldCapacity + (theta - fieldCapacity) * redistributionFactor;
    }
    
    data.push({
      time: parseFloat(time.toFixed(2)),
      infiltrationRate: parseFloat(f.toFixed(4)),
      cumulativeInfiltration: parseFloat(F.toFixed(4)),
      moistureContent: parseFloat(theta.toFixed(4))
    });
    
    F += f * timestep;
    time += timestep;
  }
  
  return data;
}

const soilPresets = {
  sand: { suctionHead: 4.95, conductivity: 4.74, initialDeficit: 0.34, saturatedContent: 0.437, fieldCapacity: 0.09 },
  loamySand: { suctionHead: 6.13, conductivity: 1.18, initialDeficit: 0.33, saturatedContent: 0.437, fieldCapacity: 0.12 },
  sandyLoam: { suctionHead: 11.01, conductivity: 0.43, initialDeficit: 0.30, saturatedContent: 0.453, fieldCapacity: 0.18 },
  loam: { suctionHead: 8.89, conductivity: 0.13, initialDeficit: 0.27, saturatedContent: 0.463, fieldCapacity: 0.23 },
  siltLoam: { suctionHead: 16.68, conductivity: 0.26, initialDeficit: 0.26, saturatedContent: 0.501, fieldCapacity: 0.28 },
  clay: { suctionHead: 31.63, conductivity: 0.01, initialDeficit: 0.22, saturatedContent: 0.475, fieldCapacity: 0.38 }
};

export default function GreenAmptPage() {
  const [activeTab, setActiveTab] = useState("standard");
  
  const [standardParams, setStandardParams] = useState<GreenAmptParams>({
    suctionHead: 11.01,
    conductivity: 0.43,
    initialDeficit: 0.30
  });
  
  const [modifiedParams, setModifiedParams] = useState<ModifiedGreenAmptParams>({
    suctionHead: 11.01,
    conductivity: 0.43,
    initialDeficit: 0.30,
    saturatedContent: 0.453,
    fieldCapacity: 0.18,
    redistributionTime: 4.0
  });
  
  const [duration, setDuration] = useState(6);

  const standardData = useMemo(() => {
    if (standardParams.suctionHead > 0 && standardParams.conductivity > 0 && standardParams.initialDeficit > 0) {
      return calculateGreenAmptInfiltration(standardParams, duration);
    }
    return [];
  }, [standardParams, duration]);

  const modifiedData = useMemo(() => {
    if (modifiedParams.suctionHead > 0 && modifiedParams.conductivity > 0 && modifiedParams.initialDeficit > 0) {
      return calculateModifiedGreenAmptInfiltration(modifiedParams, duration);
    }
    return [];
  }, [modifiedParams, duration]);

  const applyPreset = (soilType: keyof typeof soilPresets) => {
    const preset = soilPresets[soilType];
    if (activeTab === "standard") {
      setStandardParams({
        suctionHead: preset.suctionHead,
        conductivity: preset.conductivity,
        initialDeficit: preset.initialDeficit
      });
    } else {
      setModifiedParams({
        ...modifiedParams,
        suctionHead: preset.suctionHead,
        conductivity: preset.conductivity,
        initialDeficit: preset.initialDeficit,
        saturatedContent: preset.saturatedContent,
        fieldCapacity: preset.fieldCapacity
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/50 to-teal-50/30">
      <header className="border-b border-green-200/60 bg-white/70 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-green shadow-lg shadow-green-500/20">
              <Droplets className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Green-Ampt Infiltration</h1>
              <p className="text-sm text-green-700/70 font-mono">SWMM5 Calculator</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 bg-green-100/80 p-1">
            <TabsTrigger 
              value="standard" 
              className="data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm font-medium"
              data-testid="tab-standard"
            >
              <Layers className="w-4 h-4 mr-2" />
              Green-Ampt
            </TabsTrigger>
            <TabsTrigger 
              value="modified" 
              className="data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm font-medium"
              data-testid="tab-modified"
            >
              <ArrowDown className="w-4 h-4 mr-2" />
              Modified (Redistribution)
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="standard" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-1 border-green-200/60 shadow-lg shadow-green-500/5">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Calculator className="w-5 h-5 text-green-600" />
                        Parameters
                      </CardTitle>
                      <CardDescription>Standard Green-Ampt infiltration model</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="suction-std" className="text-sm font-medium flex items-center justify-between">
                          <span>Suction Head (ψ)</span>
                          <span className="text-xs text-muted-foreground font-mono">in</span>
                        </Label>
                        <Input
                          id="suction-std"
                          type="number"
                          step="0.1"
                          value={standardParams.suctionHead}
                          onChange={(e) => setStandardParams({ ...standardParams, suctionHead: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-suction-std"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="conductivity-std" className="text-sm font-medium flex items-center justify-between">
                          <span>Conductivity (Ks)</span>
                          <span className="text-xs text-muted-foreground font-mono">in/hr</span>
                        </Label>
                        <Input
                          id="conductivity-std"
                          type="number"
                          step="0.01"
                          value={standardParams.conductivity}
                          onChange={(e) => setStandardParams({ ...standardParams, conductivity: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-conductivity-std"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="deficit-std" className="text-sm font-medium flex items-center justify-between">
                          <span>Initial Deficit (θd)</span>
                          <span className="text-xs text-muted-foreground font-mono">fraction</span>
                        </Label>
                        <Input
                          id="deficit-std"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={standardParams.initialDeficit}
                          onChange={(e) => setStandardParams({ ...standardParams, initialDeficit: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-deficit-std"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="duration-std" className="text-sm font-medium flex items-center justify-between">
                          <span>Duration</span>
                          <span className="text-xs text-muted-foreground font-mono">hours</span>
                        </Label>
                        <Input
                          id="duration-std"
                          type="number"
                          step="1"
                          min="1"
                          max="24"
                          value={duration}
                          onChange={(e) => setDuration(parseFloat(e.target.value) || 6)}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-duration-std"
                        />
                      </div>

                      <div className="pt-4 border-t border-green-100">
                        <Label className="text-sm font-medium mb-3 block">Soil Presets</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.keys(soilPresets).map((soil) => (
                            <button
                              key={soil}
                              onClick={() => applyPreset(soil as keyof typeof soilPresets)}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors capitalize"
                              data-testid={`preset-${soil}`}
                            >
                              {soil.replace(/([A-Z])/g, ' $1').trim()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2 border-green-200/60 shadow-lg shadow-green-500/5">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">Infiltration Curve</CardTitle>
                      <CardDescription>f = Ks × (1 + ψ × θd / F)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={standardData.filter((_, i) => i % 5 === 0)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="time" 
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              label={{ value: 'Time (hr)', position: 'insideBottom', offset: -5, fontSize: 12 }}
                            />
                            <YAxis 
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              label={{ value: 'Rate (in/hr)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: '1px solid #d1fae5',
                                borderRadius: '8px',
                                fontSize: '12px'
                              }}
                              formatter={(value: number) => [value.toFixed(4), '']}
                            />
                            <Legend />
                            <Area 
                              type="monotone" 
                              dataKey="infiltrationRate" 
                              name="Infiltration Rate"
                              stroke="#16a34a" 
                              strokeWidth={2}
                              fill="url(#greenGradient)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="mt-6 grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                          <p className="text-xs text-green-600 font-medium mb-1">Initial Rate</p>
                          <p className="text-xl font-mono font-semibold text-green-800" data-testid="result-initial-rate-std">
                            {standardData[0]?.infiltrationRate.toFixed(3) || '—'} <span className="text-sm font-normal">in/hr</span>
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                          <p className="text-xs text-emerald-600 font-medium mb-1">Final Rate</p>
                          <p className="text-xl font-mono font-semibold text-emerald-800" data-testid="result-final-rate-std">
                            {standardData[standardData.length - 1]?.infiltrationRate.toFixed(3) || '—'} <span className="text-sm font-normal">in/hr</span>
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                          <p className="text-xs text-teal-600 font-medium mb-1">Total Infiltration</p>
                          <p className="text-xl font-mono font-semibold text-teal-800" data-testid="result-total-std">
                            {standardData[standardData.length - 1]?.cumulativeInfiltration.toFixed(2) || '—'} <span className="text-sm font-normal">in</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-green-200/60 shadow-lg shadow-green-500/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="w-5 h-5 text-green-600" />
                      About Green-Ampt Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm prose-green max-w-none">
                      <p className="text-gray-600 leading-relaxed">
                        The <strong>Green-Ampt</strong> infiltration method is a physically-based model that assumes 
                        a sharp wetting front separating saturated soil above from dry soil below. The model requires 
                        three parameters: <strong>suction head</strong> (capillary potential at the wetting front), 
                        <strong>saturated hydraulic conductivity</strong>, and <strong>initial moisture deficit</strong>.
                      </p>
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200 font-mono text-sm">
                        <p className="text-green-800 mb-2"><strong>Equation:</strong></p>
                        <p className="text-green-700">f = Ks × (1 + ψ × θd / F)</p>
                        <p className="text-green-600 text-xs mt-2">
                          where f = infiltration rate, Ks = saturated conductivity, ψ = suction head, 
                          θd = initial deficit, F = cumulative infiltration
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="modified" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="grid lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-1 border-green-200/60 shadow-lg shadow-green-500/5">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Calculator className="w-5 h-5 text-green-600" />
                        Parameters
                      </CardTitle>
                      <CardDescription>Green-Ampt with redistribution</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="suction-mod" className="text-sm font-medium flex items-center justify-between">
                          <span>Suction Head (ψ)</span>
                          <span className="text-xs text-muted-foreground font-mono">in</span>
                        </Label>
                        <Input
                          id="suction-mod"
                          type="number"
                          step="0.1"
                          value={modifiedParams.suctionHead}
                          onChange={(e) => setModifiedParams({ ...modifiedParams, suctionHead: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-suction-mod"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="conductivity-mod" className="text-sm font-medium flex items-center justify-between">
                          <span>Conductivity (Ks)</span>
                          <span className="text-xs text-muted-foreground font-mono">in/hr</span>
                        </Label>
                        <Input
                          id="conductivity-mod"
                          type="number"
                          step="0.01"
                          value={modifiedParams.conductivity}
                          onChange={(e) => setModifiedParams({ ...modifiedParams, conductivity: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-conductivity-mod"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="deficit-mod" className="text-sm font-medium flex items-center justify-between">
                          <span>Initial Deficit (θd)</span>
                          <span className="text-xs text-muted-foreground font-mono">fraction</span>
                        </Label>
                        <Input
                          id="deficit-mod"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={modifiedParams.initialDeficit}
                          onChange={(e) => setModifiedParams({ ...modifiedParams, initialDeficit: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-deficit-mod"
                        />
                      </div>

                      <div className="pt-3 border-t border-green-100">
                        <p className="text-xs font-medium text-green-700 mb-3">Redistribution Parameters</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="saturated-mod" className="text-sm font-medium flex items-center justify-between">
                          <span>Saturated Content (θs)</span>
                          <span className="text-xs text-muted-foreground font-mono">fraction</span>
                        </Label>
                        <Input
                          id="saturated-mod"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={modifiedParams.saturatedContent}
                          onChange={(e) => setModifiedParams({ ...modifiedParams, saturatedContent: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-saturated-mod"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="fieldcap-mod" className="text-sm font-medium flex items-center justify-between">
                          <span>Field Capacity (θfc)</span>
                          <span className="text-xs text-muted-foreground font-mono">fraction</span>
                        </Label>
                        <Input
                          id="fieldcap-mod"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={modifiedParams.fieldCapacity}
                          onChange={(e) => setModifiedParams({ ...modifiedParams, fieldCapacity: parseFloat(e.target.value) || 0 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-fieldcap-mod"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="redisttime-mod" className="text-sm font-medium flex items-center justify-between">
                          <span>Redistribution Time</span>
                          <span className="text-xs text-muted-foreground font-mono">hours</span>
                        </Label>
                        <Input
                          id="redisttime-mod"
                          type="number"
                          step="0.5"
                          min="0.1"
                          value={modifiedParams.redistributionTime}
                          onChange={(e) => setModifiedParams({ ...modifiedParams, redistributionTime: parseFloat(e.target.value) || 4 })}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-redisttime-mod"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="duration-mod" className="text-sm font-medium flex items-center justify-between">
                          <span>Duration</span>
                          <span className="text-xs text-muted-foreground font-mono">hours</span>
                        </Label>
                        <Input
                          id="duration-mod"
                          type="number"
                          step="1"
                          min="1"
                          max="24"
                          value={duration}
                          onChange={(e) => setDuration(parseFloat(e.target.value) || 6)}
                          className="font-mono border-green-200 focus:border-green-400 focus:ring-green-400"
                          data-testid="input-duration-mod"
                        />
                      </div>

                      <div className="pt-3 border-t border-green-100">
                        <Label className="text-sm font-medium mb-3 block">Soil Presets</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.keys(soilPresets).map((soil) => (
                            <button
                              key={soil}
                              onClick={() => applyPreset(soil as keyof typeof soilPresets)}
                              className="px-3 py-2 text-xs font-medium rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors capitalize"
                              data-testid={`preset-mod-${soil}`}
                            >
                              {soil.replace(/([A-Z])/g, ' $1').trim()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2 border-green-200/60 shadow-lg shadow-green-500/5">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg">Infiltration & Moisture Redistribution</CardTitle>
                      <CardDescription>Modified Green-Ampt with soil moisture recovery</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={modifiedData.filter((_, i) => i % 5 === 0)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="time" 
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              label={{ value: 'Time (hr)', position: 'insideBottom', offset: -5, fontSize: 12 }}
                            />
                            <YAxis 
                              yAxisId="left"
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              label={{ value: 'Rate (in/hr)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 12 }} 
                              tickLine={false}
                              domain={[0, 0.6]}
                              label={{ value: 'θ (fraction)', angle: 90, position: 'insideRight', fontSize: 12 }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'white', 
                                border: '1px solid #d1fae5',
                                borderRadius: '8px',
                                fontSize: '12px'
                              }}
                              formatter={(value: number) => [value.toFixed(4), '']}
                            />
                            <Legend />
                            <Line 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="infiltrationRate" 
                              name="Infiltration Rate"
                              stroke="#16a34a" 
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line 
                              yAxisId="right"
                              type="monotone" 
                              dataKey="moistureContent" 
                              name="Soil Moisture"
                              stroke="#0d9488" 
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="mt-6 grid grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                          <p className="text-xs text-green-600 font-medium mb-1">Initial Rate</p>
                          <p className="text-lg font-mono font-semibold text-green-800" data-testid="result-initial-rate-mod">
                            {modifiedData[0]?.infiltrationRate.toFixed(3) || '—'} <span className="text-xs font-normal">in/hr</span>
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                          <p className="text-xs text-emerald-600 font-medium mb-1">Final Rate</p>
                          <p className="text-lg font-mono font-semibold text-emerald-800" data-testid="result-final-rate-mod">
                            {modifiedData[modifiedData.length - 1]?.infiltrationRate.toFixed(3) || '—'} <span className="text-xs font-normal">in/hr</span>
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                          <p className="text-xs text-teal-600 font-medium mb-1">Total Infiltration</p>
                          <p className="text-lg font-mono font-semibold text-teal-800" data-testid="result-total-mod">
                            {modifiedData[modifiedData.length - 1]?.cumulativeInfiltration.toFixed(2) || '—'} <span className="text-xs font-normal">in</span>
                          </p>
                        </div>
                        <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200">
                          <p className="text-xs text-cyan-600 font-medium mb-1">Final Moisture</p>
                          <p className="text-lg font-mono font-semibold text-cyan-800" data-testid="result-moisture-mod">
                            {modifiedData[modifiedData.length - 1]?.moistureContent.toFixed(3) || '—'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-green-200/60 shadow-lg shadow-green-500/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="w-5 h-5 text-green-600" />
                      About Modified Green-Ampt Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm prose-green max-w-none">
                      <p className="text-gray-600 leading-relaxed">
                        The <strong>Modified Green-Ampt</strong> method (also called Green-Ampt with Redistribution) 
                        extends the standard model to account for soil moisture redistribution during dry periods 
                        between rainfall events. This allows for more accurate simulation of multi-event storms 
                        where the soil partially recovers its infiltration capacity.
                      </p>
                      <div className="mt-4 grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <p className="font-medium text-green-800 mb-2">Additional Parameters:</p>
                          <ul className="text-sm text-green-700 space-y-1">
                            <li><strong>θs</strong> - Saturated moisture content (porosity)</li>
                            <li><strong>θfc</strong> - Field capacity moisture content</li>
                            <li><strong>Redistribution Time</strong> - Recovery time constant</li>
                          </ul>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                          <p className="font-medium text-emerald-800 mb-2">Key Differences:</p>
                          <ul className="text-sm text-emerald-700 space-y-1">
                            <li>Tracks soil moisture content over time</li>
                            <li>Models moisture redistribution between events</li>
                            <li>Better for long-term continuous simulation</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}
