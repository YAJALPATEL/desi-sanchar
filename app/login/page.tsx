'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Lock, Mail, User, Moon, Sun, ArrowRight, Loader2, Music, Share2, Heart } from 'lucide-react'
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

// === MOCK DATA FOR SLIDER ===
const MOCK_POSTS = [
    { user: "Aarav", color: "bg-blue-500", desc: "Vibing to the new Arijit song! 🎶", likes: "1.2k" },
    { user: "Priya", color: "bg-purple-500", desc: "Sunset in Jaipur 🌅 #DesiTravel", likes: "854" },
    { user: "Rohan", color: "bg-green-500", desc: "Coding late night... ☕", likes: "2.1k" },
    { user: "Sneha", color: "bg-pink-500", desc: "New dance reel is up! Check it out.", likes: "4.5k" },
]

export default function LoginPage() {
    // Input State
    const [identifier, setIdentifier] = useState('') // Can be Email or Username
    const [password, setPassword] = useState('')

    // Signup Specific State
    const [username, setUsername] = useState('')
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('') // Specific for signup

    const [isSignUp, setIsSignUp] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const router = useRouter()
    const supabase = createClient()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (isSignUp) {
                // === SIGN UP LOGIC ===
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { username, full_name: fullName } },
                })
                if (error) throw error
                alert('Account Created! Please Log in.')
                setIsSignUp(false)
            } else {
                // === LOGIN LOGIC (Email or Username) ===
                let loginEmail = identifier;

                // Simple check: If it doesn't have '@', assume it's a username
                // NOTE: Supabase requires Email to login by default. 
                // Real username login requires a backend function. 
                // For now, if they type a username without @, we warn them.
                if (!identifier.includes('@')) {
                    throw new Error("Login with Username is coming soon. Please use your Email for now.");
                }

                const { error } = await supabase.auth.signInWithPassword({
                    email: loginEmail,
                    password
                })
                if (error) throw error
                router.push('/')
                router.refresh()
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!mounted) return null

    return (
        <div className="relative flex min-h-screen w-full overflow-hidden bg-gray-50 dark:bg-[#050505] transition-colors duration-500">

            {/* ============================================== */}
            {/* GLOBAL BACKGROUND (Unified for Both Sides)     */}
            {/* ============================================== */}
            <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
                {/* The Animated Blobs */}
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-crimson/20 dark:bg-crimson/20 rounded-full blur-[120px] animate-blob" />
                <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-nebula/20 dark:bg-nebula/20 rounded-full blur-[100px] animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-[30vw] h-[30vw] bg-neon/10 dark:bg-neon/10 rounded-full blur-[100px] animate-blob animation-delay-4000" />
                <div className="absolute bottom-[10%] right-[10%] w-[25vw] h-[25vw] bg-sky/10 dark:bg-sky/10 rounded-full blur-[80px] animate-blob animation-delay-2000" />

                {/* Grid Texture */}
                <div className="absolute inset-0 bg-grid-black/[0.03] dark:bg-grid-white/[0.03] bg-[size:30px_30px]" />
            </div>

            {/* Theme Toggle */}
            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/40 dark:bg-black/40 border border-white/20 dark:border-white/10 backdrop-blur-md hover:scale-110 transition-transform text-gray-800 dark:text-white shadow-lg"
            >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* ============================================== */}
            {/* LEFT SIDE: SHOWCASE (Glassmorphism)            */}
            {/* ============================================== */}
            <div className="hidden lg:flex w-1/2 relative z-10 flex-col justify-between p-12 border-r border-white/20 dark:border-white/5 bg-white/30 dark:bg-black/30 backdrop-blur-md">

                {/* Logo Header */}
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
                    <div className="w-12 h-12 relative drop-shadow-lg">
                        <Image src="/logo.png" alt="Logo" fill className="object-contain" />
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-crimson to-nebula">
                            DESI SANCHAR
                        </span>
                    </h2>
                </motion.div>

                {/* Content */}
                <div className="flex flex-col gap-10 mt-8">
                    <div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="text-5xl font-extrabold text-gray-900 dark:text-white leading-[1.1] mb-6"
                        >
                            The Heartbeat <br /> of <span className="text-crimson">Digital India.</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                            className="text-gray-700 dark:text-gray-300 text-lg max-w-md leading-relaxed"
                        >
                            Experience a social world built for music, moments, and real connections. Join the rhythm today.
                        </motion.p>
                        <div className="flex gap-4 mt-8">
                            <FeatureBadge icon={<Music size={16} />} text="Music Library" />
                            <FeatureBadge icon={<Share2 size={16} />} text="Live Chat" />
                        </div>
                    </div>

                    {/* Slider & Card */}
                    <div className="flex gap-6 items-start h-[380px]">
                        {/* Static Profile Card */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }}
                            className="w-[220px] bg-white/70 dark:bg-black/70 backdrop-blur-xl rounded-3xl p-4 shadow-2xl border border-white/30 dark:border-white/10 rotate-[-3deg]"
                        >
                            <div className="w-full h-28 rounded-2xl bg-gradient-to-tr from-crimson to-orange-500 mb-4 relative overflow-hidden" />
                            <div className="flex justify-between items-end -mt-10 px-2 mb-3 relative z-10">
                                <div className="w-14 h-14 rounded-full bg-black border-4 border-white dark:border-black" />
                                <button className="bg-black dark:bg-white text-white dark:text-black px-3 py-1 rounded-full text-[10px] font-bold">Follow</button>
                            </div>
                            <div className="px-2 pb-2">
                                <div className="font-bold text-gray-900 dark:text-white text-base">Yajal Patel</div>
                                <div className="text-gray-500 text-[10px] mb-3">@yajal • Admin</div>
                                <div className="flex gap-3 text-xs font-semibold text-gray-800 dark:text-gray-200">
                                    <span>12k Followers</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Vertical Feed Slider */}
                        <div className="flex-1 h-full overflow-hidden relative mask-gradient-vertical">
                            {/* Gradients to fade slider top/bottom */}
                            <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-transparent to-transparent z-20" />

                            <motion.div
                                animate={{ y: [0, -400] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                                className="flex flex-col gap-3 pt-10"
                            >
                                {[...MOCK_POSTS, ...MOCK_POSTS, ...MOCK_POSTS].map((post, i) => (
                                    <div key={i} className="bg-white/60 dark:bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/20 dark:border-white/5 shadow-sm flex gap-3 items-center">
                                        <div className={`w-8 h-8 rounded-full ${post.color} flex items-center justify-center text-white font-bold text-[10px]`}>{post.user[0]}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between"><span className="text-xs font-bold text-gray-900 dark:text-white">{post.user}</span></div>
                                            <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-1">{post.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-gray-500 relative z-10">© 2025 Desi Sanchar.</div>
            </div>

            {/* ============================================== */}
            {/* RIGHT SIDE: FORM (Glassmorphism)               */}
            {/* ============================================== */}
            <div className="w-full lg:w-1/2 relative z-10 flex items-center justify-center p-6 md:p-12 bg-white/10 dark:bg-black/10 backdrop-blur-[5px]">
                <div className="w-full max-w-md">

                    {/* Mobile Header */}
                    <div className="lg:hidden flex flex-col items-center mb-8">
                        <div className="relative w-20 h-20 mb-4 drop-shadow-2xl">
                            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-center">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-crimson via-nebula to-crimson animate-gradient bg-300%">
                                DESI SANCHAR
                            </span>
                        </h1>
                    </div>

                    <div className="hidden lg:block text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {isSignUp ? "Join the Community" : "Welcome Back"}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                            {isSignUp ? "Create an account to start sharing." : "Enter your details to access your account."}
                        </p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                className="mb-6 p-4 rounded-xl bg-red-50/90 dark:bg-red-900/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-center font-semibold text-sm backdrop-blur-sm"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {isSignUp && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                                    <Input icon={<User size={20} />} type="text" placeholder="Username" value={username} onChange={setUsername} />
                                    <Input icon={<User size={20} />} type="text" placeholder="Full Name" value={fullName} onChange={setFullName} />
                                    <Input icon={<Mail size={20} />} type="email" placeholder="Email Address" value={email} onChange={setEmail} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!isSignUp && (
                            /* LOGIN FIELD: Accepts Email or Username */
                            <Input
                                icon={identifier.includes('@') ? <Mail size={20} /> : <User size={20} />}
                                type="text"
                                placeholder="Email or Username"
                                value={identifier}
                                onChange={setIdentifier}
                            />
                        )}

                        <Input icon={<Lock size={20} />} type="password" placeholder="Password" value={password} onChange={setPassword} />

                        <motion.button
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} disabled={loading}
                            className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-crimson to-red-600 hover:to-red-700 text-white font-bold shadow-lg shadow-crimson/30 flex items-center justify-center gap-2 transition-all"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <>{isSignUp ? "Create Account" : "Sign In"} <ArrowRight size={20} /></>}
                        </motion.button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {isSignUp ? "Already have an account?" : "New here?"}
                            <button
                                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                                className="ml-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-nebula to-sky hover:brightness-125 transition-all"
                            >
                                {isSignUp ? "Log In" : "Sign Up"}
                            </button>
                        </p>
                    </div>
                </div>
            </div>

        </div>
    )
}

function FeatureBadge({ icon, text }: any) {
    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-black/50 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-full shadow-sm">
            <div className="text-crimson">{icon}</div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{text}</span>
        </div>
    )
}

function Input({ icon, type, placeholder, value, onChange }: any) {
    return (
        <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-crimson transition-colors z-10">
                {icon}
            </div>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                className="w-full bg-white/50 dark:bg-black/40 backdrop-blur-md border border-gray-200 dark:border-white/10 
        rounded-xl py-4 pl-12 pr-4 text-gray-900 dark:text-white placeholder-gray-500 
        outline-none focus:border-crimson focus:ring-1 focus:ring-crimson transition-all"
            />
        </div>
    )
}