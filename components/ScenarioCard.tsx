
import React from 'react';
import { Scenario } from '../types';

interface ScenarioCardProps {
  scenario: Scenario;
  onClick: (scenario: Scenario) => void;
  onDelete?: (id: string) => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, onClick, onDelete }) => {
  return (
    <div className="group relative flex flex-col items-start p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-brand-300 transition-all duration-300 w-full text-left overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 ${scenario.color} group-hover:scale-150 transition-transform duration-500`}></div>
      
      {/* Delete Button for Custom Scenarios */}
      {scenario.isCustom && onDelete && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(scenario.id);
          }}
          className="absolute top-4 right-4 text-slate-300 hover:text-red-500 z-20 transition-colors"
          title="Delete Custom Scenario"
        >
          <i className="fa-solid fa-trash-can"></i>
        </button>
      )}

      <button onClick={() => onClick(scenario)} className="w-full text-left flex-1 flex flex-col items-start">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${scenario.color} text-white mb-4 shadow-sm`}>
          <i className={`fa-solid ${scenario.icon} text-lg`}></i>
        </div>
        
        <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          {scenario.title}
          {scenario.isCustom && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 uppercase font-bold tracking-wide">Custom</span>}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">{scenario.description}</p>
        
        <div className="mt-4 flex items-center text-xs font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Start Session</span>
          <i className="fa-solid fa-arrow-right ml-2"></i>
        </div>
      </button>
    </div>
  );
};

export default ScenarioCard;
