import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Droplets, 
  Calculator, 
  Table as TableIcon,
  Download,
  BookOpen,
  Save,
  Trash2,
  Plus,
  BarChart3,
  Printer,
  X,
  ChevronDown
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type InfiltrationMethod = "greenAmpt" | "modifiedGreenAmpt" | "horton" | "curveNumber";
type UnitSystem = "imperial" | "metric";

interface BaseParams {
  name: string;
  method: InfiltrationMethod;
  duration: number;
}

interface GreenAmptParams extends BaseParams {
  method: "greenAmpt";
  suctionHead: number;
  conductivity: number;
  initialDeficit: number;
}

interface ModifiedGreenAmptParams extends BaseParams {
  method: "modifiedGreenAmpt";
  suctionHead: number;
  conductivity: number;
  initialDeficit: number;
  saturatedContent: number;
  fieldCapacity: number;
  redistributionTime: number;
}

interface HortonParams extends BaseParams {
  method: "horton";
  maxRate: number;
  minRate: number;
  decayConstant: number;
}

interface CurveNumberParams extends BaseParams {
  method: "curveNumber";
  curveNumber: number;
  rainfall: number;
  initialAbstraction: number;
}

type ScenarioParams = GreenAmptParams | ModifiedGreenAmptParams | HortonParams | CurveNumberParams;

interface SavedPreset {
  id: string;
  name: string;
  params: ScenarioParams;
  createdAt: number;
}

const STORAGE_KEY = "infiltration-calculator-presets";

const unitConversions = {
  length: { imperial: 1, metric: 25.4, imperialLabel: "in", metricLabel: "mm" },
  rate: { imperial: 1, metric: 25.4, imperialLabel: "in/hr", metricLabel: "mm/hr" },
  time: { imperial: 1, metric: 1, imperialLabel: "hr", metricLabel: "hr" },
};

function convertValue(value: number, type: keyof typeof unitConversions, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return value;
  const conv = unitConversions[type];
  if (from === "imperial" && to === "metric") return value * conv.metric;
  return value / conv.metric;
}

function getUnitLabel(type: keyof typeof unitConversions, system: UnitSystem): string {
  return unitConversions[type][system === "imperial" ? "imperialLabel" : "metricLabel"];
}

const soilPresets = {
  sand: { suctionHead: 4.95, conductivity: 4.74, initialDeficit: 0.34, saturatedContent: 0.437, fieldCapacity: 0.09 },
  loamySand: { suctionHead: 6.13, conductivity: 1.18, initialDeficit: 0.33, saturatedContent: 0.437, fieldCapacity: 0.12 },
  sandyLoam: { suctionHead: 11.01, conductivity: 0.43, initialDeficit: 0.30, saturatedContent: 0.453, fieldCapacity: 0.18 },
  loam: { suctionHead: 8.89, conductivity: 0.13, initialDeficit: 0.27, saturatedContent: 0.463, fieldCapacity: 0.23 },
  siltLoam: { suctionHead: 16.68, conductivity: 0.26, initialDeficit: 0.26, saturatedContent: 0.501, fieldCapacity: 0.28 },
  clay: { suctionHead: 31.63, conductivity: 0.01, initialDeficit: 0.22, saturatedContent: 0.475, fieldCapacity: 0.38 }
};

const methodColors = {
  greenAmpt: "#16a34a",
  modifiedGreenAmpt: "#0d9488",
  horton: "#ea580c",
  curveNumber: "#7c3aed"
};

const methodLabels = {
  greenAmpt: "Green-Ampt",
  modifiedGreenAmpt: "Modified Green-Ampt",
  horton: "Horton",
  curveNumber: "SCS Curve Number"
};

