import React, { useState } from 'react';
import { 
  Play, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download, 
  ExternalLink,
  BarChart3,
  Shield,
  Search,
  Filter,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { useAssessmentEngine } from '../../../hooks/useAssessmentEngine';

export function AssessmentTabMockup() {
  const { runs, gaps, runAssessment } = useAssessmentEngine();
  const [isRunning, setIsRunning] = useState(false);

  const handleStartRun = async () => {
    setIsRunning(true);
    await runAssessment();
    setIsRunning(false);
  };

  const latestRun = runs[0] || { score: 0, assetsCount: 0, gapsCount: 0 };
  const currentGaps = gaps.filter(g => g.runId === latestRun.id);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Demo Mode Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-blue-700">
            <Shield size={20} />
            <div>
              <span className="font-bold text-sm">Demo Mode Active</span>
              <p className="text-xs opacity-80">Running V2 assessment engine entirely in-browser. No server required.</p>
            </div>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">
            GitHub Pages
          </div>
        </div>
        
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Governance Assessment (V2)</h2>
            <p className="text-slate-500 mt-1">Automated gap analysis and quality scoring</p>
          </div>
          <div className="flex gap-3">
            <button 
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium shadow-sm"
            >
              <History size={16} />
              History
            </button>
            <button 
              onClick={handleStartRun}
              disabled={isRunning}
              className={`px-4 py-2 ${isRunning ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-all`}
            >
              {isRunning ? (
                <>
                  <Clock size={16} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Assessment
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            title="Latest Score" 
            value={`${latestRun.score}%`} 
            trend={runs.length > 1 ? `${latestRun.score - runs[1].score}%` : undefined} 
            trendUp={runs.length > 1 ? latestRun.score >= runs[1].score : true}
            icon={<Shield className="text-blue-600" size={20} />}
          />
          <StatCard 
            title="Assets Scanned" 
            value={latestRun.assetsCount.toString()} 
            icon={<Search className="text-slate-600" size={20} />}
          />
          <StatCard 
            title="Open Gaps" 
            value={latestRun.gapsCount.toString()} 
            trend={runs.length > 1 ? `${latestRun.gapsCount - runs[1].gapsCount}` : undefined} 
            trendUp={runs.length > 1 ? latestRun.gapsCount <= runs[1].gapsCount : true}
            icon={<AlertTriangle className="text-amber-500" size={20} />}
          />
          <StatCard 
            title="Compliance" 
            value={latestRun.score > 80 ? "High" : latestRun.score > 50 ? "Medium" : "Low"} 
            icon={<CheckCircle2 className="text-emerald-500" size={20} />}
          />
        </div>

        {!runs.length && (
          <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
            No assessments yet. Run an assessment to generate gaps and remediation insights.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Gap Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Identified Gaps</h3>
                <div className="flex gap-2">
                  <button className="p-1.5 hover:bg-slate-50 rounded text-slate-400">
                    <Filter size={16} />
                  </button>
                  <button className="p-1.5 hover:bg-slate-50 rounded text-slate-400">
                    <Download size={16} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {currentGaps.length > 0 ? currentGaps.map((gap) => (
                  <div key={gap.id} className="px-6 py-4 hover:bg-slate-50 transition-colors group cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${
                          gap.severity === 'high' ? 'bg-red-500' : 
                          gap.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <div className="font-semibold text-slate-900">{gap.field}</div>
                          <div className="text-xs text-slate-500">{gap.impact}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-medium text-slate-900">{gap.assets} assets</div>
                          <div className="text-xs text-slate-400">Affected</div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-400" />
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="px-6 py-12 text-center text-slate-500">
                    No gaps identified in the latest run.
                  </div>
                )}
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                <button className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  View all gaps <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Remediation Plan Preview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-900">Remediation Roadmap</h3>
                <button className="text-sm text-blue-600 font-medium">Edit Plan</button>
              </div>
              <div className="space-y-4">
                <RoadmapStep 
                  title="Phase 1: Critical Metadata" 
                  description="Populate Business Description and Owners for Tier 1 assets."
                  status="in-progress"
                  progress={65}
                />
                <RoadmapStep 
                  title="Phase 2: Classification" 
                  description="Apply PII and Sensitivity tags based on automated suggestions."
                  status="pending"
                  progress={0}
                />
              </div>
            </div>
          </div>

          {/* Right Column: History & Artifacts */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4">Recent Runs</h3>
              <div className="space-y-4">
                {MOCK_RUNS.map((run) => (
                  <div key={run.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                        <FileText size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {new Date(run.timestamp).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-500">Score: {run.score}%</div>
                      </div>
                    </div>
                    <button className="p-1 text-slate-300 hover:text-slate-600">
                      <ExternalLink size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
              <h3 className="font-bold mb-2">Export Artifacts</h3>
              <p className="text-blue-100 text-sm mb-4">Generate reports and tickets for your team.</p>
              <div className="space-y-2">
                <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <Download size={16} />
                  Download CSV Report
                </button>
                <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <ExternalLink size={16} />
                  Create JIRA Tickets
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon }: { title: string, value: string, trend?: string, trendUp?: boolean, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">{title}</div>
    </div>
  );
}

function RoadmapStep({ title, description, status, progress }: { title: string, description: string, status: 'completed' | 'in-progress' | 'pending', progress: number }) {
  return (
    <div className="p-4 border border-slate-100 rounded-lg hover:border-blue-200 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
          status === 'in-progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
        }`}>
          {status.toUpperCase()}
        </div>
      </div>
      <p className="text-sm text-slate-500 mb-3">{description}</p>
      {status === 'in-progress' && (
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
