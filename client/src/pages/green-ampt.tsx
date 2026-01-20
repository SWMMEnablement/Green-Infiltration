import { useState, useMemo, useEffect, useRef, Fragment } from "react";
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
  ChevronDown,
  HelpCircle,
  AlertTriangle,
  Image,
  Sparkles,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const parameterHelp = {
  suctionHead: { 
    label: "Suction Head (ψ)", 
    description: "Capillary suction at wetting front",
    ranges: { sand: "2-5", sandyLoam: "4-9", loam: "3-11", clay: "6-32" },
    unit: "in"
  },
  conductivity: { 
    label: "Saturated Hydraulic Conductivity (Ks)", 
    description: "Rate water moves through saturated soil",
    ranges: { sand: "4.6-9.4", sandyLoam: "0.4-2.4", loam: "0.1-0.8", clay: "0.01-0.06" },
    unit: "in/hr"
  },
  initialDeficit: { 
    label: "Initial Moisture Deficit (Δθ)", 
    description: "Porosity minus initial moisture content. Represents available pore space.",
    ranges: { sand: "0.30-0.40", sandyLoam: "0.25-0.35", loam: "0.25-0.35", clay: "0.15-0.25" },
    unit: "fraction (0-1)"
  },
  saturatedContent: {
    label: "Saturated Moisture Content (θs)",
    description: "Soil porosity - maximum water content when fully saturated",
    ranges: { sand: "0.35-0.45", loam: "0.40-0.50", clay: "0.45-0.55" },
    unit: "fraction"
  },
  fieldCapacity: {
    label: "Field Capacity (θfc)",
    description: "Moisture content after gravity drainage (~2-3 days after saturation)",
    ranges: { sand: "0.06-0.12", loam: "0.15-0.25", clay: "0.25-0.40" },
    unit: "fraction"
  },
  curveNumber: {
    label: "SCS Curve Number (CN)",
    description: "Runoff potential index based on land use and soil type",
    ranges: { "low runoff": "30-60", "moderate": "60-75", "high runoff": "75-90", "impervious": "90-98" },
    unit: "dimensionless (30-100)"
  },
  maxRate: {
    label: "Maximum Infiltration Rate (f₀)",
    description: "Initial infiltration rate when soil is dry",
    ranges: { sand: "5-10", loam: "1-4", clay: "0.1-1" },
    unit: "in/hr"
  },
  minRate: {
    label: "Minimum Infiltration Rate (fc)",
    description: "Final steady-state infiltration (approaches Ks)",
    ranges: { sand: "0.4-1.2", loam: "0.1-0.5", clay: "0.01-0.1" },
    unit: "in/hr"
  },
  decayConstant: {
    label: "Decay Constant (k)",
    description: "Controls how fast infiltration decreases from f₀ to fc",
    ranges: { typical: "2-6" },
    unit: "1/hr"
  }
};

type InfiltrationMethod = "greenAmpt" | "modifiedGreenAmpt" | "horton" | "curveNumber";
type UnitSystem = "imperial" | "metric";

interface BaseParams {
  name: string;
  method: InfiltrationMethod;
  duration: number;
}

type RainfallDistribution = "constant" | "triangular" | "frontLoaded" | "backLoaded" | "scsTypeI" | "scsTypeIA" | "scsTypeII" | "scsTypeIII" | "huffQ1" | "huffQ2" | "huffQ3" | "huffQ4" | "chicago";

interface GreenAmptParams extends BaseParams {
  method: "greenAmpt";
  suctionHead: number;
  conductivity: number;
  initialDeficit: number;
  rainfallRate: number;
  rainfallDistribution: RainfallDistribution;
}