function calculateInfiltration(params: ScenarioParams, timestep: number = 0.1): { time: number; infiltrationRate: number; cumulativeInfiltration: number }[] {
  const data: { time: number; infiltrationRate: number; cumulativeInfiltration: number }[] = [];
  
  if (params.method === "greenAmpt") {
    let F = 0.001;
    let time = 0;
    while (time <= params.duration) {
      const f = params.conductivity * (1 + (params.suctionHead * params.initialDeficit) / F);
      data.push({ time: parseFloat(time.toFixed(2)), infiltrationRate: parseFloat(f.toFixed(4)), cumulativeInfiltration: parseFloat(F.toFixed(4)) });
      F += f * timestep;
      time += timestep;
    }
  } else if (params.method === "modifiedGreenAmpt") {
    let F = 0.001;
    let time = 0;
    while (time <= params.duration) {
      const redistributionFactor = Math.exp(-time / Math.max(params.redistributionTime, 0.1));
      const effectiveDeficit = params.initialDeficit * (1 - redistributionFactor * 0.3);
      const f = params.conductivity * (1 + (params.suctionHead * effectiveDeficit) / F);
      data.push({ time: parseFloat(time.toFixed(2)), infiltrationRate: parseFloat(f.toFixed(4)), cumulativeInfiltration: parseFloat(F.toFixed(4)) });
      F += f * timestep;
      time += timestep;
    }
  } else if (params.method === "horton") {
    let F = 0;
    let time = 0;
    while (time <= params.duration) {
      const f = params.minRate + (params.maxRate - params.minRate) * Math.exp(-params.decayConstant * time);
      F += f * timestep;
      data.push({ time: parseFloat(time.toFixed(2)), infiltrationRate: parseFloat(f.toFixed(4)), cumulativeInfiltration: parseFloat(F.toFixed(4)) });
      time += timestep;
    }
  } else if (params.method === "curveNumber") {
    const S = (1000 / params.curveNumber) - 10;
    const Ia = params.initialAbstraction * S;
    let time = 0;
    let prevInfiltration = 0;
    while (time <= params.duration) {
      const P = (params.rainfall / params.duration) * time;
      let Q = 0;
      if (P > Ia) {
        Q = Math.pow(P - Ia, 2) / (P - Ia + S);
      }
      const infiltration = P - Q;
      const deltaF = infiltration - prevInfiltration;
      const rate = deltaF / timestep;
      data.push({ time: parseFloat(time.toFixed(2)), infiltrationRate: parseFloat(Math.max(0, rate).toFixed(4)), cumulativeInfiltration: parseFloat(infiltration.toFixed(4)) });
      prevInfiltration = infiltration;
      time += timestep;
    }
  }
  
  return data;
}

function getDefaultParams(method: InfiltrationMethod): ScenarioParams {
  switch (method) {
    case "greenAmpt":
      return { name: "Green-Ampt", method: "greenAmpt", duration: 6, suctionHead: 11.01, conductivity: 0.43, initialDeficit: 0.30 };
    case "modifiedGreenAmpt":
      return { name: "Modified G-A", method: "modifiedGreenAmpt", duration: 6, suctionHead: 11.01, conductivity: 0.43, initialDeficit: 0.30, saturatedContent: 0.453, fieldCapacity: 0.18, redistributionTime: 4.0 };
    case "horton":
      return { name: "Horton", method: "horton", duration: 6, maxRate: 3.0, minRate: 0.5, decayConstant: 2.0 };
    case "curveNumber":
      return { name: "Curve Number", method: "curveNumber", duration: 6, curveNumber: 75, rainfall: 4.0, initialAbstraction: 0.2 };
  }
}

