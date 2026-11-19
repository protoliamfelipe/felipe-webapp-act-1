import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  Upload,
  ShieldOff,
  Crop,
  X,
  KeyRound,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { PilgrimLogo } from './PilgrimLogo';
import { ImageCropModal } from './ImageCropModal';
import { makeInitialsAvatar } from '../utils/avatars';

interface AuthScreenProps {
  onAuthSuccess: (user: User, isNewSignup?: boolean) => void;
}

function calculateLocalAge(dobStr: string): number | null {
  if (!dobStr || typeof dobStr !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobStr.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Validate real calendar date (prevents rollover like Feb 30 -> Mar 2)
  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  let age = currentYear - year;
  if (currentMonth < month || (currentMonth === month && currentDay < day)) {
    age--;
  }
  return age;
}

function getTodayLocalDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signInMethod, setSignInMethod] = useState<'password' | 'email_code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [rawAvatarSrc, setRawAvatarSrc] = useState<string | null>(null);
  const [rawAvatarName, setRawAvatarName] = useState<string>('avatar.png');
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Email Code (Passwordless) State
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeInput, setEmailCodeInput] = useState('');
  const [unregisteredPrompt, setUnregisteredPrompt] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [tosModalOpen, setTosModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accessDeniedAge, setAccessDeniedAge] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.auth-stagger', {
        y: 18,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Auto-verify magic link token if opened via ?emailToken=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailToken = params.get('emailToken');
    if (!emailToken) return;
    window.history.replaceState({}, document.title, window.location.pathname);
    setLoading(true);
    api
      .verifyEmailLoginCode({ magicToken: emailToken })
      .then((res) => onAuthSuccess(res.user, false))
      .catch((err: any) => {
        setMode('signin');
        setSignInMethod('email_code');
        setErrorMessage(err?.message || 'Email sign-in link has expired.');
      })
      .finally(() => setLoading(false));
  }, [onAuthSuccess]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const isGif = f.type === 'image/gif' || /\.gif$/i.test(f.name);
    if (isGif) {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      if (rawAvatarSrc) URL.revokeObjectURL(rawAvatarSrc);
      const gifUrl = URL.createObjectURL(f);
      setAvatarFile(f);
      setAvatarPreview(gifUrl);
      setRawAvatarSrc(null);
      setIsCropModalOpen(false);
      e.target.value = '';
      return;
    }

    if (rawAvatarSrc) URL.revokeObjectURL(rawAvatarSrc);
    const srcUrl = URL.createObjectURL(f);
    setRawAvatarSrc(srcUrl);
    setRawAvatarName(f.name);
    setIsCropModalOpen(true);
    e.target.value = '';
  };

  const handleCropApply = (croppedFile: File, croppedPreview: string) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(croppedFile);
    setAvatarPreview(croppedPreview);
    setIsCropModalOpen(false);
  };

  const handleClearAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (rawAvatarSrc) URL.revokeObjectURL(rawAvatarSrc);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRawAvatarSrc(null);
  };

  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    setErrorMessage(null);
    const age = calculateLocalAge(val);
    if (age !== null && age >= 0 && age <= 12) {
      setAccessDeniedAge(true);
    } else {
      setAccessDeniedAge(false);
    }
  };

  const handleRequestEmailCode = async () => {
    setErrorMessage(null);
    setUnregisteredPrompt(false);
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await api.requestEmailLoginCode(email.trim());
      setEmailCodeSent(true);
      setEmailCodeInput('');
    } catch (err: any) {
      const msg = err?.message || 'Could not send login code.';
      setErrorMessage(msg);
      if (msg.toLowerCase().includes('no pilgrim account') || msg.toLowerCase().includes('no arkline account')) {
        setUnregisteredPrompt(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailCode = async (overrideToken?: string) => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = overrideToken
        ? await api.verifyEmailLoginCode({ magicToken: overrideToken })
        : await api.verifyEmailLoginCode({ email: email.trim(), code: emailCodeInput.trim() });
      onAuthSuccess(res.user, false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAccessDeniedAge(false);
    setUnregisteredPrompt(false);

    if (mode === 'signin' && signInMethod === 'email_code') {
      if (!emailCodeSent) {
        await handleRequestEmailCode();
      } else {
        await handleVerifyEmailCode();
      }
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorMessage('Please enter a gamer username.');
        return;
      }

      const age = calculateLocalAge(birthDate);
      if (age === null || age < 0 || age > 120) {
        setErrorMessage('Please enter a valid date of birth.');
        return;
      }
      if (age <= 12) {
        setAccessDeniedAge(true);
        return;
      }

      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters.');
        return;
      }

      if (!acceptedTos) {
        setErrorMessage('You must read and accept the ArkLine Terms of Service to create an account.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const res = await api.login({ email, password });
        onAuthSuccess(res.user, false);
      } else {
        const res = await api.register({
          email,
          password,
          name,
          bio,
          birthDate,
          avatarFile,
        });
        onAuthSuccess(res.user, true);
      }
    } catch (err: any) {
      const msg = err.message || 'Unable to authenticate. Please check your details.';
      if (msg.toLowerCase().includes('access denied') && msg.toLowerCase().includes('13')) {
        setAccessDeniedAge(true);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (demoEmail: string) => {
    setErrorMessage(null);
    setAccessDeniedAge(false);
    setLoading(true);
    try {
      const res = await api.login({ email: demoEmail, password: 'password123' });
      onAuthSuccess(res.user, false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Quick sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const currentAvatarDisplay = avatarPreview || makeInitialsAvatar(name || 'P');

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8"
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-lg auth-stagger">
        <div className="flex items-center justify-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#09090b] flex items-center justify-center p-1.5 border border-zinc-800 shadow-sm">
            <PilgrimLogo className="w-full h-full" invertOnDark />
          </div>
          <span className="font-display text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            ArkLine
          </span>
        </div>

        <h1 className="mt-5 text-center font-display text-2xl font-bold text-zinc-950 dark:text-white">
          {mode === 'signin' ? 'Sign In to ArkLine' : 'Create an Account'}
        </h1>
        <p className="mt-1.5 text-center text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
          {mode === 'signin'
            ? 'Connect with friends, join community servers, and share your posts and videos.'
            : 'Upload your profile photo, pick a private gamer username, and join ArkLine.'}
        </p>
      </div>

      <motion.div
        layout
        transition={{ duration: 0.2 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg auth-stagger"
      >
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 sm:px-9 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs">
          {/* Clean Tab Switcher */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMessage(null);
                setAccessDeniedAge(false);
                setUnregisteredPrompt(false);
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'signin'
                  ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
                setUnregisteredPrompt(false);
                const age = calculateLocalAge(birthDate);
                setAccessDeniedAge(age !== null && age >= 0 && age <= 12);
              }}
              className={`flex-1 pb-3 text-sm font-semibold text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'signup'
                  ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              Create an Account
            </button>
          </div>

          {/* Sign In Method Switcher: Password vs Passwordless Email Code */}
          {mode === 'signin' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 mb-5">
              <button
                type="button"
                onClick={() => {
                  setSignInMethod('password');
                  setErrorMessage(null);
                  setUnregisteredPrompt(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  signInMethod === 'password'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Password</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSignInMethod('email_code');
                  setErrorMessage(null);
                  setUnregisteredPrompt(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  signInMethod === 'email_code'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Login via Email Code</span>
              </button>
            </div>
          )}

          {/* Age 12 and Under Access Denied Notice */}
          {accessDeniedAge && (
            <div
              role="alert"
              className="mb-6 p-5 rounded-2xl bg-zinc-950 text-white border border-zinc-800 space-y-2.5"
            >
              <div className="flex items-center gap-2.5">
                <ShieldOff className="w-5 h-5 text-red-400 shrink-0" />
                <h2 className="font-display text-base font-bold">Access Denied</h2>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                ArkLine is available only to users aged <strong>13 and older</strong>. Because the birth date entered indicates age 12 or below, access is denied until you reach age 13.
              </p>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 space-y-2 text-xs text-red-800 dark:text-red-200"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              {unregisteredPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    setUnregisteredPrompt(false);
                  }}
                  className="ml-6 py-1 px-2.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[11px] font-semibold cursor-pointer"
                >
                  Create an Account with {email}
                </button>
              )}
              {mode === 'signin' && signInMethod === 'email_code' && !unregisteredPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setSignInMethod('password');
                    setErrorMessage(null);
                    setEmailCodeSent(false);
                  }}
                  className="ml-6 py-1 px-2.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-[11px] font-semibold cursor-pointer"
                >
                  Switch to Password Sign In
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Upload & Frame Profile Picture */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={currentAvatarDisplay}
                        alt="Profile picture preview"
                        className="w-14 h-14 rounded-full object-cover border-2 border-zinc-300 dark:border-zinc-700 bg-zinc-900 shrink-0"
                      />
                      <div>
                        <p className="text-xs font-bold text-zinc-950 dark:text-white">
                          Profile Picture
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Upload an image or animated GIF for your profile.
                        </p>
                      </div>
                    </div>

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*,image/gif"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="py-1.5 px-3 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{avatarPreview ? 'Change' : 'Upload Photo'}</span>
                      </button>
                      {rawAvatarSrc && (
                        <button
                          type="button"
                          onClick={() => setIsCropModalOpen(true)}
                          title="Adjust framing"
                          className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer"
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={handleClearAvatar}
                          title="Remove uploaded photo"
                          className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-zinc-500 hover:text-red-600 border border-zinc-300 dark:border-zinc-700 rounded-lg cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gamer Username & Birthdate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Gamer Username
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. username"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Use a handle instead of your real name to protect your privacy.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      Date of Birth <span className="text-zinc-400 font-normal">(13+ only)</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3 pointer-events-none" />
                      <input
                        type="date"
                        required
                        min="1905-01-01"
                        max={getTodayLocalDateString()}
                        value={birthDate}
                        onChange={(e) => handleBirthDateChange(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    About You <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tell us a little about yourself, your interests, or what you like to share..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                {mode === 'signin' && signInMethod === 'password'
                  ? 'Email Address or Gamer Tag'
                  : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type={mode === 'signin' && signInMethod === 'password' ? 'text' : 'email'}
                  required
                  disabled={mode === 'signin' && signInMethod === 'email_code' && emailCodeSent}
                  placeholder={
                    mode === 'signin' && signInMethod === 'password'
                      ? 'you@example.com or FrostByte#0001'
                      : 'you@example.com'
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white disabled:opacity-70"
                />
              </div>
            </div>

            {mode === 'signin' && signInMethod === 'email_code' ? (
              <div className="space-y-4">
                {!emailCodeSent ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    We will send a 6-digit one-time verification code and instant sign-in link to your registered email address — no password required.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate">
                          Verification code sent to {email}. Check your inbox.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEmailCodeSent(false);
                          setEmailCodeInput('');
                        }}
                        className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:underline shrink-0 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      For security, the 6-digit code is only sent to your email address (check spam if you don&apos;t see it) and expires in 10 minutes.
                    </p>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          6-Digit Verification Code
                        </label>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={handleRequestEmailCode}
                          className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Resend</span>
                        </button>
                      </div>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          placeholder="000000"
                          value={emailCodeInput}
                          onChange={(e) => setEmailCodeInput(e.target.value.replace(/\D/g, ''))}
                          className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-mono tracking-widest text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSignInMethod('email_code');
                        setErrorMessage(null);
                      }}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                    >
                      Sign in with Email Code
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={mode === 'signup' ? 8 : undefined}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Minimum 8 characters required.
                  </p>
                )}
              </div>
            )}

            {mode === 'signup' && (
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
                <input
                  id="tos-accept"
                  type="checkbox"
                  checked={acceptedTos}
                  onChange={(e) => {
                    setAcceptedTos(e.target.checked);
                    if (errorMessage?.includes('Terms of Service')) setErrorMessage(null);
                  }}
                  className="mt-0.5 w-4 h-4 accent-zinc-950 dark:accent-white cursor-pointer shrink-0"
                />
                <label
                  htmlFor="tos-accept"
                  className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed cursor-pointer"
                >
                  I confirm I am at least 13 years old and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setTosModalOpen(true)}
                    className="font-bold text-zinc-950 dark:text-white underline hover:opacity-80 cursor-pointer"
                  >
                    ArkLine Terms of Service & Community Guidelines
                  </button>
                  .
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && (accessDeniedAge || !acceptedTos))}
              className="w-full mt-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Please wait...</span>
              ) : (
                <>
                  <span>
                    {mode === 'signup'
                      ? 'Create an Account'
                      : signInMethod === 'email_code'
                      ? emailCodeSent
                        ? 'Verify Code & Sign In'
                        : 'Send Login Code'
                      : 'Sign In'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Instant Demo Access */}
          <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center font-medium mb-3">
              Quick Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickDemo('frostbyte@pilgrim.app')}
                disabled={loading}
                className="py-2 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-center transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
              >
                FrostByte
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('kitsune@pilgrim.app')}
                disabled={loading}
                className="py-2 px-3 text-xs font-medium text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-center transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer"
              >
                KitsuneDrift
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={rawAvatarSrc}
        mode="avatar"
        fileName={rawAvatarName}
        onCancel={() => setIsCropModalOpen(false)}
        onApply={handleCropApply}
      />

      {/* Terms of Service Modal */}
      {tosModalOpen && (
        <div
          onClick={() => setTosModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white">
                ArkLine Terms of Service & Community Guidelines
              </h3>
              <button
                type="button"
                onClick={() => setTosModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p>
                <strong>1. Eligibility & Privacy:</strong> You must be at least 13 years old to register or use ArkLine. Use a non-identifying gamer username rather than personal details when interacting publicly.
              </p>
              <p>
                <strong>2. Respectful Conduct:</strong> Harassment, hate speech, threats, doxxing, impersonation, or sharing non-consensual content is strictly prohibited across all posts, servers, DMs, and voice channels.
              </p>
              <p>
                <strong>3. Content & Media Uploads:</strong> You are responsible for images, videos, GIFs, custom emojis, and voice clips you upload. Do not distribute malware, pirated files, or harmful media.
              </p>
              <p>
                <strong>4. Server Moderation & Safety:</strong> Server owners and authorized moderators may timeout, kick, or ban members, remove messages, and manage roles. Users may block or report bad actors anytime via Safety & Reports.
              </p>
              <p>
                <strong>5. Account Security:</strong> Keep your credentials private and review active invite links regularly. ArkLine reserves the right to suspend accounts violating safety rules.
              </p>
            </div>
            <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2 bg-zinc-50 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => setTosModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcceptedTos(true);
                  setTosModalOpen(false);
                  if (errorMessage?.includes('Terms of Service')) setErrorMessage(null);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
