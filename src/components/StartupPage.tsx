import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  MessageSquare,
  Video,
  Lock,
  Users,
  ShieldAlert,
  ArrowRight,
  Plus,
  Compass,
  Sliders,
} from 'lucide-react';
import { User } from '../types';
import { AppView } from './Sidebar';
import { PilgrimLogo } from './PilgrimLogo';

interface StartupPageProps {
  user: User;
  isNewSignup: boolean;
  onNavigate: (view: AppView) => void;
  onOpenMyProfile: () => void;
  onOpenNewServer: () => void;
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Community Servers',
    description:
      'Switch between servers from the left icon rail, search existing communities, or launch your own channels to chat live.',
    actionLabel: 'Make New Server',
    actionKey: 'new_server',
  },
  {
    icon: Video,
    title: 'Profile Media & Thoughts',
    description:
      'Upload videos, share showcase images, and post thoughts directly on your Profile Dashboard for others to like, comment, and share.',
    actionLabel: 'Open My Profile',
    actionKey: 'profile',
  },
  {
    icon: Lock,
    title: 'Flexible Post Privacy',
    description:
      'Control who sees every upload or thought. Set each post to Public, Friends-Only, or Private anytime.',
    actionLabel: 'Explore Feed',
    actionKey: 'feed',
  },
  {
    icon: Users,
    title: 'Friends & Direct Messages',
    description:
      'Add friends by their unique tag or email, manage friend requests, and message privately in real time.',
    actionLabel: 'Manage Friends',
    actionKey: 'friends',
  },
  {
    icon: Sliders,
    title: 'Appearance & Reading Settings',
    description:
      'Adjust letter sizing, character and card spacing, and toggle between Light Mode and Dark Mode.',
    actionLabel: 'Open Settings',
    actionKey: 'settings',
  },
  {
    icon: ShieldAlert,
    title: 'Community Safety & Reporting',
    description:
      'Report bad actors, harassment, or spam from any post, comment, or message to keep communities welcoming.',
    actionLabel: 'Safety Center',
    actionKey: 'safety',
  },
];

export const StartupPage: React.FC<StartupPageProps> = ({
  user,
  isNewSignup,
  onNavigate,
  onOpenMyProfile,
  onOpenNewServer,
}) => {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.startup-hero', {
        y: 22,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
      gsap.from('.feature-card', {
        y: 24,
        opacity: 0,
        duration: 0.55,
        stagger: 0.08,
        delay: 0.15,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  const handleFeatureAction = (key: string) => {
    if (key === 'new_server') onOpenNewServer();
    else if (key === 'profile') onOpenMyProfile();
    else if (key === 'feed') onNavigate('feed');
    else if (key === 'friends') onNavigate('friends');
    else if (key === 'settings') onNavigate('settings');
    else if (key === 'safety') onNavigate('safety');
  };

  return (
    <div ref={pageRef} className="pilgrim-stack">
      {/* Hero Introduction Card (Pure Geometric Vector Graphic) */}
      <section className="startup-hero bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
                <span>{isNewSignup ? 'Account Created' : 'Welcome Back'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">{user.tag}</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-white text-balance">
                Welcome to ArkLine, {user.name}
              </h1>

              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">
                ArkLine brings real-time community servers, direct messaging, and a customizable creator profile together in one focused platform. Upload videos, share images, and post thoughts with full privacy control.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onOpenMyProfile}
                className="py-2.5 px-5 bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Open Profile Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('feed')}
                className="py-2.5 px-5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer whitespace-nowrap"
              >
                <Compass className="w-4 h-4" />
                <span>Browse Community Feed</span>
              </button>

              <button
                type="button"
                onClick={onOpenNewServer}
                className="py-2.5 px-5 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors border border-zinc-200 dark:border-zinc-700 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Make New Server</span>
              </button>
            </div>
          </div>

          {/* Crisp Geometric Vector Backdrop */}
          <div className="lg:col-span-5 relative min-h-[220px] bg-zinc-950 flex flex-col justify-between p-6 sm:p-8 overflow-hidden border-t lg:border-t-0 lg:border-l border-zinc-800">
            <svg
              className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
              viewBox="0 0 400 260"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid slice"
            >
              <path d="M0 210 H400 M0 170 H400 M0 130 H400" stroke="#52525b" strokeWidth="1" />
              <path d="M80 0 V260 M160 0 V260 M240 0 V260 M320 0 V260" stroke="#3f3f46" strokeWidth="1" />
              <polygon points="200,32 268,78 242,175 200,210 158,175 132,78" stroke="#ffffff" strokeWidth="2" />
              <circle cx="200" cy="118" r="56" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>

            <div className="relative z-10 flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 p-1.5 flex items-center justify-center">
                <PilgrimLogo className="w-full h-full" invertOnDark />
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                Monochrome Edition
              </span>
            </div>

            <div className="relative z-10 text-white pt-8">
              <p className="text-xs font-mono text-zinc-400">ArkLine Network</p>
              <p className="font-display text-xl font-bold mt-0.5">
                Chat, Share Media, and Connect
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What ArkLine Has to Offer */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
            Everything ArkLine Offers
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
            One unified platform combining icon-based community servers, creator video uploads, and customizable reading settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="feature-card bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pilgrim-card-pad flex flex-col justify-between hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => handleFeatureAction(feat.actionKey)}
                    className="text-xs font-semibold text-zinc-950 dark:text-zinc-100 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{feat.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
