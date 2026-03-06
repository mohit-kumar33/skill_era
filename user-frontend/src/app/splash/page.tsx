'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trophy } from 'lucide-react';

export default function SplashScreen() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push('/login');
        }, 2000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                {/* Logo Icon Container */}
                <div className="mb-6 relative">
                    <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-50 rounded-full animate-pulse" />
                    <div className="relative bg-gradient-to-br from-indigo-500 to-cyan-500 p-4 rounded-2xl shadow-2xl shadow-indigo-500/25">
                        <Trophy className="w-12 h-12 text-white" strokeWidth={1.5} />
                    </div>
                </div>

                {/* Typography */}
                <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 mb-3 tracking-tight">
                    SkillEra
                </h1>

                <p className="text-zinc-400 text-sm md:text-base font-medium tracking-wide uppercase text-center max-w-[250px] md:max-w-none">
                    Skill Based Real Money Tournaments
                </p>

                {/* Loading Indicator */}
                <div className="mt-12 flex flex-col items-center gap-3 opacity-80">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="text-xs text-zinc-500 font-medium tracking-widest uppercase">
                        Loading Experience
                    </span>
                </div>
            </div>
        </div>
    );
}
