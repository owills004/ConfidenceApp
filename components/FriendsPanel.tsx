
import React, { useState } from 'react';
import { Friend } from '../types';
import Avatar from './Avatar';

interface FriendsPanelProps {
  friends: Friend[];
  onAddFriend: (name: string) => void;
}

const FriendsPanel: React.FC<FriendsPanelProps> = ({ friends, onAddFriend }) => {
  const [friendName, setFriendName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'leaderboard'>('friends');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (friendName.trim()) {
      onAddFriend(friendName.trim());
      setFriendName('');
      setIsAdding(false);
    }
  };

  const sortedFriends = [...friends].sort((a, b) => b.level - a.level || b.xp - a.xp);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'friends' ? 'text-brand-600 bg-brand-50 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Partners
          </button>
          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'leaderboard' ? 'text-brand-600 bg-brand-50 border-b-2 border-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Leaderboard
          </button>
      </div>

      {activeTab === 'friends' && (
          <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-end">
             <button 
                onClick={() => setIsAdding(!isAdding)}
                className="text-xs bg-white border border-slate-200 hover:border-brand-300 text-brand-600 font-medium px-3 py-1 rounded-full transition-colors shadow-sm"
            >
                <i className={`fa-solid ${isAdding ? 'fa-minus' : 'fa-plus'} mr-1`}></i>
                {isAdding ? 'Cancel' : 'Add Friend'}
            </button>
          </div>
      )}

      {isAdding && activeTab === 'friends' && (
        <form onSubmit={handleAdd} className="p-4 bg-brand-50 border-b border-brand-100 animate-fade-in">
          <label className="block text-xs font-bold text-brand-800 mb-2">Enter Username</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="friend_username"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
              autoFocus
            />
            <button 
                type="submit"
                className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-700"
            >
                Add
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {friends.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-400">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-user-group"></i>
            </div>
            <p className="text-sm">No friends yet.</p>
          </div>
        ) : activeTab === 'friends' ? (
          friends.map(friend => (
            <div key={friend.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group">
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200">
                  <Avatar config={friend.avatarConfig} />
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${friend.isOnline ? 'bg-green-500' : 'bg-slate-400'}`}></div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{friend.name}</h4>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Lvl {friend.level}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                    {friend.isOnline ? 'Online' : `Last seen ${friend.lastActive}`}
                </p>
              </div>
              <button className="opacity-0 group-hover:opacity-100 text-brand-600 bg-brand-50 p-2 rounded-full hover:bg-brand-100 transition-all">
                 <i className="fa-solid fa-phone text-xs"></i>
              </button>
            </div>
          ))
        ) : (
            // Leaderboard View
            sortedFriends.map((friend, index) => (
                <div key={friend.id} className="flex items-center gap-3 p-3 rounded-lg border-b border-slate-50">
                    <div className="w-6 font-bold text-slate-400 text-sm text-center">
                        {index === 0 ? <i className="fa-solid fa-crown text-yellow-500"></i> : `#${index + 1}`}
                    </div>
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200">
                        <Avatar config={friend.avatarConfig} />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900">{friend.name}</h4>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-brand-600">{friend.level * 1000 + (Math.floor(Math.random()*500))} XP</div>
                        <div className="text-[10px] text-slate-400">Level {friend.level}</div>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default FriendsPanel;