interface ModifiedGreenAmptParams extends BaseParams {
  method: "modifiedGreenAmpt";
  suctionHead: number;
  conductivity: number;
  initialDeficit: number;
  saturatedContent: number;
  fieldCapacity: number;
  redistributionTime: number;
  rainfallRate: number;
  rainfallDistribution: RainfallDistribution;
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

interface InfiltrationDataPoint {
  time: number;
  infiltrationRate: number;
  actualInfiltrationRate: number;
  cumulativeInfiltration: number;
  runoff?: number;
  cumulativeRunoff?: number;
  rainfallIntensity?: number;
}

interface InfiltrationResult {
  data: InfiltrationDataPoint[];
  timeToPonding?: number;
  totalRunoff: number;
  totalInfiltration: number;
}

function calculateInfiltration(params: ScenarioParams, timestep: number = 0.1): InfiltrationResult {
  const data: InfiltrationDataPoint[] = [];
  let totalRunoff = 0;
  let timeToPonding: number | undefined;
  
  if (params.method === "greenAmpt") {
    let F = 0.001;
    let time = 0;
    let cumulativeRunoff = 0;
    while (time <= params.duration) {
      const rainfall = params.rainfallRate > 0 
        ? getRainfallAtTime(params.rainfallRate, time, params.duration, params.rainfallDistribution)
        : 0;
      const potentialRate = params.conductivity * (1 + (params.suctionHead * params.initialDeficit) / F);
      const actualRate = rainfall > 0 ? Math.min(potentialRate, rainfall) : potentialRate;
      const runoffRate = rainfall > 0 ? Math.max(0, rainfall - potentialRate) : 0;
      F += actualRate * timestep;
      cumulativeRunoff += runoffRate * timestep;
      if (timeToPonding === undefined && rainfall > 0 && rainfall > potentialRate) {
        timeToPonding = time;
      }
      data.push({ 
        time: parseFloat(time.toFixed(2)), 
        infiltrationRate: parseFloat(potentialRate.toFixed(4)), 
        actualInfiltrationRate: parseFloat(actualRate.toFixed(4)),
        cumulativeInfiltration: parseFloat(F.toFixed(4)),
        runoff: parseFloat(runoffRate.toFixed(4)),
        cumulativeRunoff: parseFloat(cumulativeRunoff.toFixed(4)),
        rainfallIntensity: parseFloat(rainfall.toFixed(4))
      });
      time += timestep;
    }
    totalRunoff = cumulativeRunoff;
  } else if (params.method === "modifiedGreenAmpt") {
    let F = 0.001;
    let time = 0;
    let cumulativeRunoff = 0;
    while (time <= params.duration) {
      const rainfall = params.rainfallRate > 0 
        ? getRainfallAtTime(params.rainfallRate, time, params.duration, params.rainfallDistribution)
        : 0;
      const redistributionFactor = Math.exp(-time / Math.max(params.redistributionTime, 0.1));
      const effectiveDeficit = params.initialDeficit * (1 - redistributionFactor * 0.3);
      const potentialRate = params.conductivity * (1 + (params.suctionHead * effectiveDeficit) / F);
      const actualRate = rainfall > 0 ? Math.min(potentialRate, rainfall) : potentialRate;
      const runoffRate = rainfall > 0 ? Math.max(0, rainfall - potentialRate) : 0;
      cumulativeRunoff += runoffRate * timestep;
      if (timeToPonding === undefined && rainfall > 0 && rainfall > potentialRate) {
        timeToPonding = time;
      }
      data.push({ 
        time: parseFloat(time.toFixed(2)), 
        infiltrationRate: parseFloat(potentialRate.toFixed(4)), 
        actualInfiltrationRate: parseFloat(actualRate.toFixed(4)),
        cumulativeInfiltration: parseFloat(F.toFixed(4)),
        runoff: parseFloat(runoffRate.toFixed(4)),
        cumulativeRunoff: parseFloat(cumulativeRunoff.toFixed(4)),
        rainfallIntensity: parseFloat(rainfall.toFixed(4))
      });
      F += actualRate * timestep;
      time += timestep;
    }
    totalRunoff = cumulativeRunoff;
  } else if (params.method === "horton") {
    let F = 0;
    let time = 0;
    while (time <= params.duration) {
      const f = params.minRate + (params.maxRate - params.minRate) * Math.exp(-params.decayConstant * time);
      F += f * timestep;
      data.push({ time: parseFloat(time.toFixed(2)), infiltrationRate: parseFloat(f.toFixed(4)), actualInfiltrationRate: parseFloat(f.toFixed(4)), cumulativeInfiltration: parseFloat(F.toFixed(4)), runoff: 0, cumulativeRunoff: 0 });
      time += timestep;
    }
  } else if (params.method === "curveNumber") {
    const S = (1000 / params.curveNumber) - 10;
    const Ia = params.initialAbstraction * S;
    let time = 0;
    let prevInfiltration = 0;
    let cumulativeRunoff = 0;
    while (time <= params.duration) {
      const P = (params.rainfall / params.duration) * time;
      let Q = 0;
      if (P > Ia) {
        Q = Math.pow(P - Ia, 2) / (P - Ia + S);
      }
      const infiltration = P - Q;
      const deltaF = infiltration - prevInfiltration;
      const rate = deltaF / timestep;
      cumulativeRunoff = Q;
      data.push({ time: parseFloat(time.toFixed(2)), infiltrationRate: parseFloat(Math.max(0, rate).toFixed(4)), actualInfiltrationRate: parseFloat(Math.max(0, rate).toFixed(4)), cumulativeInfiltration: parseFloat(infiltration.toFixed(4)), runoff: 0, cumulativeRunoff: parseFloat(Q.toFixed(4)) });
      prevInfiltration = infiltration;
      time += timestep;
    }
    totalRunoff = cumulativeRunoff;
  }
  
  const totalInfiltration = data.length > 0 ? data[data.length - 1].cumulativeInfiltration : 0;
  return { data, timeToPonding, totalRunoff, totalInfiltration };
}

function getRainfallAtTime(peakRate: number, time: number, duration: number, distribution: RainfallDistribution): number {
  const t = time / duration;
  switch (distribution) {
    case "constant":
      return peakRate;
    case "triangular":
      return t < 0.5 ? peakRate * 2 * t : peakRate * 2 * (1 - t);
    case "frontLoaded":
      return peakRate * Math.exp(-2 * t) * 2;
    case "backLoaded":
      return peakRate * (1 - Math.exp(-3 * t)) * 1.5;
    case "scsTypeI":
      if (t < 0.25) return peakRate * 0.4;
      if (t < 0.375) return peakRate * 0.8;
      if (t < 0.5) return peakRate * 2.0;
      if (t < 0.625) return peakRate * 1.2;
      return peakRate * 0.5;
    case "scsTypeIA":
      if (t < 0.25) return peakRate * 0.5;
      if (t < 0.375) return peakRate * 2.2;
      if (t < 0.5) return peakRate * 1.0;
      return peakRate * 0.4;
    case "scsTypeII":
      if (t < 0.375) return peakRate * 0.3;
      if (t < 0.5) return peakRate * 2.5;
      if (t < 0.625) return peakRate * 1.5;
      return peakRate * 0.4;
    case "scsTypeIII":
      if (t < 0.25) return peakRate * 0.35;
      if (t < 0.5) return peakRate * 2.2;
      if (t < 0.625) return peakRate * 1.3;
      return peakRate * 0.45;
    case "huffQ1":
      if (t < 0.25) return peakRate * 2.5;
      if (t < 0.5) return peakRate * 1.0;
      if (t < 0.75) return peakRate * 0.4;
      return peakRate * 0.2;
    case "huffQ2":
      if (t < 0.25) return peakRate * 0.6;
      if (t < 0.5) return peakRate * 2.2;
      if (t < 0.75) return peakRate * 0.8;
      return peakRate * 0.4;
    case "huffQ3":
      if (t < 0.25) return peakRate * 0.4;
      if (t < 0.5) return peakRate * 0.8;
      if (t < 0.75) return peakRate * 2.2;
      return peakRate * 0.6;
    case "huffQ4":
      if (t < 0.25) return peakRate * 0.2;
      if (t < 0.5) return peakRate * 0.4;
      if (t < 0.75) return peakRate * 1.0;
      return peakRate * 2.5;
    case "chicago":
      const r = 0.4;
      const peakTime = r * duration;
      const a = 0.8;
      const b = 0.6;
      if (time <= peakTime) {
        const tb = (peakTime - time) / peakTime;
        return peakRate * (1 + a * tb) / Math.pow(1 + b * tb, 2);
      } else {
        const ta = (time - peakTime) / (duration - peakTime);
        return peakRate * (1 + a * ta) / Math.pow(1 + b * ta, 2);
      }
    default:
      return peakRate;
  }
}

function getDefaultParams(method: InfiltrationMethod): ScenarioParams {
  switch (method) {
    case "greenAmpt":
      return { name: "Green-Ampt", method: "greenAmpt", duration: 6, suctionHead: 11.01, conductivity: 0.43, initialDeficit: 0.30, rainfallRate: 2.0, rainfallDistribution: "constant" };
    case "modifiedGreenAmpt":
      return { name: "Modified G-A", method: "modifiedGreenAmpt", duration: 6, suctionHead: 11.01, conductivity: 0.43, initialDeficit: 0.30, saturatedContent: 0.453, fieldCapacity: 0.18, redistributionTime: 4.0, rainfallRate: 2.0, rainfallDistribution: "constant" };
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
  const [activeTab, setActiveTab] = useState<"calculator" | "docs">("calculator");
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

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

  const calculatedResults = useMemo(() => {
    return scenarios.map(params => calculateInfiltration(params));
  }, [scenarios]);

  const chartData = useMemo(() => {
    if (!comparisonMode) {
      return calculatedResults[activeScenarioIndex]?.data.filter((_, i) => i % 5 === 0) || [];
    }
    const maxLength = Math.max(...calculatedResults.map(r => r.data.length));
    const combined: any[] = [];
    for (let i = 0; i < maxLength; i += 5) {
      let time = i * 0.1;
      for (let idx = 0; idx < calculatedResults.length; idx++) {
        if (calculatedResults[idx]?.data[i]?.time !== undefined) {
          time = calculatedResults[idx].data[i].time;
          break;
        }
      }
      const point: any = { time };
      let maxRainfallIntensity = 0;
      scenarios.forEach((s, idx) => {
        const dataPoint = calculatedResults[idx]?.data[i];
        if (dataPoint) {
          point[`capacity_${idx}`] = dataPoint.infiltrationRate;
          point[`actual_${idx}`] = dataPoint.actualInfiltrationRate;
          if (dataPoint.rainfallIntensity !== undefined && dataPoint.rainfallIntensity > maxRainfallIntensity) {
            maxRainfallIntensity = dataPoint.rainfallIntensity;
          }
        }
      });
      point.rainfallIntensity = maxRainfallIntensity;
      combined.push(point);
    }
    return combined;
  }, [calculatedResults, comparisonMode, activeScenarioIndex, scenarios]);

  const copyToClipboard = () => {
    const headerParts = ["Time"];
    scenarios.forEach(s => {
      const scenarioHasRainfall = (s.method === "greenAmpt" || s.method === "modifiedGreenAmpt") && s.rainfallRate > 0;
      if (scenarioHasRainfall) {
        headerParts.push(`${s.name} Capacity`, `${s.name} Actual`);
      } else {
        headerParts.push(`${s.name} Rate`);
      }
    });
    scenarios.forEach(s => headerParts.push(`${s.name} Cumulative`));
    
    const maxLength = Math.max(...calculatedResults.map(r => r.data.length));
    const rows: string[] = [];
    for (let i = 0; i < maxLength; i++) {
      const rowParts: (number | string)[] = [];
      let timeValue = 0;
      for (let idx = 0; idx < scenarios.length; idx++) {
        if (calculatedResults[idx]?.data[i]?.time !== undefined) {
          timeValue = calculatedResults[idx].data[i].time;
          break;
        }
      }
      rowParts.push(timeValue);
      
      scenarios.forEach((s, idx) => {
        const scenarioHasRainfall = (s.method === "greenAmpt" || s.method === "modifiedGreenAmpt") && s.rainfallRate > 0;
        const dataPoint = calculatedResults[idx]?.data[i];
        const capacity = dataPoint ? (units === "imperial" 
          ? dataPoint.infiltrationRate
          : dataPoint.infiltrationRate * 25.4) : "";
        const actual = dataPoint ? (units === "imperial" 
          ? dataPoint.actualInfiltrationRate
          : dataPoint.actualInfiltrationRate * 25.4) : "";
        if (scenarioHasRainfall) {
          rowParts.push(capacity, actual);
        } else {
          rowParts.push(capacity);
        }
      });
      scenarios.forEach((_, idx) => {
        const dataPoint = calculatedResults[idx]?.data[i];
        const cumulative = dataPoint ? (units === "imperial"
          ? dataPoint.cumulativeInfiltration
          : dataPoint.cumulativeInfiltration * 25.4) : "";
        rowParts.push(cumulative);
      });
      rows.push(rowParts.join(","));
    }
    
    const csv = [headerParts.join(","), ...rows].join("\n");
    navigator.clipboard.writeText(csv);
    toast({ title: "Copied", description: "Data copied in CSV format." });
  };

  const handlePrint = () => {
    window.print();
  };

  const chartRef = useRef<HTMLDivElement>(null);
  
  const exportChartAsImage = () => {
    if (!chartRef.current) return;
    import('html2canvas').then(({ default: html2canvas }) => {
      html2canvas(chartRef.current!, { backgroundColor: '#ffffff' }).then((canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = `infiltration-chart-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast({ title: "Exported", description: "Chart saved as PNG image." });
      });
    }).catch(() => {
      toast({ title: "Error", description: "Could not export chart. Try using Print instead.", variant: "destructive" });
    });
  };

  const getValidationWarnings = (params: ScenarioParams): string[] => {
    const warnings: string[] = [];
    if (params.method === "greenAmpt" || params.method === "modifiedGreenAmpt") {
      if (params.initialDeficit > 0.5) warnings.push("Initial deficit > 0.5 is unusually high");
      if (params.conductivity > 10) warnings.push("Conductivity > 10 in/hr suggests very coarse sand or gravel");
      if (params.suctionHead > 40) warnings.push("Suction head > 40 in is unusually high for most soils");
    }
    if (params.method === "horton") {
      if (params.maxRate > 15) warnings.push("Max rate > 15 in/hr is unusually high");
      if (params.maxRate < params.minRate) warnings.push("Max rate should be greater than min rate");
    }
    if (params.method === "curveNumber") {
      if (params.curveNumber < 40) warnings.push("CN < 40 represents extremely permeable surfaces");
      if (params.curveNumber > 95) warnings.push("CN > 95 represents nearly impervious surfaces");
    }
    return warnings;
  };

  const generateSummaryStatement = (data: typeof currentData, params: ScenarioParams, result: InfiltrationResult | undefined): string => {
    if (!data.length) return "";
    const conversionFactor = units === "imperial" ? 1 : 25.4;
    const initial = (data[0]?.actualInfiltrationRate || 0) * conversionFactor;
    const final = (data[data.length - 1]?.actualInfiltrationRate || 0) * conversionFactor;
    const total = (data[data.length - 1]?.cumulativeInfiltration || 0) * conversionFactor;
    const unitLabel = units === "imperial" ? "inches" : "mm";
    const rateLabel = units === "imperial" ? "in/hr" : "mm/hr";
    
    let summary = `After ${params.duration} hours, approximately ${total.toFixed(2)} ${unitLabel} of water will infiltrate. The actual rate decreases from ${initial.toFixed(2)} to ${final.toFixed(2)} ${rateLabel}.`;
    
    if ((params.method === "greenAmpt" || params.method === "modifiedGreenAmpt") && params.rainfallRate > 0) {
      const rainfallDisplay = params.rainfallRate * conversionFactor;
      summary += ` Under ${rainfallDisplay.toFixed(2)} ${rateLabel} rainfall:`;
      
      if (result?.totalRunoff && result.totalRunoff > 0) {
        const runoff = result.totalRunoff * conversionFactor;
        summary += ` runoff = ${runoff.toFixed(2)} ${unitLabel}.`;
        if (result.timeToPonding !== undefined) {
          summary += ` Ponding begins at ${result.timeToPonding.toFixed(2)} hours.`;
        }
      } else {
        summary += ` all rainfall infiltrates (no runoff).`;
      }
    }
    return summary;
  };

  const ParameterTooltip = ({ helpKey }: { helpKey: keyof typeof parameterHelp }) => {
    const help = parameterHelp[helpKey];
    return (
      <TooltipProvider>
        <UITooltip>
          <TooltipTrigger asChild>
            <button type="button" className="ml-1 text-muted-foreground hover:text-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-medium text-sm">{help.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{help.description}</p>
            <div className="mt-2 text-xs">
              <span className="font-medium">Typical ranges:</span>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(help.ranges).map(([soil, range]) => (
                  <li key={soil} className="flex justify-between">
                    <span className="capitalize">{soil}:</span>
                    <span className="font-mono">{range} {help.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </UITooltip>
      </TooltipProvider>
    );
  };

  const current = scenarios[activeScenarioIndex];
  const currentResult = calculatedResults[activeScenarioIndex];
  const currentData = currentResult?.data || [];
  const hasRainfall = comparisonMode 
    ? scenarios.some(s => (s.method === "greenAmpt" || s.method === "modifiedGreenAmpt") && s.rainfallRate > 0)
    : (current.method === "greenAmpt" || current.method === "modifiedGreenAmpt") && current.rainfallRate > 0;

  const renderParameterInputs = () => {
    const params = scenarios[activeScenarioIndex];
    const lengthUnit = getUnitLabel("length", units);
    const rateUnit = getUnitLabel("rate", units);

    if (params.method === "greenAmpt" || params.method === "modifiedGreenAmpt") {
      return (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center">Suction Head (ψ) <ParameterTooltip helpKey="suctionHead" /></span>
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
              <span className="flex items-center">Conductivity (Ks) <ParameterTooltip helpKey="conductivity" /></span>
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
              <span className="flex items-center">Initial Deficit (θd) <ParameterTooltip helpKey="initialDeficit" /></span>
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
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center justify-between">
              <span>Rainfall Intensity</span>
              <span className="text-xs text-muted-foreground font-mono">{rateUnit}</span>
            </Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={params.rainfallRate}
              onChange={(e) => updateScenario(activeScenarioIndex, { rainfallRate: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="font-mono border-blue-200"
              data-testid="input-rainfall-rate"
            />
            <p className="text-xs text-muted-foreground">Set to 0 for potential infiltration only (no runoff calculation)</p>
          </div>
          {params.rainfallRate > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rainfall Distribution</Label>
              <Select
                value={params.rainfallDistribution || "constant"}
                onValueChange={(v) => updateScenario(activeScenarioIndex, { rainfallDistribution: v as RainfallDistribution })}
              >
                <SelectTrigger className="font-mono border-blue-200" data-testid="select-rainfall-distribution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="constant">Constant (uniform)</SelectItem>
                  <SelectItem value="triangular">Triangular (peak at center)</SelectItem>
                  <SelectItem value="frontLoaded">Front-loaded (peak early)</SelectItem>
                  <SelectItem value="backLoaded">Back-loaded (peak late)</SelectItem>
                  <SelectItem value="scsTypeI">SCS Type I (Pacific maritime)</SelectItem>
                  <SelectItem value="scsTypeIA">SCS Type IA (Pacific NW)</SelectItem>
                  <SelectItem value="scsTypeII">SCS Type II (most of US)</SelectItem>
                  <SelectItem value="scsTypeIII">SCS Type III (Gulf/Atlantic)</SelectItem>
                  <SelectItem value="huffQ1">Huff 1st Quartile (early peak)</SelectItem>
                  <SelectItem value="huffQ2">Huff 2nd Quartile</SelectItem>
                  <SelectItem value="huffQ3">Huff 3rd Quartile</SelectItem>
                  <SelectItem value="huffQ4">Huff 4th Quartile (late peak)</SelectItem>
                  <SelectItem value="chicago">Chicago Storm</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Distribution pattern of rainfall intensity over the storm duration</p>
            </div>
          )}
          {params.method === "modifiedGreenAmpt" && (
            <>
              <div className="pt-3 border-t border-green-100">
                <p className="text-xs font-medium text-green-700 mb-2">Redistribution Parameters</p>
                <p className="text-xs text-muted-foreground mb-3">Models moisture recovery between rainfall events. Accounts for drainage from saturated to field capacity over time.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center">Saturated Content (θs) <ParameterTooltip helpKey="saturatedContent" /></span>
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
                  <span className="flex items-center">Field Capacity (θfc) <ParameterTooltip helpKey="fieldCapacity" /></span>
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
              <span className="flex items-center">Maximum Rate (f₀) <ParameterTooltip helpKey="maxRate" /></span>
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
              <span className="flex items-center">Minimum Rate (fc) <ParameterTooltip helpKey="minRate" /></span>
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
              <span className="flex items-center">Decay Constant (k) <ParameterTooltip helpKey="decayConstant" /></span>
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
              <span className="flex items-center">Curve Number (CN) <ParameterTooltip helpKey="curveNumber" /></span>
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
              <div className="flex items-center border rounded-lg p-1 bg-gray-100">
                <button
                  onClick={() => setActiveTab("calculator")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "calculator" ? "bg-white shadow text-green-700" : "text-gray-600 hover:text-gray-900"
                  }`}
                  data-testid="tab-calculator"
                >
                  <Calculator className="w-4 h-4 inline mr-1.5" />
                  Calculator
                </button>
                <button
                  onClick={() => setActiveTab("docs")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "docs" ? "bg-white shadow text-green-700" : "text-gray-600 hover:text-gray-900"
                  }`}
                  data-testid="tab-docs"
                >
                  <BookOpen className="w-4 h-4 inline mr-1.5" />
                  Docs
                </button>
              </div>

              {activeTab === "calculator" && (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="units-toggle" className="text-sm text-gray-600">Units:</Label>
                    <Select value={units} onValueChange={(v) => setUnits(v as UnitSystem)}>
                      <SelectTrigger className="w-28" data-testid="units-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imperial">USA</SelectItem>
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
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Getting Started Wizard */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-white shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-3 rounded-full bg-green-100 w-fit mb-2">
                <Sparkles className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">Welcome to Infiltration Calculator</CardTitle>
              <CardDescription>Let's get you started with SWMM5 infiltration modeling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {wizardStep === 0 && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h3 className="font-medium text-green-800 mb-2">Choose an Infiltration Method</h3>
                    <p className="text-sm text-green-700">Start by selecting a method that matches your soil data and project requirements:</p>
                    <ul className="mt-2 space-y-1 text-sm text-green-700">
                      <li><strong>Green-Ampt:</strong> Best for detailed physical soil parameters</li>
                      <li><strong>Horton:</strong> Simple empirical approach with decay curve</li>
                      <li><strong>SCS Curve Number:</strong> Quick estimates based on land use</li>
                    </ul>
                  </div>
                </div>
              )}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-medium text-blue-800 mb-2">Set Your Parameters</h3>
                    <p className="text-sm text-blue-700">Use the soil type presets for quick setup, or enter custom values:</p>
                    <ul className="mt-2 space-y-1 text-sm text-blue-700">
                      <li><CheckCircle2 className="w-4 h-4 inline mr-1" />Hover over parameters for guidance</li>
                      <li><CheckCircle2 className="w-4 h-4 inline mr-1" />Add rainfall rate to calculate actual infiltration</li>
                      <li><CheckCircle2 className="w-4 h-4 inline mr-1" />Save presets for reuse</li>
                    </ul>
                  </div>
                </div>
              )}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h3 className="font-medium text-purple-800 mb-2">Analyze Results</h3>
                    <p className="text-sm text-purple-700">View infiltration curves and export data:</p>
                    <ul className="mt-2 space-y-1 text-sm text-purple-700">
                      <li><CheckCircle2 className="w-4 h-4 inline mr-1" />Compare multiple scenarios side-by-side</li>
                      <li><CheckCircle2 className="w-4 h-4 inline mr-1" />Copy data to clipboard for spreadsheets</li>
                      <li><CheckCircle2 className="w-4 h-4 inline mr-1" />Print reports for documentation</li>
                    </ul>
                  </div>
                </div>
              )}
              <div className="flex justify-between pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    localStorage.setItem("infiltration_wizard_completed", "true");
                    setShowWizard(false);
                  }}
                  data-testid="wizard-skip"
                >
                  Skip
                </Button>
                <div className="flex gap-2">
                  {wizardStep > 0 && (
                    <Button variant="outline" onClick={() => setWizardStep(s => s - 1)} data-testid="wizard-back">
                      Back
                    </Button>
                  )}
                  {wizardStep < 2 ? (
                    <Button onClick={() => setWizardStep(s => s + 1)} className="gap-1" data-testid="wizard-next">
                      Next <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        localStorage.setItem("infiltration_wizard_completed", "true");
                        setShowWizard(false);
                      }}
                      className="gap-1 bg-green-600 hover:bg-green-700"
                      data-testid="wizard-finish"
                    >
                      Get Started <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-center gap-1.5 pt-2">
                {[0, 1, 2].map(step => (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      step === wizardStep ? "bg-green-600" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === "docs" ? (
          <div className="max-w-4xl mx-auto space-y-6">
            <Card className="border-green-200/60 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-600" />
                  Documentation
                </CardTitle>
                <CardDescription>Learn how to use the SWMM5 Infiltration Calculator</CardDescription>
              </CardHeader>
              <CardContent className="prose prose-green max-w-none space-y-6">
                <section>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Overview</h3>
                  <p className="text-gray-700">
                    This calculator implements four infiltration methods from SWMM5 (Storm Water Management Model):
                    Green-Ampt, Modified Green-Ampt, Horton, and SCS Curve Number. Use it to estimate how water
                    infiltrates into soil during rainfall events.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Infiltration Methods</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="font-bold text-green-800">Green-Ampt Method</h4>
                      <p className="text-sm text-green-700 mt-1">
                        A physically-based method using Darcy's law. Requires suction head (ψ), hydraulic conductivity (K),
                        and initial moisture deficit (θ). Best when you have detailed soil data.
                      </p>
                      <pre className="text-sm bg-green-100 p-2 rounded mt-2 font-mono overflow-x-auto"><code>f = K × (1 + ψ×Δθ / F)

where:
  f  = infiltration rate (in/hr)
  K  = hydraulic conductivity (in/hr)
  ψ  = suction head (in)
  Δθ = moisture deficit (unitless)
  F  = cumulative infiltration (in)</code></pre>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-bold text-blue-800">Modified Green-Ampt</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Extends Green-Ampt with moisture redistribution during dry periods. Includes field capacity
                        and wilting point parameters for recovery modeling.
                      </p>
                      <pre className="text-sm bg-blue-100 p-2 rounded mt-2 font-mono overflow-x-auto"><code>Recovery: θ(t) = θ_wp + (θ_fc - θ_wp) × (1 - e^(-t/τ))

where:
  θ_fc = field capacity
  θ_wp = wilting point
  τ    = redistribution time constant</code></pre>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <h4 className="font-bold text-amber-800">Horton Method</h4>
                      <p className="text-sm text-amber-700 mt-1">
                        An empirical approach where infiltration decays exponentially from a maximum rate (f₀) to a
                        minimum rate (fc). Simple and widely used.
                      </p>
                      <pre className="text-sm bg-amber-100 p-2 rounded mt-2 font-mono overflow-x-auto"><code>f(t) = fc + (f₀ - fc) × e^(-k×t)

where:
  f(t) = infiltration rate at time t
  fc   = minimum (final) rate (in/hr)
  f₀   = maximum (initial) rate (in/hr)
  k    = decay constant (1/hr)</code></pre>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h4 className="font-bold text-purple-800">SCS Curve Number</h4>
                      <p className="text-sm text-purple-700 mt-1">
                        Uses a dimensionless curve number (CN) based on soil type and land use. Quick estimates
                        without detailed soil parameters. CN ranges from 30 (low runoff) to 98 (impervious).
                      </p>
                      <pre className="text-sm bg-purple-100 p-2 rounded mt-2 font-mono overflow-x-auto"><code>S = (1000 / CN) - 10
Ia = 0.2 × S
Q = (P - Ia)² / (P - Ia + S)  for P {">"} Ia

where:
  S  = potential maximum retention (in)
  Ia = initial abstraction (in)
  Q  = runoff depth (in)
  P  = rainfall depth (in)</code></pre>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Rainfall Distributions</h3>
                  <p className="text-gray-700 mb-2">When rainfall rate is set, you can choose how intensity varies over time:</p>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
                    <div>
                      <p className="font-bold text-gray-800 mb-1">Basic Patterns:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li><strong>Constant:</strong> Uniform intensity</li>
                        <li><strong>Triangular:</strong> Peak at center</li>
                        <li><strong>Front-loaded:</strong> Peak early</li>
                        <li><strong>Back-loaded:</strong> Peak late</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 mb-1">SCS Design Storms:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li><strong>Type I:</strong> Pacific maritime climate</li>
                        <li><strong>Type IA:</strong> Pacific Northwest</li>
                        <li><strong>Type II:</strong> Most of continental US</li>
                        <li><strong>Type III:</strong> Gulf/Atlantic coastal</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 mb-1">Huff Quartiles:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li><strong>1st Quartile:</strong> Peak in first 25%</li>
                        <li><strong>2nd Quartile:</strong> Peak 25-50%</li>
                        <li><strong>3rd Quartile:</strong> Peak 50-75%</li>
                        <li><strong>4th Quartile:</strong> Peak in last 25%</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 mb-1">Synthetic Storms:</p>
                      <ul className="space-y-1 list-disc list-inside">
                        <li><strong>Chicago:</strong> IDF-based design storm</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Using the Calculator</h3>
                  <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Select an infiltration method from the dropdown</li>
                    <li>Choose a soil type preset or enter custom parameters</li>
                    <li>Set the simulation duration and rainfall rate (optional)</li>
                    <li>View the infiltration curve and results</li>
                    <li>Enable "Compare" mode to analyze multiple scenarios</li>
                    <li>Save presets for future use</li>
                  </ol>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Tips</h3>
                  <ul className="space-y-1 text-sm text-gray-700 list-disc list-inside">
                    <li>Hover over parameter labels to see typical ranges and descriptions</li>
                    <li>Use the table view to see detailed timestep data</li>
                    <li>Copy data to clipboard for use in Excel or other tools</li>
                    <li>Print reports for project documentation</li>
                  </ul>
                </section>
              </CardContent>
            </Card>
            <div className="text-center">
              <Button onClick={() => setActiveTab("calculator")} className="gap-2" data-testid="btn-start-calculating">
                <Calculator className="w-4 h-4" />
                Start Calculating
              </Button>
            </div>
          </div>
        ) : (
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
                <div className="flex gap-2 no-print">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
                    onClick={exportChartAsImage}
                    data-testid="btn-export-chart"
                  >
                    <Image className="w-4 h-4" />
                    Export
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 text-green-700 border-green-200 hover:bg-green-50">
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
                            {scenarios.map((s, idx) => {
                              const scenarioHasRainfall = (s.method === "greenAmpt" || s.method === "modifiedGreenAmpt") && s.rainfallRate > 0;
                              return scenarioHasRainfall ? (
                                <Fragment key={idx}>
                                  <TableHead>{s.name} Capacity ({getUnitLabel("rate", units)})</TableHead>
                                  <TableHead>{s.name} Actual ({getUnitLabel("rate", units)})</TableHead>
                                </Fragment>
                              ) : (
                                <TableHead key={idx}>{s.name} Rate ({getUnitLabel("rate", units)})</TableHead>
                              );
                            })}
                            {scenarios.map((s, idx) => (
                              <TableHead key={`cum-${idx}`}>{s.name} Cumulative ({getUnitLabel("length", units)})</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(calculatedResults[0]?.data || []).map((_, i) => (
                            <TableRow key={i}>
                              <TableCell>{calculatedResults[0]?.data[i]?.time}</TableCell>
                              {scenarios.map((s, idx) => {
                                const scenarioHasRainfall = (s.method === "greenAmpt" || s.method === "modifiedGreenAmpt") && s.rainfallRate > 0;
                                const capacity = units === "imperial" 
                                  ? (calculatedResults[idx]?.data[i]?.infiltrationRate || 0).toFixed(4)
                                  : ((calculatedResults[idx]?.data[i]?.infiltrationRate || 0) * 25.4).toFixed(4);
                                const actual = units === "imperial" 
                                  ? (calculatedResults[idx]?.data[i]?.actualInfiltrationRate || 0).toFixed(4)
                                  : ((calculatedResults[idx]?.data[i]?.actualInfiltrationRate || 0) * 25.4).toFixed(4);
                                return scenarioHasRainfall ? (
                                  <Fragment key={idx}>
                                    <TableCell>{capacity}</TableCell>
                                    <TableCell>{actual}</TableCell>
                                  </Fragment>
                                ) : (
                                  <TableCell key={idx}>{capacity}</TableCell>
                                );
                              })}
                              {scenarios.map((_, idx) => (
                                <TableCell key={`cum-${idx}`}>
                                  {units === "imperial"
                                    ? (calculatedResults[idx]?.data[i]?.cumulativeInfiltration || 0).toFixed(4)
                                    : ((calculatedResults[idx]?.data[i]?.cumulativeInfiltration || 0) * 25.4).toFixed(4)
                                  }
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button onClick={() => copyToClipboard()} className="gap-2 bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4" />
                        Copy to CSV
                      </Button>
                    </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-80" ref={chartRef}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        label={{ value: `Time (${getUnitLabel("time", units)})`, position: 'insideBottom', offset: -5, fontSize: 12 }}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        domain={[0, 'auto']}
                        label={{ value: `Rate (${getUnitLabel("rate", units)})`, angle: -90, position: 'insideLeft', fontSize: 12 }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }} 
                        tickLine={false}
                        label={{ value: `Rainfall (${getUnitLabel("rate", units)})`, angle: 90, position: 'outsideRight', dx: 15, fontSize: 12 }}
                        domain={[0, (dataMax: number) => Math.max(dataMax * 4, 0.1)]}
                        reversed
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #d1fae5', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [
                          `${(units === "imperial" ? value : value * 25.4).toFixed(4)} ${getUnitLabel("rate", units)}`,
                          name
                        ]}
                      />
                      <Legend />
                      {hasRainfall && (
                        <Bar
                          yAxisId="right"
                          dataKey="rainfallIntensity"
                          name="Rainfall Intensity"
                          fill="#60a5fa"
                          opacity={0.6}
                          barSize={8}
                        />
                      )}
                      {comparisonMode ? (
                        scenarios.flatMap((s, idx) => {
                          const showBothLines = (s.method === "greenAmpt" || s.method === "modifiedGreenAmpt") && 
                            ('rainfallRate' in s) && s.rainfallRate > 0;
                          const lines = [
                            <Line 
                              key={`capacity_${idx}`}
                              yAxisId="left"
                              type="monotone" 
                              dataKey={`capacity_${idx}`}
                              name={showBothLines ? `${s.name} (Capacity)` : s.name}
                              stroke={methodColors[s.method]}
                              strokeWidth={2}
                              strokeDasharray={showBothLines ? "5 5" : undefined}
                              dot={false}
                            />
                          ];
                          if (showBothLines) {
                            lines.push(
                              <Line 
                                key={`actual_${idx}`}
                                yAxisId="left"
                                type="monotone" 
                                dataKey={`actual_${idx}`}
                                name={`${s.name} (Actual)`}
                                stroke={methodColors[s.method]}
                                strokeWidth={2}
                                dot={false}
                              />
                            );
                          }
                          return lines;
                        })
                      ) : (
                        <>
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="infiltrationRate"
                            name={hasRainfall ? "Capacity" : "Infiltration Rate"}
                            stroke={methodColors[current.method]}
                            strokeWidth={2}
                            strokeDasharray={hasRainfall ? "5 5" : undefined}
                            dot={false}
                          />
                          {hasRainfall && (
                            <Line 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="actualInfiltrationRate"
                              name="Actual Infiltration"
                              stroke={methodColors[current.method]}
                              strokeWidth={2}
                              dot={false}
                            />
                          )}
                        </>
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Mass Balance Table */}
            {hasRainfall && currentResult && (
              <Card className="border-blue-200/60 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TableIcon className="w-5 h-5 text-blue-600" />
                    Mass Balance
                  </CardTitle>
                  <CardDescription>Water balance for the simulation period</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">Component</TableHead>
                        <TableHead className="text-right font-semibold">Depth ({getUnitLabel("length", units)})</TableHead>
                        <TableHead className="text-right font-semibold">% of Rainfall</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const rainfallRate = 'rainfallRate' in current ? (current as any).rainfallRate : 0;
                        const totalRainfall = rainfallRate * current.duration;
                        const totalInfiltration = currentResult.totalInfiltration;
                        const totalRunoff = currentResult.totalRunoff;
                        const remainingAbstraction = Math.max(0, totalRainfall - totalInfiltration - totalRunoff);
                        
                        const convertDepth = (val: number) => units === "imperial" ? val : val * 25.4;
                        const pctOf = (val: number) => totalRainfall > 0 ? ((val / totalRainfall) * 100).toFixed(1) : "0.0";
                        
                        return (
                          <>
                            <TableRow className="bg-blue-50">
                              <TableCell className="font-medium text-blue-800">Total Rainfall (Input)</TableCell>
                              <TableCell className="text-right font-mono">{convertDepth(totalRainfall).toFixed(3)}</TableCell>
                              <TableCell className="text-right font-mono">100.0%</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium text-green-700">Infiltration</TableCell>
                              <TableCell className="text-right font-mono">{convertDepth(totalInfiltration).toFixed(3)}</TableCell>
                              <TableCell className="text-right font-mono">{pctOf(totalInfiltration)}%</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium text-red-700">Surface Runoff</TableCell>
                              <TableCell className="text-right font-mono">{convertDepth(totalRunoff).toFixed(3)}</TableCell>
                              <TableCell className="text-right font-mono">{pctOf(totalRunoff)}%</TableCell>
                            </TableRow>
                            {remainingAbstraction > 0.0001 && (
                              <TableRow>
                                <TableCell className="font-medium text-amber-700">Other Abstractions</TableCell>
                                <TableCell className="text-right font-mono">{convertDepth(remainingAbstraction).toFixed(3)}</TableCell>
                                <TableCell className="text-right font-mono">{pctOf(remainingAbstraction)}%</TableCell>
                              </TableRow>
                            )}
                            <TableRow className="border-t-2 border-gray-300 bg-gray-50">
                              <TableCell className="font-semibold">Balance Check</TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {convertDepth(totalInfiltration + totalRunoff + remainingAbstraction).toFixed(3)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold">
                                {pctOf(totalInfiltration + totalRunoff + remainingAbstraction)}%
                              </TableCell>
                            </TableRow>
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-3 gap-4">
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 cursor-help">
                      <p className="text-xs text-green-600 font-medium mb-1">
                        {((current.method === "greenAmpt" || current.method === "modifiedGreenAmpt") && current.rainfallRate > 0) ? "Actual Initial Rate" : "Initial Rate"}
                      </p>
                      <p className="text-xl font-mono font-semibold text-green-800" data-testid="result-initial-rate">
                        {currentData[0]?.actualInfiltrationRate 
                          ? (units === "imperial" ? currentData[0].actualInfiltrationRate : currentData[0].actualInfiltrationRate * 25.4).toFixed(3)
                          : '—'
                        } <span className="text-sm font-normal">{getUnitLabel("rate", units)}</span>
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>The infiltration rate at the start of the simulation when the soil is driest and can absorb water fastest.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 cursor-help">
                      <p className="text-xs text-emerald-600 font-medium mb-1">
                        {((current.method === "greenAmpt" || current.method === "modifiedGreenAmpt") && current.rainfallRate > 0) ? "Actual Final Rate" : "Final Rate"}
                      </p>
                      <p className="text-xl font-mono font-semibold text-emerald-800" data-testid="result-final-rate">
                        {currentData[currentData.length - 1]?.actualInfiltrationRate
                          ? (units === "imperial" ? currentData[currentData.length - 1].actualInfiltrationRate : currentData[currentData.length - 1].actualInfiltrationRate * 25.4).toFixed(3)
                          : '—'
                        } <span className="text-sm font-normal">{getUnitLabel("rate", units)}</span>
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>The infiltration rate at the end of the simulation. As soil becomes saturated, this rate approaches the hydraulic conductivity.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 cursor-help">
                      <p className="text-xs text-teal-600 font-medium mb-1">Total Infiltration</p>
                      <p className="text-xl font-mono font-semibold text-teal-800" data-testid="result-total">
                        {currentData[currentData.length - 1]?.cumulativeInfiltration
                          ? (units === "imperial" ? currentData[currentData.length - 1].cumulativeInfiltration : currentData[currentData.length - 1].cumulativeInfiltration * 25.4).toFixed(2)
                          : '—'
                        } <span className="text-sm font-normal">{getUnitLabel("length", units)}</span>
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>The total depth of water that has infiltrated into the soil over the entire simulation period.</p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>

            {(current.method === "greenAmpt" || current.method === "modifiedGreenAmpt") && current.rainfallRate > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 cursor-help">
                        <p className="text-xs text-blue-600 font-medium mb-1">Rainfall Rate</p>
                        <p className="text-xl font-mono font-semibold text-blue-800" data-testid="result-rainfall">
                          {units === "imperial" ? current.rainfallRate.toFixed(2) : (current.rainfallRate * 25.4).toFixed(2)} <span className="text-sm font-normal">{getUnitLabel("rate", units)}</span>
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>The constant rainfall intensity applied during the simulation.</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 cursor-help">
                        <p className="text-xs text-orange-600 font-medium mb-1">Time to Ponding</p>
                        <p className="text-xl font-mono font-semibold text-orange-800" data-testid="result-ponding">
                          {currentResult?.timeToPonding !== undefined 
                            ? `${currentResult.timeToPonding.toFixed(2)} hr`
                            : 'No ponding'
                          }
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>The time when rainfall intensity exceeds infiltration capacity and water begins pooling on the surface.</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200 cursor-help">
                        <p className="text-xs text-red-600 font-medium mb-1">Total Runoff</p>
                        <p className="text-xl font-mono font-semibold text-red-800" data-testid="result-runoff">
                          {(units === "imperial" ? currentResult?.totalRunoff : (currentResult?.totalRunoff || 0) * 25.4).toFixed(2)} <span className="text-sm font-normal">{getUnitLabel("length", units)}</span>
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>The total depth of water that runs off the surface when rainfall exceeds infiltration capacity.</p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              </div>
            )}

            {getValidationWarnings(current).length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Parameter Warnings
                </p>
                <ul className="text-xs text-amber-700 space-y-1">
                  {getValidationWarnings(current).map((warning, idx) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-800" data-testid="result-summary">
                {generateSummaryStatement(currentData, current, currentResult)}
              </p>
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
        )}
      </main>
    </div>
  );
}
