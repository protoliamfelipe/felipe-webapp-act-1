import React from 'react';
import { Compass, Plus, Search, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Server } from '../types';
import { ServerIconBadge } from './ServerIconBadge';

interface DiscoverServersViewProps {
  servers: Array<Server & { isMember: boolean; memberCount: number }>;
  serverSearch: string;
  setServerSearch: (q: string) => void;
  onJoinServer: (serverId: string) => void;
  onSelectServer: (serverId: string) => void;
  onOpenNewServerModal: () => void;
}

export const DiscoverServersView: React.FC<DiscoverServersViewProps> = ({
  servers,
  serverSearch,
  setServerSearch,
  onJoinServer,
  onSelectServer,
  onOpenNewServerModal,
}) => {
  const discoverableServers = servers.filter((s) => !s.isMember);
  const joinedServers = servers.filter((s) => s.isMember);

  return (
    <div className="pilgrim-stack">
      {/* Discovery Hero Banner */}
      <section className="bg-zinc-950 text-white border border-zinc-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-zinc-200">
            <Compass className="w-3.5 h-3.5" />
            <span>Discover Communities on Pilgrim</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
            Find your community servers
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Browse public servers, join via invite link, or launch your own community space with custom channels, roles, and voice rooms.
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={serverSearch}
                onChange={(e) => setServerSearch(e.target.value)}
                placeholder="Search discoverable servers..."
                aria-label="Search discoverable servers"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white"
              />
            </div>

            <button
              type="button"
              onClick={onOpenNewServerModal}
              className="py-2.5 px-4 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create or Join Server</span>
            </button>
          </div>
        </div>
      </section>

      {/* Discoverable Servers Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
            Discoverable Servers
          </h2>
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
            {discoverableServers.length} available
          </span>
        </div>

        {discoverableServers.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {serverSearch.trim()
                ? 'No discoverable servers match your search'
                : 'You have joined all currently discoverable servers'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Use an invite code or create a brand-new server anytime.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discoverableServers.map((srv) => (
              <div
                key={srv.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col transition-colors hover:border-zinc-400 dark:hover:border-zinc-600"
              >
                <div className="h-24 bg-zinc-950 relative overflow-hidden">
                  {srv.bannerUrl ? (
                    <img
                      src={srv.bannerUrl}
                      alt={`${srv.name} banner`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
                  )}
                </div>
                <div className="p-4 pt-0 flex-1 flex flex-col">
                  <div className="-mt-6 mb-3 relative z-10 w-fit rounded-2xl ring-4 ring-white dark:ring-zinc-900">
                    <ServerIconBadge server={srv} active size="lg" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">
                    {srv.name}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2 flex-1">
                    {srv.description || 'Community server on Pilgrim.'}
                  </p>
                  <div className="pt-4 mt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>{srv.memberCount} members</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onJoinServer(srv.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold cursor-pointer"
                    >
                      Join Server
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Joined Servers Quick Jump */}
      {joinedServers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Your Servers
            </h2>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {joinedServers.length} joined
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {joinedServers.map((srv) => (
              <button
                key={srv.id}
                type="button"
                onClick={() => onSelectServer(srv.id)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-2xl p-4 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ServerIconBadge server={srv} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                        {srv.name}
                      </p>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {srv.memberCount} members
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
