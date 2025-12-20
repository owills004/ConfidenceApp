
import React, { useMemo } from 'react';
import { SessionHistoryItem } from '../types';

interface AnalyticsDashboardProps {
  history: SessionHistoryItem[];
  onBack: () => void;
}

// --- Helper Components ---

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ 
  title, subtitle, children, className = '' 
}) => (
  <div className={`bg-white p-6 rounded-2xl border border-slate-200 shadow-sm ${className}`}>
    <div className="mb-6">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const KPICard: React.FC<{ title: string; value: string | number; unit?: string; icon: string; color: string; trend?: string }> = ({
  title, value, unit, icon, color, trend
}) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`w-12 h-12 rounded-xl ${color} text-white flex items-center justify-center text-xl shadow-sm shrink-0`}>
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
      <div className="flex items-baseline gap-1">
        <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
        {unit && <span className="text-sm text-slate-400 font-medium">{unit}</span>}
      </div>
      {trend && <p className="text-xs font-medium text-green-600 mt-0.5"><i className="fa-solid fa-arrow-trend-up mr-1"></i>{trend}</p>}
    </div>
  </div>
);

// --- Chart Components ---

const LineChart: React.FC<{ data: number[]; labels: string[]; color: string; areaColor?: string }> = ({ 
  data, labels, color, areaColor 
}) => {
  if (data.length < 2) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <i className="fa-solid fa-chart-line text-2xl mb-2 opacity-50"></i>
        <span>Complete more sessions to see trends</span>
      </div>
    );
  }

  const height = 200;
  const width = 500;
  const padding = 20;

  const max = Math.max(...data, 1);
  const min = 0; // Fixed baseline at 0 for better context
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  // For area fill
  const areaPoints = `
    ${padding},${height - padding} 
    ${points} 
    ${width - padding},${height - padding}
  `;

  return (
    <div className="w-full h-64 relative select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
           <line 
             key={tick}
             x1={padding} 
             y1={height - padding - (tick * (height - 2 * padding))} 
             x2={width - padding} 
             y2={height - padding - (tick * (height - 2 * padding))} 
             stroke="#e2e8f0" 
             strokeWidth="1"
             strokeDasharray="4 4"
           />
        ))}

        {/* Area Fill */}
        {areaColor && (
          <polygon points={areaPoints} fill={areaColor} opacity="0.4" />
        )}

        {/* Line */}
        <polyline 
          points={points} 
          fill="none" 
          stroke={color} 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* Dots */}
        {data.map((val, i) => {
           const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
           const y = height - padding - ((val - min) / range) * (height - 2 * padding);
           return (
             <g key={i} className="group">
               <circle cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2" className="transition-all group-hover:r-6 cursor-pointer" />
               
               {/* Tooltip */}
               <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <rect x={x - 25} y={y - 40} width="50" height="24" rx="6" fill="#1e293b" />
                  <text x={x} y={y - 24} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{val.toFixed(1)}</text>
                  <path d={`M ${x-5} ${y-17} L ${x} ${y-12} L ${x+5} ${y-17}`} fill="#1e293b" />
               </g>
             </g>
           );
        })}
      </svg>
      {/* X Labels */}
      <div className="flex justify-between px-2 mt-2 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
        <span>{labels[0]}</span>
        <span>{labels[Math.floor(labels.length / 2)]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
};

