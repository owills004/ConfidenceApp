
import React from 'react';
import { SessionHistoryItem, SessionSettings } from '../types';

interface SessionHistoryListProps {
  history: SessionHistoryItem[];
  onResume: (item: SessionHistoryItem) => void;
  onViewDetails: (item: SessionHistoryItem) => void;
  onClose: () => void;
}

const SessionHistoryList: React.FC<SessionHistoryListProps> = ({ history, onResume, onViewDetails, onClose }) => {
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button 
            onClick={onClose}
            className="mb-2 text-sm font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Session History</h2>
          <p className="text-slate-500">Review and resume your past conversations.</p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedHistory.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <i className="fa-solid fa-clock-rotate-left text-2xl"></i>
            </div>
            <h3 className="text-lg font-bold text-slate-700">No History Yet</h3>
            <p className="text-slate-500">Complete a session to see it here.</p>
          </div>
        ) : (
          sortedHistory.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center gap-4 relative overflow-hidden">
              {item.status === 'saved' && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm z-10">
                      SAVED
                  </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-900">{item.scenarioTitle}</h3>
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {item.settings.difficulty}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <i className="fa-regular fa-calendar"></i>
                    {formatDate(item.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className="fa-regular fa-clock"></i>
                    {Math.floor(item.report.durationSeconds / 60)}m {item.report.durationSeconds % 60}s
                  </span>
                  {item.status !== 'saved' && (
                     <span className={`flex items-center gap-1 ${item.report.fillerWordCount > 5 ? 'text-orange-500' : 'text-green-600'}`}>
                        <i className="fa-solid fa-microphone-lines"></i>
                        {item.report.fillerWordCount} Fillers
                     </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 sm:w-auto w-full">
                <button 
                    onClick={() => onViewDetails(item)}
                    className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-2"
                >
                    <i className="fa-solid fa-file-lines"></i>
                    Transcript
                </button>
                <button 
                  onClick={() => onResume(item)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                      item.status === 'saved' 
                      ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' 
                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                  }`}
                >
                  <i className="fa-solid fa-play"></i>
                  Resume
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionHistoryList;
