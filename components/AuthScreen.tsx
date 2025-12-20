
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { DEFAULT_USER_STATS } from '../constants';
import { validateEmail, EmailValidationResult } from '../services/validation';

interface AuthScreenProps {
  onComplete: (user: User) => void;
}

type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-password';

const AuthScreen: React.FC<AuthScreenProps> = ({ onComplete }) => {
  const [view, setView] = useState<AuthView>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  
  const [emailValidation, setEmailValidation] = useState<EmailValidationResult>({ isValid: false });
  const [showValidationUI, setShowValidationUI] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time validation effect
  useEffect(() => {
    if (email.length > 0) {
      const result = validateEmail(email);
      setEmailValidation(result);
    } else {
      setEmailValidation({ isValid: false });
      setShowValidationUI(false);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    
    // Final deep validation
    const validation = validateEmail(email);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid email address.');
      setShowValidationUI(true);
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const usersDbStr = localStorage.getItem('fluentflow_users_db');
      const usersDb = usersDbStr ? JSON.parse(usersDbStr) : [];
      
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      if (view === 'signup') {
        if (!name.trim()) throw new Error("Full Name is required.");
        if (!cleanPassword) throw new Error("Password is required.");
        if (cleanPassword.length < 6) throw new Error("Password must be at least 6 characters long.");
        if (cleanPassword !== confirmPassword) throw new Error("Passwords do not match.");
        
        const existingUser = usersDb.find((u: any) => u.email.toLowerCase() === cleanEmail);
        if (existingUser) throw new Error("An account with this email already exists.");

        const newUser: User = {
          id: Date.now().toString(),
          name: name.trim(),
          email: cleanEmail,
          friends: [],
          stats: DEFAULT_USER_STATS,
          history: []
        };

        const dbEntry = { ...newUser, password: cleanPassword }; 
        usersDb.push(dbEntry);
        localStorage.setItem('fluentflow_users_db', JSON.stringify(usersDb));
        
        onComplete(newUser);
      } 
      else if (view === 'login') {
        if (!cleanPassword) throw new Error("Password is required.");

        const userIndex = usersDb.findIndex((u: any) => 
            u.email.toLowerCase() === cleanEmail && 
            u.password === cleanPassword
        );
        
        if (userIndex === -1) {
          const emailExists = usersDb.some((u: any) => u.email.toLowerCase() === cleanEmail);
          throw new Error(emailExists ? "Incorrect password." : "No account found with this email.");
        }

        const user = usersDb[userIndex];
        const { password: _, ...safeUser } = user;
        onComplete(safeUser as User);
      }
      else if (view === 'forgot-password') {
          const userExists = usersDb.some((u: any) => u.email.toLowerCase() === cleanEmail);
          if (!userExists) throw new Error("No account found with this email.");
          setSuccessMsg(`Recovery code sent to ${cleanEmail}`);
          setView('reset-password');
      }
      else if (view === 'reset-password') {
          if (!recoveryCode.trim()) throw new Error("Recovery code is required.");
          if (!newPassword.trim()) throw new Error("New password is required.");
          const userIndex = usersDb.findIndex((u: any) => u.email.toLowerCase() === cleanEmail);
          if (userIndex === -1) throw new Error("User not found."); 
          usersDb[userIndex].password = newPassword.trim();
          localStorage.setItem('fluentflow_users_db', JSON.stringify(usersDb));
          setSuccessMsg("Password reset successfully.");
          setTimeout(() => setView('login'), 1500);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleView = (newView: AuthView) => {
    setView(newView);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setEmail('');
    setShowValidationUI(false);
  };

  const applySuggestion = () => {
    if (emailValidation.suggestion) {
      setEmail(emailValidation.suggestion);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-brand-600 p-8 text-center">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg text-brand-600 text-2xl">
                <i className="fa-solid fa-wave-square"></i>
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">FluentFlow</h1>
            <p className="text-brand-100 opacity-90">AI-Powered Confidence Coach</p>
        </div>

        <div className="p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
                {view === 'login' && 'Welcome Back'}
                {view === 'signup' && 'Create Your Account'}
                {view === 'forgot-password' && 'Recover Password'}
                {view === 'reset-password' && 'Set New Password'}
            </h2>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100 animate-fade-in">
                    <i className="fa-solid fa-circle-exclamation shrink-0"></i>
                    <span>{error}</span>
                </div>
            )}

            {successMsg && (
                <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2 border border-green-100 animate-fade-in">
                    <i className="fa-solid fa-check-circle shrink-0"></i>
                    <span>{successMsg}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {view === 'signup' && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                        <input 
                            type="text" 
                            name="name"
                            autoComplete="name"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all bg-white text-slate-900 placeholder-slate-400"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                    <div className="relative">
                        <input 
                            type="email" 
                            name="email"
                            autoComplete="email"
                            className={`w-full px-4 py-3 rounded-xl border outline-none transition-all bg-white text-slate-900 placeholder-slate-400 pr-10 ${
                                showValidationUI && !emailValidation.isValid 
                                ? 'border-red-300 bg-red-50/30' 
                                : email.length > 0 && emailValidation.isValid 
                                    ? 'border-green-300 bg-green-50/30' 
                                    : 'border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
                            }`}
                            placeholder="you@example.com"
                            value={email}
                            onBlur={() => setShowValidationUI(true)}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={view === 'reset-password'}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {email.length > 0 && (
                                emailValidation.isValid 
                                ? <i className="fa-solid fa-circle-check text-green-500"></i>
                                : <i className="fa-solid fa-circle-xmark text-red-400"></i>
                            )}
                        </div>
                    </div>
                    {emailValidation.suggestion && (
                        <button 
                            type="button"
                            onClick={applySuggestion}
                            className="mt-1 text-[11px] text-brand-600 font-bold hover:text-brand-800 transition-colors flex items-center gap-1"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                            Did you mean {emailValidation.suggestion}?
                        </button>
                    )}
                    {showValidationUI && !emailValidation.isValid && emailValidation.error && (
                        <p className="mt-1 text-[11px] text-red-500 font-medium">
                            {emailValidation.error}
                        </p>
                    )}
                </div>

                {(view === 'login' || view === 'signup') && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                            {view === 'login' && (
                                <button type="button" onClick={() => toggleView('forgot-password')} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Forgot?</button>
                            )}
                        </div>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                name="password"
                                autoComplete={view === 'signup' ? "new-password" : "current-password"}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all bg-white text-slate-900 placeholder-slate-400 pr-10"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2"
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>
                )}

                {view === 'signup' && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Confirm Password</label>
                        <div className="relative">
                            <input 
                                type={showConfirmPassword ? "text" : "password"} 
                                name="confirmPassword"
                                autoComplete="new-password"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all bg-white text-slate-900 placeholder-slate-400 pr-10"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2"
                            >
                                <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>
                )}

                {view === 'reset-password' && (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Recovery Code</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all bg-white text-slate-900 placeholder-slate-400"
                                placeholder="Enter code from email"
                                value={recoveryCode}
                                onChange={(e) => setRecoveryCode(e.target.value)}
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Password</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    name="newPassword"
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all bg-white text-slate-900 placeholder-slate-400 pr-10"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-2"
                                >
                                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                </button>
                            </div>
                        </div>
                    </>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading || (view === 'signup' && !emailValidation.isValid && email.length > 0)}
                    className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg shadow-brand-200 transition-all transform active:scale-95 flex items-center justify-center gap-2 ${isLoading ? 'bg-brand-400 cursor-wait' : 'bg-brand-600 hover:bg-brand-700 hover:-translate-y-1 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none'}`}
                >
                    {isLoading ? (
                        <><i className="fa-solid fa-circle-notch animate-spin"></i> Processing...</>
                    ) : (
                        <>
                            {view === 'login' && 'Sign In'}
                            {view === 'signup' && 'Create Account'}
                            {view === 'forgot-password' && 'Send Recovery Code'}
                            {view === 'reset-password' && 'Reset Password'}
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 text-center">
                {view === 'login' ? (
                    <p className="text-slate-500 text-sm">
                        Don't have an account?{' '}
                        <button onClick={() => toggleView('signup')} className="text-brand-600 font-bold hover:underline">Sign Up</button>
                    </p>
                ) : view === 'signup' ? (
                    <p className="text-slate-500 text-sm">
                        Already have an account?{' '}
                        <button onClick={() => toggleView('login')} className="text-brand-600 font-bold hover:underline">Log In</button>
                    </p>
                ) : (
                    <button onClick={() => toggleView('login')} className="text-slate-500 text-sm hover:text-brand-600 font-medium flex items-center gap-1 justify-center mx-auto">
                        <i className="fa-solid fa-arrow-left"></i> Back to Login
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
