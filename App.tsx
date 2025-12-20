
import React, { useState, useEffect, useRef } from 'react';
import { SCENARIOS, DEFAULT_USER_STATS, DEFAULT_AVATAR_CONFIG, LEVEL_THRESHOLDS, getLanguageSystemInstruction, AVATAR_OPTIONS, DEFAULT_SESSION_SETTINGS, RESOURCES as FALLBACK_RESOURCES } from './constants';
import { Scenario, UserStats, AvatarConfig, LanguageConfig, User, Friend, SessionReport, SessionSettings, SessionHistoryItem, Resource } from './types';
import ScenarioCard from './components/ScenarioCard';
import ActiveSession from './components/ActiveSession';
import AvatarEditor from './components/AvatarEditor';
import Avatar from './components/Avatar';
import AuthScreen from './components/AuthScreen';
import FriendsPanel from './components/FriendsPanel';
import SessionSummary from './components/SessionSummary';
import ScenarioBuilder from './components/ScenarioBuilder';
import SessionSetup from './components/SessionSetup';
import SessionHistoryList from './components/SessionHistoryList';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { fetchDailyRecommendations, generateResourceContent } from './services/resourceGenerator';
import ReactMarkdown from 'react-markdown'; 

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  
  // Navigation State
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [pendingScenario, setPendingScenario] = useState<Scenario | null>(null); 
  
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [isBuildingScenario, setIsBuildingScenario] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<SessionHistoryItem | null>(null);

  const [customScenarios, setCustomScenarios] = useState<Scenario[]>([]);
  
  // Persist state in local storage simulation
  const [userStats, setUserStats] = useState<UserStats>(DEFAULT_USER_STATS);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [lastSessionReport, setLastSessionReport] = useState<SessionReport | null>(null);
  const [lastSessionAudio, setLastSessionAudio] = useState<Blob | null>(null);
  const [lastSessionSuggestions, setLastSessionSuggestions] = useState<Scenario[]>([]);
  const [earnedXP, setEarnedXP] = useState(0);
  
  const [currentSessionSettings, setCurrentSessionSettings] = useState<SessionSettings>(DEFAULT_SESSION_SETTINGS);
  const [initialTranscript, setInitialTranscript] = useState<any[] | undefined>(undefined);

  // Resource State
  const [dailyResources, setDailyResources] = useState<Resource[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('fluentflow_user');
    const savedAvatar = localStorage.getItem('fluentflow_avatar');
    const savedScenarios = localStorage.getItem('fluentflow_custom_scenarios');

    if (savedUser) {
        try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            if (parsedUser.stats) {
                setUserStats(parsedUser.stats);
            }
        } catch (e) {
            console.error("Failed to parse user", e);
        }
    }
    if (savedAvatar) setAvatarConfig(JSON.parse(savedAvatar));
    if (savedScenarios) setCustomScenarios(JSON.parse(savedScenarios));
  }, []);

  // Daily Resource Logic
  useEffect(() => {
    if (!user) return;

    const today = new Date().toDateString();
    const cacheKey = `fluentflow_resources_${user.id}_${today}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
        setDailyResources(JSON.parse(cached));
    } else {
        // Generate new resources
        const initResources = async () => {
            setIsLoadingResources(true);
            try {
                const newResources = await fetchDailyRecommendations(userStats, user.history || [], process.env.API_KEY || '');
                if (newResources.length > 0) {
                    setDailyResources(newResources);
                    localStorage.setItem(cacheKey, JSON.stringify(newResources));
                } else {
                    setDailyResources(FALLBACK_RESOURCES);
                }
            } catch (e) {
                console.error("Failed to fetch resources", e);
                setDailyResources(FALLBACK_RESOURCES);
            } finally {
                setIsLoadingResources(false);
            }
        };
        initResources();
    }
  }, [user?.id, userStats.level]); // Re-run if user changes

  useEffect(() => {
    if (user) {
        const updatedUser = { ...user, stats: userStats };
        localStorage.setItem('fluentflow_user', JSON.stringify(updatedUser));

        try {
            const dbStr = localStorage.getItem('fluentflow_users_db');
            if (dbStr) {
                const db = JSON.parse(dbStr);
                const userIndex = db.findIndex((u: any) => u.id === user.id);
                if (userIndex >= 0) {
                    db[userIndex] = { ...db[userIndex], ...updatedUser };
                    localStorage.setItem('fluentflow_users_db', JSON.stringify(db));
                }
            }
        } catch (e) {
            console.error("Failed to sync user to DB", e);
        }
    }
  }, [user, userStats]);

  useEffect(() => {
    localStorage.setItem('fluentflow_avatar', JSON.stringify(avatarConfig));
  }, [avatarConfig]);

  useEffect(() => {
    localStorage.setItem('fluentflow_custom_scenarios', JSON.stringify(customScenarios));
  }, [customScenarios]);

  // Calculate Level Progress
  const currentLevelBaseXP = LEVEL_THRESHOLDS[userStats.level - 1] || 0;
  const nextLevelXP = LEVEL_THRESHOLDS[userStats.level] || 10000;
  const progressPercent = Math.min(100, Math.max(0, ((userStats.xp - currentLevelBaseXP) / (nextLevelXP - currentLevelBaseXP)) * 100));

  const handleAuthComplete = (newUser: User) => {
    setUser(newUser);
    if (newUser.stats) {
        setUserStats(newUser.stats);
    } else {
        setUserStats(DEFAULT_USER_STATS);
    }
  };

  const handleAddFriend = (name: string) => {
    if (!user) return;
    
    const randomSkin = AVATAR_OPTIONS.skinColors[Math.floor(Math.random() * AVATAR_OPTIONS.skinColors.length)];
    const randomHair = AVATAR_OPTIONS.hairColors[Math.floor(Math.random() * AVATAR_OPTIONS.hairColors.length)];
    const level = Math.floor(Math.random() * 5) + 1;

    const newFriend: Friend = {
        id: Date.now().toString(),
        name: name,
        level: level,
        xp: level * 500, 
        isOnline: Math.random() > 0.5,
        lastActive: 'Today',
        avatarConfig: {
            ...DEFAULT_AVATAR_CONFIG,
            skinColor: randomSkin,
            hairColor: randomHair
        }
    };

    const updatedUser = {
        ...user,
        friends: [...user.friends, newFriend]
    };
    setUser(updatedUser);
  };

  const handleScenarioClick = (scenario: Scenario) => {
      setPendingScenario(scenario);
  };

  const handleStartSession = (settings: SessionSettings) => {
      if (pendingScenario) {
          setCurrentSessionSettings(settings);
          setInitialTranscript(undefined); 
          setActiveScenario(pendingScenario);
          setPendingScenario(null);
      }
  };

  const handleQuickStart = () => {
    const debateScenario = SCENARIOS.find(s => s.id === 'debate');
    if (debateScenario) {
        setCurrentSessionSettings({
            ...DEFAULT_SESSION_SETTINGS,
            difficulty: 'beginner',
            language: 'English'
        });
        setInitialTranscript(undefined);
        setActiveScenario(debateScenario);
    }
  };

  const handleResumeSession = (historyItem: SessionHistoryItem) => {
      let scenario = [...SCENARIOS, ...customScenarios].find(s => s.id === historyItem.scenarioId);
      
      if (!scenario && historyItem.scenarioId.startsWith('language_')) {
         const langId = historyItem.scenarioId.split('_')[1];
         // Fallback logic for old language sessions
         scenario = {
             id: historyItem.scenarioId,
             title: historyItem.scenarioTitle,
             description: 'Resumed Language Session',
             icon: 'fa-language',
             color: 'bg-indigo-600',
             voiceName: 'Puck',
             systemInstruction: getLanguageSystemInstruction(historyItem.scenarioTitle.replace(' Tutor', ''))
         }
      }

      if (scenario) {
          setCurrentSessionSettings(historyItem.settings);
          setInitialTranscript(historyItem.report.transcript);
          setActiveScenario(scenario);
          setShowHistory(false);
      }
  };

  const handleViewHistoryDetails = (historyItem: SessionHistoryItem) => {
    setViewingHistoryItem(historyItem);
  };

  const handleSaveCustomScenario = (scenario: Scenario) => {
    setCustomScenarios(prev => [...prev, scenario]);
    setIsBuildingScenario(false);
  };

  const handleDeleteCustomScenario = (id: string) => {
    if (window.confirm("Are you sure you want to delete this custom scenario?")) {
        setCustomScenarios(prev => prev.filter(s => s.id !== id));
    }
  };

  const calculateSuggestions = (completedScenario: Scenario) => {
    const all = [...SCENARIOS, ...customScenarios];
    const categorySuggestions: Record<string, string[]> = {
        'Professional': ['debate', 'social'],
        'Social': ['interview', 'debate'],
        'Fluency': ['interview', 'social'],
        'Learning': ['social', 'debate']
    };

    const recommendedIds = categorySuggestions[completedScenario.category || 'Professional'] || ['social', 'debate'];
    
    // Filter out the one just completed and find matches
    let suggestions = all.filter(s => s.id !== completedScenario.id && recommendedIds.includes(s.id));
    
    // If we need more, add some custom scenarios or random ones
    if (suggestions.length < 2) {
        const others = all.filter(s => s.id !== completedScenario.id && !suggestions.find(su => su.id === s.id));
        suggestions = [...suggestions, ...others.slice(0, 2 - suggestions.length)];
    }

    return suggestions.slice(0, 3);
  };

  const handleSessionEnd = (report: SessionReport, isSaved: boolean = false, audioBlob?: Blob) => {
    const endedScenario = activeScenario!;
    const settingsUsed = currentSessionSettings;
    
    // Calculate suggestions before clearing active scenario
    const suggestions = calculateSuggestions(endedScenario);
    setLastSessionSuggestions(suggestions);

    setActiveScenario(null);
    setInitialTranscript(undefined);
    
    // Only award XP if completed
    let xp = 0;
    if (!isSaved) {
        xp = Math.floor((report.durationSeconds / 60) * 10) + 50;
        if (report.dominantEmotion === 'Confident' || report.dominantEmotion === 'Excited') {
            xp += 20; 
        }
        setEarnedXP(xp);
        setLastSessionReport(report); // Shows modal
        if (audioBlob) setLastSessionAudio(audioBlob);
    }

    if (!user) return;

    const historyItem: SessionHistoryItem = {
        id: Date.now().toString(),
        scenarioId: endedScenario.id,
        scenarioTitle: endedScenario.title,
        date: new Date().toISOString(),
        durationSeconds: report.durationSeconds,
        settings: settingsUsed,
        report: report,
        status: isSaved ? 'saved' : 'completed'
    };

    const newHistory = [historyItem, ...(user.history || [])];

    const today = new Date().toDateString();
    const lastDate = userStats.lastSessionDate ? new Date(userStats.lastSessionDate).toDateString() : null;
    let newStreak = userStats.streak;
    
    // Update streak only if session completed
    if (!isSaved && lastDate !== today) {
        if (lastDate) {
            const diffTime = Math.abs(new Date(today).getTime() - new Date(lastDate).getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays === 1) newStreak++;
            else if (diffDays > 1) newStreak = 1;
        } else {
            newStreak = 1;
        }
    }

    updateXP(xp, newStreak, newHistory);
  };

  const updateXP = (amount: number, newStreak?: number, newHistory?: SessionHistoryItem[]) => {
      const newTotalXP = userStats.xp + amount;
      let newLevel = userStats.level;
      while (newLevel < LEVEL_THRESHOLDS.length && newTotalXP >= LEVEL_THRESHOLDS[newLevel]) {
          newLevel++;
      }
      
      setUserStats(prev => ({
          ...prev,
          xp: newTotalXP,
          level: newLevel,
          streak: newStreak !== undefined ? newStreak : prev.streak,
          sessionsCompleted: newHistory ? prev.sessionsCompleted + 1 : prev.sessionsCompleted,
          lastSessionDate: newHistory ? new Date().toISOString() : prev.lastSessionDate
      }));

      if (newHistory && user) {
          setUser({ ...user, history: newHistory });
      }
  };

  const handleResourceClick = async (resource: Resource) => {
      setActiveResource(resource);
      
      // If content not generated yet, generate it
      if (!resource.content) {
          setIsGeneratingContent(true);
          try {
              const content = await generateResourceContent(resource, process.env.API_KEY || '');
              
              // Update local state and storage with generated content to cache it
              const updatedResource = { ...resource, content };
              setActiveResource(updatedResource);
              
              const updatedDaily = dailyResources.map(r => r.id === resource.id ? updatedResource : r);
              setDailyResources(updatedDaily);
              
              // Update cache
              const today = new Date().toDateString();
              const cacheKey = `fluentflow_resources_${user!.id}_${today}`;
              localStorage.setItem(cacheKey, JSON.stringify(updatedDaily));

          } catch (e) {
              console.error("Content generation failed", e);
          } finally {
              setIsGeneratingContent(false);
          }
      }
  };

  const handleResourceComplete = () => {
     if (!activeResource) return;
     updateXP(activeResource.xp);
     setActiveResource(null);
  };

  const resetViews = () => {
    setActiveScenario(null);
    setPendingScenario(null);
    setIsEditingAvatar(false);
    setIsBuildingScenario(false);
    setShowHistory(false);
    setShowAnalytics(false);
    setActiveResource(null);
    setViewingHistoryItem(null);
    setLastSessionAudio(null);
    setLastSessionReport(null);
    setLastSessionSuggestions([]);
  };

  const handleLogout = () => {
      localStorage.removeItem('fluentflow_user');
      localStorage.removeItem('fluentflow_avatar');
      setUser(null);
      setUserStats(DEFAULT_USER_STATS); 
      setAvatarConfig(DEFAULT_AVATAR_CONFIG);
  };

  // Generate Weekly Analytics Data
  const weeklyData = React.useMemo(() => {
      if (!user?.history) return [];
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d;
      });

      return last7Days.map(day => {
          const dayStr = day.toDateString();
          const sessions = user.history.filter(h => new Date(h.date).toDateString() === dayStr);
          const totalMinutes = sessions.reduce((acc, curr) => acc + (curr.durationSeconds / 60), 0);
          return { day: days[day.getDay()], value: totalMinutes };
      });
  }, [user?.history]);

  const maxWeeklyValue = Math.max(...weeklyData.map(d => d.value), 10); // Minimum 10 scale

  if (!user) {
      return <AuthScreen onComplete={handleAuthComplete} />;
  }

  const allScenarios = [...SCENARIOS, ...customScenarios];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-brand-100">
      
      {/* Resource Modal */}
      {activeResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className={`relative h-48 ${activeResource.imageColor} flex items-center justify-center overflow-hidden shrink-0`}>
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    
                    <div className="relative z-10 flex flex-col items-center text-center p-6">
                       <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-lg ring-1 ring-white/40">
                          <i className={`fa-solid ${activeResource.icon} text-3xl text-white`}></i>
                       </div>
                       <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-md">{activeResource.title}</h2>
                       <span className="text-xs font-bold uppercase tracking-wider text-white/90 mt-2 bg-black/20 px-3 py-1 rounded-full">
                          {activeResource.category}
                       </span>
                    </div>

                    <button onClick={() => setActiveResource(null)} className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white rounded-full p-2 transition-colors w-10 h-10 flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div className="p-8 overflow-y-auto">
                   {isGeneratingContent ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <h3 className="text-lg font-bold text-slate-800">Generating Content...</h3>
                            <p className="text-slate-500 text-sm">AI is creating your personalized lesson.</p>
                        </div>
                   ) : (
                       <>
                           {activeResource.type === 'video' ? (
                               <div className="space-y-6">
                                   <div className="aspect-video bg-slate-900 rounded-2xl relative group flex items-center justify-center overflow-hidden shadow-inner ring-1 ring-slate-900/10">
                                       {/* Dynamic Image or Default */}
                                       {activeResource.content?.imageUrl && (
                                           <img src={activeResource.content.imageUrl} alt="Lesson Thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                                       )}
                                       {!activeResource.content?.imageUrl && <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 opacity-90"></div>}
                                       
                                       {/* Audio Player (simulating video) */}
                                       {activeResource.content?.audioUrl && (
                                            <audio controls autoPlay className="absolute bottom-4 left-4 right-4 w-[calc(100%-2rem)] z-20">
                                                <source src={activeResource.content.audioUrl} type="audio/wav" />
                                            </audio>
                                       )}

                                       {!activeResource.content?.audioUrl && (
                                            <div className="z-20 text-white flex flex-col items-center">
                                                <i className="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
                                                <span>Playback unavailable</span>
                                            </div>
                                       )}
                                   </div>
                                   <div>
                                      <h3 className="font-bold text-slate-900 text-lg mb-2">Lesson Overview</h3>
                                      <p className="text-slate-600 leading-relaxed">
                                          {activeResource.description || "Watch this AI-generated video lesson to improve your skills."}
                                      </p>
                                   </div>
                               </div>
                           ) : activeResource.type === 'podcast' ? (
                               <div className="space-y-6">
                                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col gap-6">
                                       <div className="flex items-center gap-6">
                                          <div className={`w-24 h-24 rounded-2xl ${activeResource.imageColor} flex items-center justify-center text-white text-4xl shadow-lg shrink-0`}>
                                              <i className="fa-solid fa-headphones"></i>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <h4 className="font-bold text-slate-900 text-lg mb-1 truncate">{activeResource.title}</h4>
                                              <p className="text-slate-500 text-sm mb-3">AI Coach & Student</p>
                                              
                                              {activeResource.content?.audioUrl ? (
                                                  <audio controls className="w-full h-10">
                                                      <source src={activeResource.content.audioUrl} type="audio/wav" />
                                                  </audio>
                                              ) : (
                                                  <div className="text-sm text-red-500">Audio unavailable</div>
                                              )}
                                          </div>
                                       </div>
                                   </div>
                                   <p className="text-slate-600 leading-relaxed">
                                      {activeResource.description || "Listen to this generated conversation to understand the nuances of the topic."}
                                   </p>
                               </div>
                           ) : (
                               <div className="space-y-4">
                                   <div className="prose prose-slate prose-sm max-w-none">
                                       <div className="flex items-center gap-3 text-slate-400 text-sm font-medium mb-6 border-b border-slate-100 pb-4">
                                           <div className="flex items-center gap-2">
                                              <i className="fa-regular fa-clock"></i> {activeResource.duration} Read
                                           </div>
                                           <span>•</span>
                                           <div>AI Generated</div>
                                       </div>
                                       
                                       <div className="whitespace-pre-line text-slate-800 leading-relaxed">
                                           {activeResource.content?.text || activeResource.description}
                                       </div>
                                   </div>
                               </div>
                           )}
                       </>
                   )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
                   <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center">
                              <i className="fa-solid fa-trophy text-sm"></i>
                           </div>
                           <div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completion Reward</div>
                               <div className="font-bold text-slate-900">+{activeResource.xp} XP</div>
                           </div>
                       </div>
                       <button 
                         onClick={handleResourceComplete}
                         disabled={isGeneratingContent}
                         className="px-8 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200 flex items-center gap-2 disabled:opacity-50"
                       >
                           Complete Resource <i className="fa-solid fa-check"></i>
                       </button>
                   </div>
                </div>
            </div>
        </div>
      )}

      {/* Session Summary Modal (Live Session End) */}
      {lastSessionReport && (
          <SessionSummary 
            report={lastSessionReport} 
            earnedXP={earnedXP}
            stats={userStats}
            audioBlob={lastSessionAudio || undefined}
            suggestions={lastSessionSuggestions}
            onSelectScenario={(s) => {
                resetViews();
                handleScenarioClick(s);
            }}
            onClose={resetViews}
          />
      )}

      {/* Session Summary Modal (History View) */}
      {viewingHistoryItem && (
          <SessionSummary 
            report={viewingHistoryItem.report}
            earnedXP={Math.floor((viewingHistoryItem.report.durationSeconds / 60) * 10) + 50} 
            stats={userStats}
            onClose={() => setViewingHistoryItem(null)}
            isHistoryView={true}
          />
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={resetViews}>
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-brand-200">
                    <i className="fa-solid fa-wave-square"></i>
                </div>
                <h1 className="font-bold text-xl tracking-tight text-slate-900">FluentFlow</h1>
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-1.5 text-orange-500">
                        <i className="fa-solid fa-fire"></i>
                        <span>{userStats.streak} Day Streak</span>
                    </div>
                    <div className="w-px h-3 bg-slate-300"></div>
                    <div className="flex items-center gap-1.5 text-brand-600">
                        <i className="fa-solid fa-star"></i>
                        <span>Level {userStats.level}</span>
                    </div>
                 </div>

                <div className="flex items-center gap-3">
                    <span className="hidden sm:block text-sm font-medium text-slate-700">{user.name}</span>
                    <button 
                    onClick={() => { resetViews(); setIsEditingAvatar(!isEditingAvatar); }}
                    className="w-10 h-10 rounded-full bg-slate-100 hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center transition-colors relative overflow-hidden border border-slate-200"
                    >
                        <div className="absolute inset-0 top-1">
                            <Avatar config={avatarConfig} />
                        </div>
                    </button>
                    <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 text-sm" title="Log Out">
                        <i className="fa-solid fa-power-off"></i>
                    </button>
                </div>
            </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {isEditingAvatar ? (
             <div className="animate-fade-in">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Customize Your Coach</h2>
                        <p className="text-slate-500">Design the AI persona you'll be practicing with.</p>
                    </div>
                    <button 
                        onClick={() => setIsEditingAvatar(false)}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800"
                    >
                        Back to Dashboard
                    </button>
                </div>
                <AvatarEditor 
                    initialConfig={avatarConfig}
                    onSave={(newConfig) => {
                        setAvatarConfig(newConfig);
                        setIsEditingAvatar(false);
                    }}
                    onCancel={() => setIsEditingAvatar(false)}
                />
             </div>
        ) : showHistory ? (
            <SessionHistoryList 
                history={user.history || []}
                onResume={handleResumeSession}
                onViewDetails={handleViewHistoryDetails}
                onClose={() => setShowHistory(false)}
            />
        ) : showAnalytics ? (
            <AnalyticsDashboard 
                history={user.history || []}
                onBack={() => setShowAnalytics(false)}
            />
        ) : isBuildingScenario ? (
            <ScenarioBuilder 
                onSave={handleSaveCustomScenario}
                onCancel={() => setIsBuildingScenario(false)}
            />
        ) : activeScenario ? (
            <div className="animate-fade-in">
                <div className="mb-4">
                    <button 
                        onClick={() => setActiveScenario(null)}
                        className="text-sm font-medium text-slate-500 hover:text-brand-600 flex items-center gap-1 transition-colors"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                        Abort Session
                    </button>
                </div>
                
                <ActiveSession 
                    scenario={activeScenario}
                    avatarConfig={avatarConfig} 
                    sessionSettings={currentSessionSettings}
                    initialTranscript={initialTranscript}
                    onEndSession={handleSessionEnd} 
                />
            </div>
        ) : pendingScenario ? (
            <SessionSetup 
                scenario={pendingScenario}
                onStart={handleStartSession}
                onCancel={() => setPendingScenario(null)}
            />
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                
                {/* Left Column: Dashboard Main */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Gamification Header */}
                    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-brand-50 to-transparent rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
                        
                        <div className="relative z-10 flex-shrink-0">
                            <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-brand-50">
                                <Avatar config={avatarConfig} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-brand-600 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-white">
                                Lvl {userStats.level}
                            </div>
                        </div>

                        <div className="flex-1 w-full z-10">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Keep it up, {user.name}!</h2>
                                    <p className="text-slate-500">You're making great progress on your fluency journey.</p>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <button 
                                        onClick={handleQuickStart}
                                        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-all active:scale-95 flex items-center gap-2 animate-pulse-slow"
                                    >
                                        <i className="fa-solid fa-bolt text-yellow-400"></i>
                                        Quick Start
                                    </button>
                                </div>
                            </div>
                            
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden w-full mt-4">
                                <div 
                                    className="h-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-slate-400 mt-2">
                                <span>Level {userStats.level}</span>
                                <span>{Math.floor(nextLevelXP - userStats.xp)} XP to next level</span>
                            </div>
                        </div>
                    </div>

                    {/* Analytics Chart Preview */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-900">Weekly Activity</h3>
                            <button 
                                onClick={() => setShowAnalytics(true)}
                                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 bg-brand-50 px-3 py-1.5 rounded-full transition-colors"
                            >
                                View Analytics <i className="fa-solid fa-chart-line ml-1"></i>
                            </button>
                        </div>
                        <div className="h-32 flex items-end gap-2 sm:gap-4">
                            {weeklyData.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div className="w-full relative flex items-end h-full">
                                        <div 
                                            className="w-full bg-brand-500 rounded-t-md opacity-20 group-hover:opacity-100 transition-all duration-300"
                                            style={{ height: `${(d.value / maxWeeklyValue) * 100}%`, minHeight: '4px' }}
                                        ></div>
                                        {d.value > 0 && (
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {Math.round(d.value)}m
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{d.day}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                                <i className="fa-solid fa-fire"></i>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{userStats.streak}</div>
                                <div className="text-xs text-slate-500 font-medium uppercase">Day Streak</div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setShowHistory(true)}
                            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:border-brand-300 transition-colors text-left group"
                        >
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <i className="fa-solid fa-clock-rotate-left"></i>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">{userStats.sessionsCompleted}</div>
                                <div className="text-xs text-slate-500 font-medium uppercase group-hover:text-brand-600">History & Stats</div>
                            </div>
                        </button>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Start a Practice Session</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {allScenarios.map((scenario) => (
                                <ScenarioCard 
                                    key={scenario.id} 
                                    scenario={scenario} 
                                    onClick={handleScenarioClick} 
                                    onDelete={handleDeleteCustomScenario}
                                />
                            ))}
                            
                            {/* Create New Card */}
                            <button
                                onClick={() => setIsBuildingScenario(true)}
                                className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-400 hover:bg-brand-50 transition-all duration-200 group min-h-[160px]"
                            >
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 group-hover:text-brand-600 mb-3 transition-colors">
                                    <i className="fa-solid fa-plus text-xl"></i>
                                </div>
                                <h3 className="font-bold text-slate-600 group-hover:text-brand-700">Create Custom</h3>
                                <p className="text-xs text-slate-400 mt-1">Design your own scenario</p>
                            </button>
                        </div>
                    </div>
                    
                    {/* Recommended Resources Section - DYNAMIC */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Daily Resources</h3>
                            {isLoadingResources && <span className="text-xs text-slate-400 animate-pulse">Curating...</span>}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {dailyResources.map((resource) => (
                                <button 
                                    key={resource.id}
                                    onClick={() => handleResourceClick(resource)}
                                    className="group flex items-start p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all text-left"
                                >
                                    <div className={`w-12 h-12 rounded-lg ${resource.imageColor} text-white flex items-center justify-center shrink-0 mr-4 shadow-sm group-hover:scale-110 transition-transform`}>
                                        <i className={`fa-solid ${resource.icon} text-lg`}></i>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-brand-600 line-clamp-2">{resource.title}</h4>
                                            {resource.isGenerated && <i className="fa-solid fa-wand-magic-sparkles text-[10px] text-brand-400 ml-1" title="AI Generated"></i>}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                                            <span className="uppercase tracking-wide">{resource.category}</span>
                                            <span>•</span>
                                            <span>{resource.duration}</span>
                                        </div>
                                    </div>
                                    <div className="text-brand-600 font-bold text-xs bg-brand-50 px-2 py-1 rounded">
                                        +{resource.xp} XP
                                    </div>
                                </button>
                            ))}
                            {dailyResources.length === 0 && !isLoadingResources && (
                                <div className="col-span-2 text-center py-8 text-slate-400 italic">
                                    Check back tomorrow for new resources.
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Column: Friends & Social */}
                <div className="h-full min-h-[400px]">
                    <FriendsPanel 
                        friends={user.friends} 
                        onAddFriend={handleAddFriend}
                    />
                </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