export default function GreenAmptPage() {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [units, setUnits] = useState<UnitSystem>("imperial");
  const [comparisonMode, setComparisonMode] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioParams[]>([getDefaultParams("greenAmpt")]);
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedPresets(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load presets:", e);
      }
    }
  }, []);

  const savePreset = () => {
    if (!presetName.trim()) {
      toast({ title: "Error", description: "Please enter a preset name.", variant: "destructive" });
      return;
    }
    const newPreset: SavedPreset = {
      id: Date.now().toString(),
      name: presetName,
      params: { ...scenarios[activeScenarioIndex] },
      createdAt: Date.now()
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPresetName("");
    setShowSaveDialog(false);
    toast({ title: "Saved", description: `Preset "${presetName}" has been saved.` });
  };

  const loadPreset = (preset: SavedPreset) => {
    const updated = [...scenarios];
    updated[activeScenarioIndex] = { ...preset.params };
    setScenarios(updated);
    toast({ title: "Loaded", description: `Preset "${preset.name}" has been loaded.` });
  };

  const deletePreset = (id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast({ title: "Deleted", description: "Preset has been removed." });
  };

  const addScenario = (method: InfiltrationMethod) => {
    if (scenarios.length >= 4) {
      toast({ title: "Limit Reached", description: "Maximum 4 scenarios for comparison.", variant: "destructive" });
      return;
    }
    setScenarios([...scenarios, getDefaultParams(method)]);
    setActiveScenarioIndex(scenarios.length);
  };

  const removeScenario = (index: number) => {
    if (scenarios.length <= 1) return;
    const updated = scenarios.filter((_, i) => i !== index);
    setScenarios(updated);
    setActiveScenarioIndex(Math.min(activeScenarioIndex, updated.length - 1));
  };

  const updateScenario = (index: number, updates: Partial<ScenarioParams>) => {
    const updated = [...scenarios];
    updated[index] = { ...updated[index], ...updates } as ScenarioParams;
    setScenarios(updated);
  };

  const applySoilPreset = (soilType: keyof typeof soilPresets) => {
    const preset = soilPresets[soilType];
    const current = scenarios[activeScenarioIndex];
    if (current.method === "greenAmpt") {
      updateScenario(activeScenarioIndex, {
        suctionHead: preset.suctionHead,
        conductivity: preset.conductivity,
        initialDeficit: preset.initialDeficit
      });
    } else if (current.method === "modifiedGreenAmpt") {
      updateScenario(activeScenarioIndex, {
        suctionHead: preset.suctionHead,
        conductivity: preset.conductivity,
        initialDeficit: preset.initialDeficit,
        saturatedContent: preset.saturatedContent,
        fieldCapacity: preset.fieldCapacity
      });
    }
    toast({ title: "Applied", description: `${soilType.replace(/([A-Z])/g, ' $1')} soil values loaded.` });
  };

  const calculatedData = useMemo(() => {
    return scenarios.map(params => calculateInfiltration(params));
  }, [scenarios]);

  const chartData = useMemo(() => {
    if (!comparisonMode) {
      return calculatedData[activeScenarioIndex]?.filter((_, i) => i % 5 === 0) || [];
    }
    const maxLength = Math.max(...calculatedData.map(d => d.length));
    const combined: any[] = [];
    for (let i = 0; i < maxLength; i += 5) {
      const point: any = { time: calculatedData[0]?.[i]?.time || i * 0.1 };
      scenarios.forEach((s, idx) => {
        const data = calculatedData[idx]?.[i];
        if (data) {
          point[`rate_${idx}`] = data.infiltrationRate;
        }
      });
      combined.push(point);
    }
    return combined;
  }, [calculatedData, comparisonMode, activeScenarioIndex, scenarios]);

  const copyToClipboard = (data: any[]) => {
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(","));
    const csv = [headers, ...rows].join("\n");
    navigator.clipboard.writeText(csv);
    toast({ title: "Copied", description: "Data copied in CSV format." });
  };

  const handlePrint = () => {
    window.print();
  };

  const current = scenarios[activeScenarioIndex];
  const currentData = calculatedData[activeScenarioIndex] || [];

  const renderParameterInputs = () => {
    const params = scenarios[activeScenarioIndex];
    const lengthUnit = getUnitLabel("length", units);
    const rateUnit = getUnitLabel("rate", units);

    if (params.method === "greenAmpt" || params.method === "modifiedGreenAmpt") {
      return (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Suction Head (ψ)</span>
              <span className="text-xs text-muted-foreground font-mono">{lengthUnit}</span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={params.suctionHead}
              onChange={(e) => updateScenario(activeScenarioIndex, { suctionHead: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="font-mono border-green-200"
              data-testid="input-suction"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Conductivity (Ks)</span>
              <span className="text-xs text-muted-foreground font-mono">{rateUnit}</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={params.conductivity}
              onChange={(e) => updateScenario(activeScenarioIndex, { conductivity: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="font-mono border-green-200"
              data-testid="input-conductivity"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Initial Deficit (θd)</span>
              <span className="text-xs text-muted-foreground font-mono">fraction</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={params.initialDeficit}
              onChange={(e) => updateScenario(activeScenarioIndex, { initialDeficit: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) })}
              className="font-mono border-green-200"
              data-testid="input-deficit"
            />
          </div>
          {params.method === "modifiedGreenAmpt" && (
            <>
              <div className="pt-3 border-t border-green-100">
                <p className="text-xs font-medium text-green-700 mb-3">Redistribution Parameters</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center justify-between">
                  <span>Saturated Content (θs)</span>
                  <span className="text-xs text-muted-foreground font-mono">fraction</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={params.saturatedContent}
                  onChange={(e) => updateScenario(activeScenarioIndex, { saturatedContent: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) })}
                  className="font-mono border-green-200"
                  data-testid="input-saturated"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center justify-between">
                  <span>Field Capacity (θfc)</span>
                  <span className="text-xs text-muted-foreground font-mono">fraction</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={params.fieldCapacity}
                  onChange={(e) => updateScenario(activeScenarioIndex, { fieldCapacity: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) })}
                  className="font-mono border-green-200"
                  data-testid="input-fieldcap"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center justify-between">
                  <span>Redistribution Time</span>
                  <span className="text-xs text-muted-foreground font-mono">hr</span>
                </Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={params.redistributionTime}
                  onChange={(e) => updateScenario(activeScenarioIndex, { redistributionTime: Math.max(0.1, parseFloat(e.target.value) || 4) })}
                  className="font-mono border-green-200"
                  data-testid="input-redisttime"
                />
              </div>
            </>
          )}
          <div className="pt-3 border-t border-green-100">
            <Label className="text-sm font-medium mb-3 block">Soil Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(soilPresets).map((soil) => (
                <button
                  key={soil}
                  onClick={() => applySoilPreset(soil as keyof typeof soilPresets)}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors capitalize"
                  data-testid={`preset-${soil}`}
                >
                  {soil.replace(/([A-Z])/g, ' $1').trim()}
                </button>
              ))}
            </div>
          </div>
        </>
      );
    } else if (params.method === "horton") {
      return (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Maximum Rate (f₀)</span>
              <span className="text-xs text-muted-foreground font-mono">{rateUnit}</span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={params.maxRate}
              onChange={(e) => updateScenario(activeScenarioIndex, { maxRate: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="font-mono border-orange-200"
              data-testid="input-maxrate"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Minimum Rate (fc)</span>
              <span className="text-xs text-muted-foreground font-mono">{rateUnit}</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={params.minRate}
              onChange={(e) => updateScenario(activeScenarioIndex, { minRate: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="font-mono border-orange-200"
              data-testid="input-minrate"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Decay Constant (k)</span>
              <span className="text-xs text-muted-foreground font-mono">1/hr</span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={params.decayConstant}
              onChange={(e) => updateScenario(activeScenarioIndex, { decayConstant: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="font-mono border-orange-200"
              data-testid="input-decay"
            />
          </div>
          <div className="pt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-xs text-orange-700 font-mono">f = fc + (f₀ - fc) × e^(-kt)</p>
          </div>
        </>
      );
    } else if (params.method === "curveNumber") {
      return (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Curve Number (CN)</span>
              <span className="text-xs text-muted-foreground font-mono">—</span>
            </Label>
            <Input
              type="number"
              step="1"
              min="30"
              max="100"
              value={params.curveNumber}
              onChange={(e) => updateScenario(activeScenarioIndex, { curveNumber: Math.min(100, Math.max(30, parseFloat(e.target.value) || 75)) })}
              className="font-mono border-purple-200"
              data-testid="input-cn"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Total Rainfall (P)</span>
              <span className="text-xs text-muted-foreground font-mono">{lengthUnit}</span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={params.rainfall}
              onChange={(e) => updateScenario(activeScenarioIndex, { rainfall: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="font-mono border-purple-200"
              data-testid="input-rainfall"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Initial Abstraction (Ia/S)</span>
              <span className="text-xs text-muted-foreground font-mono">ratio</span>
            </Label>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="0.5"
              value={params.initialAbstraction}
              onChange={(e) => updateScenario(activeScenarioIndex, { initialAbstraction: Math.min(0.5, Math.max(0, parseFloat(e.target.value) || 0.2)) })}
              className="font-mono border-purple-200"
              data-testid="input-ia"
            />
          </div>
          <div className="pt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-xs text-purple-700 font-mono">Q = (P - Ia)² / (P - Ia + S)</p>
            <p className="text-xs text-purple-600 mt-1">where S = 1000/CN - 10</p>
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/50 to-teal-50/30 pb-20">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <header className="border-b border-green-200/60 bg-white/70 backdrop-blur-sm sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl gradient-green shadow-lg shadow-green-500/20">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Infiltration Calculator</h1>
                <p className="text-sm text-green-700/70 font-mono">SWMM5 Methods</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="units-toggle" className="text-sm text-gray-600">Units:</Label>
                <Select value={units} onValueChange={(v) => setUnits(v as UnitSystem)}>
                  <SelectTrigger className="w-28" data-testid="units-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imperial">Imperial</SelectItem>
                    <SelectItem value="metric">Metric</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  id="comparison-mode"
                  checked={comparisonMode}
                  onCheckedChange={setComparisonMode}
                  data-testid="comparison-toggle"
                />
                <Label htmlFor="comparison-mode" className="text-sm text-gray-600">Compare</Label>
              </div>

              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2" data-testid="btn-print">
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6 no-print">
            {comparisonMode && (
              <Card className="border-blue-200/60 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Scenarios
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {scenarios.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveScenarioIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        idx === activeScenarioIndex ? 'bg-blue-100 border-2 border-blue-400' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                      }`}
                      data-testid={`scenario-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: methodColors[s.method] }} />
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-xs text-gray-500">({methodLabels[s.method]})</span>
                      </div>
                      {scenarios.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); removeScenario(idx); }} className="text-gray-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full gap-2" data-testid="btn-add-scenario">
                        <Plus className="w-4 h-4" />
                        Add Scenario
                        <ChevronDown className="w-4 h-4 ml-auto" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => addScenario("greenAmpt")}>Green-Ampt</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addScenario("modifiedGreenAmpt")}>Modified Green-Ampt</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addScenario("horton")}>Horton</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addScenario("curveNumber")}>SCS Curve Number</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            )}

            <Card className="border-green-200/60 shadow-lg shadow-green-500/5">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calculator className="w-5 h-5 text-green-600" />
                    {comparisonMode ? `Scenario ${activeScenarioIndex + 1}` : "Parameters"}
                  </CardTitle>
                  {!comparisonMode && (
                    <Select
                      value={current.method}
                      onValueChange={(v) => setScenarios([getDefaultParams(v as InfiltrationMethod)])}
                    >
                      <SelectTrigger className="w-40" data-testid="method-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="greenAmpt">Green-Ampt</SelectItem>
                        <SelectItem value="modifiedGreenAmpt">Modified G-A</SelectItem>
                        <SelectItem value="horton">Horton</SelectItem>
                        <SelectItem value="curveNumber">Curve Number</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <CardDescription>{methodLabels[current.method]} infiltration model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comparisonMode && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Scenario Name</Label>
                    <Input
                      value={current.name}
                      onChange={(e) => updateScenario(activeScenarioIndex, { name: e.target.value })}
                      className="font-mono"
                      data-testid="input-scenario-name"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center justify-between">
                    <span>Duration</span>
                    <span className="text-xs text-muted-foreground font-mono">hr</span>
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    max="24"
                    value={current.duration}
                    onChange={(e) => updateScenario(activeScenarioIndex, { duration: Math.min(24, Math.max(1, parseFloat(e.target.value) || 6)) })}
                    className="font-mono border-green-200"
                    data-testid="input-duration"
                  />
                </div>
                {renderParameterInputs()}
              </CardContent>
            </Card>

            <Card className="border-green-200/60 shadow-lg shadow-green-500/5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Save className="w-5 h-5 text-green-600" />
                  Saved Presets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2" data-testid="btn-save-preset">
                      <Save className="w-4 h-4" />
                      Save Current
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Preset</DialogTitle>
                      <DialogDescription>Save current parameters for future use.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Preset Name</Label>
                        <Input
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                          placeholder="e.g., Sandy Loam - Wet Conditions"
                          data-testid="input-preset-name"
                        />
                      </div>
                      <Button onClick={savePreset} className="w-full bg-green-600 hover:bg-green-700" data-testid="btn-confirm-save">
                        Save Preset
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <ScrollArea className="h-[150px]">
                  {savedPresets.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No saved presets yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {savedPresets.map((preset) => (
                        <div key={preset.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border">
                          <button
                            onClick={() => loadPreset(preset)}
                            className="text-left flex-1"
                            data-testid={`load-preset-${preset.id}`}
                          >
                            <p className="text-sm font-medium">{preset.name}</p>
                            <p className="text-xs text-gray-500">{methodLabels[preset.params.method]}</p>
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                            data-testid={`delete-preset-${preset.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6 print-section" ref={printRef}>
            <Card className="border-green-200/60 shadow-lg shadow-green-500/5">
              <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">
                    {comparisonMode ? "Comparison Chart" : "Infiltration Curve"}
                  </CardTitle>
                  <CardDescription>
                    {comparisonMode 
                      ? `Comparing ${scenarios.length} scenarios`
                      : methodLabels[current.method]
                    }
                  </CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-green-700 border-green-200 hover:bg-green-50 no-print">
                      <TableIcon className="w-4 h-4" />
                      View Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Calculation Data</DialogTitle>
                      <DialogDescription>Time-step data for all scenarios.</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time ({getUnitLabel("time", units)})</TableHead>
                            {scenarios.map((s, idx) => (
                              <TableHead key={idx}>{s.name} Rate ({getUnitLabel("rate", units)})</TableHead>
                            ))}
                            {scenarios.map((s, idx) => (
                              <TableHead key={`cum-${idx}`}>{s.name} Cumulative ({getUnitLabel("length", units)})</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(calculatedData[0] || []).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell>{calculatedData[0]?.[i]?.time}</TableCell>
                              {scenarios.map((_, idx) => (
                                <TableCell key={idx}>
                                  {units === "imperial" 
                                    ? calculatedData[idx]?.[i]?.infiltrationRate.toFixed(4)
                                    : (calculatedData[idx]?.[i]?.infiltrationRate * 25.4).toFixed(4)
                                  }
                                </TableCell>
                              ))}
                              {scenarios.map((_, idx) => (
                                <TableCell key={`cum-${idx}`}>
                                  {units === "imperial"
                                    ? calculatedData[idx]?.[i]?.cumulativeInfiltration.toFixed(4)
                                    : (calculatedData[idx]?.[i]?.cumulativeInfiltration * 25.4).toFixed(4)
                                  }
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button onClick={() => copyToClipboard(calculatedData[0] || [])} className="gap-2 bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4" />
                        Copy to CSV
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        label={{ value: `Time (${getUnitLabel("time", units)})`, position: 'insideBottom', offset: -5, fontSize: 12 }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        label={{ value: `Rate (${getUnitLabel("rate", units)})`, angle: -90, position: 'insideLeft', fontSize: 12 }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #d1fae5', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [(units === "imperial" ? value : value * 25.4).toFixed(4), '']}
                      />
                      <Legend />
                      {comparisonMode ? (
                        scenarios.map((s, idx) => (
                          <Line 
                            key={idx}
                            type="monotone" 
                            dataKey={`rate_${idx}`}
                            name={s.name}
                            stroke={methodColors[s.method]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))
                      ) : (
                        <Line 
                          type="monotone" 
                          dataKey="infiltrationRate"
                          name="Infiltration Rate"
                          stroke={methodColors[current.method]}
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-xs text-green-600 font-medium mb-1">Initial Rate</p>
                <p className="text-xl font-mono font-semibold text-green-800" data-testid="result-initial-rate">
                  {currentData[0]?.infiltrationRate 
                    ? (units === "imperial" ? currentData[0].infiltrationRate : currentData[0].infiltrationRate * 25.4).toFixed(3)
                    : '—'
                  } <span className="text-sm font-normal">{getUnitLabel("rate", units)}</span>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-600 font-medium mb-1">Final Rate</p>
                <p className="text-xl font-mono font-semibold text-emerald-800" data-testid="result-final-rate">
                  {currentData[currentData.length - 1]?.infiltrationRate
                    ? (units === "imperial" ? currentData[currentData.length - 1].infiltrationRate : currentData[currentData.length - 1].infiltrationRate * 25.4).toFixed(3)
                    : '—'
                  } <span className="text-sm font-normal">{getUnitLabel("rate", units)}</span>
                </p>
              </div>
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                <p className="text-xs text-teal-600 font-medium mb-1">Total Infiltration</p>
                <p className="text-xl font-mono font-semibold text-teal-800" data-testid="result-total">
                  {currentData[currentData.length - 1]?.cumulativeInfiltration
                    ? (units === "imperial" ? currentData[currentData.length - 1].cumulativeInfiltration : currentData[currentData.length - 1].cumulativeInfiltration * 25.4).toFixed(2)
                    : '—'
                  } <span className="text-sm font-normal">{getUnitLabel("length", units)}</span>
                </p>
              </div>
            </div>

            <Card className="border-green-200/60 shadow-lg shadow-green-500/5">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="w-5 h-5 text-green-600" />
                  Method Reference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="font-medium text-green-800 mb-2">Green-Ampt</p>
                    <p className="text-xs text-green-700 font-mono mb-2">f = Ks × (1 + ψ × θd / F)</p>
                    <p className="text-xs text-green-600">Physically-based model assuming a sharp wetting front.</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="font-medium text-orange-800 mb-2">Horton</p>
                    <p className="text-xs text-orange-700 font-mono mb-2">f = fc + (f₀ - fc) × e^(-kt)</p>
                    <p className="text-xs text-orange-600">Empirical exponential decay model.</p>
                  </div>
                  <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                    <p className="font-medium text-teal-800 mb-2">Modified Green-Ampt</p>
                    <p className="text-xs text-teal-700 font-mono mb-2">Includes moisture redistribution</p>
                    <p className="text-xs text-teal-600">Accounts for soil recovery between rainfall events.</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="font-medium text-purple-800 mb-2">SCS Curve Number</p>
                    <p className="text-xs text-purple-700 font-mono mb-2">Q = (P - Ia)² / (P - Ia + S)</p>
                    <p className="text-xs text-purple-600">Event-based runoff abstraction method.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