// --- Main Dashboard Component ---

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ history, onBack }) => {
  
  // Data Processing
  const analyticsData = useMemo(() => {
    // Sort by date ascending
    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Take last 10 sessions for trend charts
    const recent = sorted.slice(-10);

    // KPI Calcs
    const totalSessions = sorted.length;
    const totalDurationMin = sorted.reduce((acc, curr) => acc + curr.durationSeconds, 0) / 60;
    
    // Avg Fillers
    const avgFillers = totalSessions > 0 
      ? sorted.reduce((acc, curr) => acc + curr.report.fillerWordsPerMinute, 0) / totalSessions 
      : 0;
    
    // Confidence Rate
    const confidentSessions = sorted.filter(s => 
      s.report.dominantEmotion === 'Confident' || s.report.dominantEmotion === 'Excited'
    ).length;
    const confidenceRate = totalSessions > 0 ? (confidentSessions / totalSessions) * 100 : 0;

    // "Vocabulary/Complexity" Proxy
    // Difficulty Multiplier * Duration
    const difficultyMap: Record<string, number> = { 'beginner': 1, 'intermediate': 1.5, 'advanced': 2.2 };
    let cumVocabScore = 0;
    const vocabTrend = recent.map(s => {
       const score = (s.durationSeconds / 60) * (difficultyMap[s.settings.difficulty] || 1);
       cumVocabScore += score;
       return parseFloat(cumVocabScore.toFixed(1));
    });

    // Filler Trend Data
    const fillerTrend = recent.map(s => parseFloat(s.report.fillerWordsPerMinute.toFixed(1)));
    
    // Confidence Score Trend (Moving Average-ish or raw)
    const emoScoreMap: Record<string, number> = {
        'Confident': 100, 'Excited': 90, 'Neutral': 60, 'Hesitant': 40, 'Nervous': 20, 'Frustrated': 10
    };
    const confidenceTrend = recent.map(s => emoScoreMap[s.report.dominantEmotion || 'Neutral'] || 50);

    // Labels
    const labels = recent.map(s => new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

    return {
       totalSessions,
       totalHours: (totalDurationMin / 60).toFixed(1),
       avgFillers: avgFillers.toFixed(1),
       confidenceRate: Math.round(confidenceRate),
       fillerTrend,
       confidenceTrend,
       vocabTrend,
       labels,
       recentCount: recent.length
    };
  }, [history]);

  if (history.length === 0) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
           <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
              <i className="fa-solid fa-chart-pie text-4xl"></i>
           </div>
           <h2 className="text-xl font-bold text-slate-900 mb-2">No Analytics Available</h2>
           <p className="text-slate-500 mb-8">Complete a few sessions to generate insights.</p>
           <button onClick={onBack} className="text-brand-600 font-bold hover:underline">Return to Dashboard</button>
        </div>
     );
  }

  return (
    <div className="animate-fade-in pb-12">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <button 
            onClick={onBack}
            className="mb-2 text-sm font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Dashboard
          </button>
          <h2 className="text-3xl font-bold text-slate-900">Performance Analytics</h2>
          <p className="text-slate-500">Deep dive into your fluency, confidence, and growth metrics.</p>
        </div>
        <div className="hidden sm:block text-right">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Data Source</div>
             <div className="text-sm font-bold text-slate-700">{analyticsData.totalSessions} Sessions Analyzed</div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard 
            title="Total Practice" 
            value={analyticsData.totalHours} 
            unit="Hrs" 
            icon="fa-hourglass-half" 
            color="bg-blue-500" 
          />
          <KPICard 
            title="Avg Fillers/Min" 
            value={analyticsData.avgFillers} 
            icon="fa-microphone-lines" 
            color="bg-orange-500" 
            trend={parseFloat(analyticsData.avgFillers) < 3 ? "Improving" : undefined} 
          />
          <KPICard 
            title="Confidence Rate" 
            value={`${analyticsData.confidenceRate}%`} 
            icon="fa-bolt" 
            color="bg-yellow-500" 
          />
          <KPICard 
            title="Vocab Growth" 
            value={analyticsData.vocabTrend[analyticsData.vocabTrend.length-1] || 0} 
            unit="Pts" 
            icon="fa-book-open" 
            color="bg-purple-500" 
            trend="Steady" 
          />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Fluency Trends" subtitle="Filler words per minute (Lower is better)">
              <LineChart 
                data={analyticsData.fillerTrend} 
                labels={analyticsData.labels} 
                color="#f97316" 
                areaColor="#ffedd5" 
              />
          </ChartCard>

          <ChartCard title="Confidence Arc" subtitle="Emotional sentiment score (0-100)">
              <LineChart 
                data={analyticsData.confidenceTrend} 
                labels={analyticsData.labels} 
                color="#eab308" 
                areaColor="#fefce8" 
              />
          </ChartCard>

          <ChartCard title="Vocabulary & Complexity" subtitle="Cumulative complexity score based on session difficulty">
              <LineChart 
                data={analyticsData.vocabTrend} 
                labels={analyticsData.labels} 
                color="#8b5cf6" 
                areaColor="#f3e8ff" 
              />
          </ChartCard>
          
          {/* Insights Panel */}
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-8 text-white shadow-lg flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
                  </div>
                  <h3 className="font-bold text-xl">AI Insights</h3>
              </div>
              <div className="space-y-4">
                  <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                    <p className="text-brand-50 text-sm leading-relaxed">
                        {parseFloat(analyticsData.avgFillers) < 3 
                          ? "Your fluency is outstanding! You're consistently minimizing filler words like 'um' and 'uh'." 
                          : "Focus on pausing silently instead of using fillers. Your trend shows slight fluctuation."}
                    </p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
                    <p className="text-brand-50 text-sm leading-relaxed">
                        {analyticsData.confidenceRate > 60 
                          ? "You are projecting confidence in the majority of your sessions. Try 'Advanced' difficulty to test your limits."
                          : "Your confidence metrics vary. Try the 'Social Confidence' scenario to practice maintaining an assertive tone."}
                    </p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
