'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Home, Search, Bell, User, LogOut, PlusSquare,
  Heart, MessageCircle, Share2, Music, MoreHorizontal, Sun, Moon,
  Radio, TrendingUp, Mic2, PlayCircle, Image as ImageIcon, X, Send, UserPlus
} from 'lucide-react'
import { useTheme } from "next-themes"
import heic2any from "heic2any"

// Helper: Relative Time
function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + "y"
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + "mo"
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + "d"
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + "h"
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + "m"
  return "now"
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [showHeader, setShowHeader] = useState(true)
  const lastScrollY = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // === NOTIFICATION STATES ===
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setMounted(true)
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      fetchPosts(user.id)
      fetchNotifications(user.id)
      fetchFollowingList(user.id)

      const channel = supabase
        .channel('realtime-notifications')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => {
            fetchNotifications(user.id)
          }
        )
        .subscribe()

      setLoading(false)
      return () => { supabase.removeChannel(channel) }
    }
    getData()
  }, [router, supabase])

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
          setShowHeader(false)
        } else {
          setShowHeader(true)
        }
        lastScrollY.current = currentScrollY
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const fetchPosts = async (currentUserId: string) => {
    const { data } = await supabase.from('posts').select(`*, profiles:user_id (username, avatar_url), likes (user_id), comments (id)`).order('created_at', { ascending: false })
    if (data) {
      const formattedPosts = data.map((post: any) => ({
        ...post,
        isLiked: post.likes ? post.likes.some((like: any) => like.user_id === currentUserId) : false,
        likesCount: post.likes ? post.likes.length : 0,
        commentsCount: post.comments ? post.comments.length : 0
      }))
      setPosts(formattedPosts)
    }
  }

  const fetchFollowingList = async (userId: string) => {
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
    if (data) {
      const ids = new Set(data.map((item: any) => item.following_id))
      setFollowingIds(ids)
    }
  }

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase.from('notifications').select(`*, actor:actor_id(username, avatar_url)`).eq('user_id', userId).order('created_at', { ascending: false })
    if (data) {
      setNotifications(data)
      const count = data.filter((n: any) => n.is_read === false).length
      setUnreadCount(count)
    }
  }

  const markNotificationsRead = async () => {
    if (unreadCount > 0 && user) {
      setUnreadCount(0)
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  const toggleNotificationSlider = () => {
    if (!showNotifications) {
      setShowNotifications(true)
      markNotificationsRead()
    } else {
      setShowNotifications(false)
    }
  }

  const handleNotificationClick = (notif: any) => {
    if (notif.type === 'follow') {
      router.push(`/profile/${notif.actor_id}`)
      setShowNotifications(false)
    } else if (notif.post_id) {
      setActivePostId(notif.post_id)
      setShowNotifications(false)
    }
  }

  const handleFollowBack = async (e: any, actorId: string) => {
    e.stopPropagation()
    await supabase.from('follows').insert({ follower_id: user.id, following_id: actorId })
    await supabase.from('notifications').insert({
      user_id: actorId,
      actor_id: user.id,
      type: 'follow',
      message: 'followed you back.'
    })
    setFollowingIds(prev => new Set(prev).add(actorId))
  }

  const handleCreatePost = async () => {
    if (!content.trim() && !imageFile) return
    setIsPosting(true)
    try {
      let imageUrl = null
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('post_images').upload(fileName, imageFile)
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('post_images').getPublicUrl(fileName)
        imageUrl = publicUrl
      }
      const { error } = await supabase.from('posts').insert({ user_id: user.id, content: content, image_url: imageUrl })
      if (error) throw error
      setContent('')
      setImageFile(null)
      setImagePreview(null)
      fetchPosts(user.id)
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setIsPosting(false)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      let file = e.target.files[0]

      // 1. Check if it's HEIC (iPhone format)
      if (file.name.toLowerCase().endsWith('.heic') || file.type === "image/heic") {
        try {
          setLoading(true) // Show loading while converting
          const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.8
          }) as Blob

          // Convert Blob back to File
          file = new File([convertedBlob], file.name.replace(/\.heic$/i, ".jpg"), {
            type: "image/jpeg",
          })
          setLoading(false)
        } catch (error) {
          alert("Error converting HEIC image.")
          setLoading(false)
          return
        }
      }

      // 2. Size Check (Limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too big! Please select an image under 5MB.")
        return
      }

      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const goToMyProfile = () => { if (user?.id) router.push(`/profile/${user.id}`) }

  if (loading || !mounted) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><div className="w-10 h-10 border-4 border-crimson border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white transition-colors duration-500 overflow-x-hidden">

      {/* BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse duration-[5000ms]" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[500px] h-[500px] bg-crimson/20 rounded-full blur-[100px] animate-pulse duration-[7000ms]" />
      </div>

      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-[280px] flex-col border-r border-gray-200 dark:border-white/5 bg-white/60 dark:bg-black/60 backdrop-blur-xl z-30 shadow-xl shadow-black/5">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8 hover:scale-105 transition-transform cursor-pointer">
            <div className="w-10 h-10 relative drop-shadow-lg"><Image src="/logo.png" alt="Logo" fill className="object-contain" /></div>
            <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-crimson to-nebula drop-shadow-sm">DESI SANCHAR</span>
          </div>
          <nav className="space-y-2">
            <NavItem icon={<Home size={26} />} text="Home" active />
            <NavItem icon={<Search size={26} />} text="Explore" />
            <NavItem icon={<Mic2 size={26} />} text="Karaoke Mode" />

            <NavItem
              icon={<Bell size={26} />}
              text="Notifications"
              onClick={toggleNotificationSlider}
              badge={unreadCount > 0} // PASS BOOLEAN NOW
            />

            <NavItem icon={<User size={26} />} text="Profile" onClick={goToMyProfile} />
          </nav>
          <div className="mt-8">
            <button className="w-full bg-gradient-to-r from-crimson to-rose-600 hover:from-rose-600 hover:to-crimson text-white font-bold py-3.5 rounded-full shadow-lg shadow-crimson/30 transition-all hover:shadow-crimson/50 hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2">
              <PlusSquare size={20} /><span>Create Post</span>
            </button>
          </div>
        </div>
        <div className="mt-auto p-4 border-t border-gray-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3 px-2 cursor-pointer group" onClick={goToMyProfile}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-crimson to-orange-500 flex items-center justify-center text-white font-bold text-lg ring-2 ring-transparent group-hover:ring-crimson transition-all">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="font-bold text-sm truncate group-hover:text-crimson transition-colors">{user?.user_metadata?.username || "User"}</div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 flex items-center justify-center gap-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 py-2 rounded-lg transition-all active:scale-95 text-xs font-bold">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-crimson py-2 rounded-lg transition-all active:scale-95 text-xs font-bold">
              <LogOut size={16} /> Exit
            </button>
          </div>
        </div>
      </aside>

      {/* FEED */}
      <main className="w-full min-h-screen lg:pl-[280px] xl:pr-[350px] relative z-10">

        {/* Mobile Header */}
        <div className={`lg:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl p-4 flex justify-between items-center border-b border-gray-200 dark:border-white/5 z-40 w-full transition-all duration-500 ease-in-out ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 relative"><Image src="/logo.png" alt="Logo" fill className="object-contain" /></div>
            <h1 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-crimson to-nebula">DESI SANCHAR</h1>
          </div>
          <div className="flex gap-3 items-center">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 active:scale-90 transition-transform">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div onClick={goToMyProfile} className="w-8 h-8 rounded-full bg-crimson flex items-center justify-center text-white font-bold text-sm cursor-pointer shadow-lg active:scale-90 transition-transform">
              {user?.email?.[0].toUpperCase()}
            </div>
          </div>
        </div>

        <div className="max-w-[700px] mx-auto w-full pb-20 pt-20 lg:pt-6 px-4 md:px-6">
          <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar mb-4 w-full snap-x snap-mandatory">
            <StoryItem isAdd />
            <StoryItem name="Arijit" img="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" />
            <StoryItem name="Neha" img="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" />
            <StoryItem name="Badshah" img="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&q=80" />
            <StoryItem name="Shreya" img="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" />
          </div>

          <div className="bg-white/80 dark:bg-[#111]/80 backdrop-blur-sm rounded-3xl p-4 shadow-lg shadow-black/5 border border-gray-200 dark:border-white/5 mb-8 hover:border-crimson/30 transition-colors duration-300">
            <div className="flex gap-4">
              <div onClick={goToMyProfile} className="w-11 h-11 rounded-full bg-gradient-to-tr from-crimson to-nebula flex-shrink-0 flex items-center justify-center text-white font-bold cursor-pointer hover:rotate-6 transition-transform">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div className="w-full">
                <input type="text" value={content} onChange={(e) => setContent(e.target.value)} placeholder="What's playing in your mind?" className="w-full bg-transparent outline-none text-lg placeholder-gray-500 mb-2" />
                {imagePreview && (
                  <div className="relative w-full h-64 rounded-xl overflow-hidden mb-2 animate-in zoom-in-95 duration-300">
                    <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    <button onClick={() => { setImageFile(null); setImagePreview(null) }} className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white hover:bg-black/70 transition-colors"><X size={16} /></button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100 dark:border-white/5">
              <div className="flex gap-4 text-crimson">
                <button className="hover:bg-crimson/10 p-2 rounded-full transition-colors active:scale-90"><Music size={22} /></button>
                <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
                <button onClick={() => fileInputRef.current?.click()} className="hover:bg-crimson/10 p-2 rounded-full transition-colors active:scale-90"><ImageIcon size={22} /></button>
                <button className="hover:bg-crimson/10 p-2 rounded-full transition-colors active:scale-90"><Mic2 size={22} /></button>
              </div>
              <button onClick={handleCreatePost} disabled={isPosting} className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded-full font-bold text-sm hover:opacity-80 disabled:opacity-50 active:scale-95 transition-all">
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {posts.map((post, index) => (
              <div key={post.id} className="animate-in slide-in-from-bottom-4 fade-in duration-700" style={{ animationDelay: `${index * 100}ms` }}>
                <PostCard
                  post={post}
                  currentUser={user}
                  onOpenComments={() => setActivePostId(post.id)}
                />
              </div>
            ))}
            {posts.length === 0 && <div className="text-center text-gray-500 py-10 animate-pulse">No posts yet. Be the first to share something!</div>}
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="hidden xl:block fixed top-0 right-0 h-screen w-[350px] p-6 space-y-6 overflow-y-auto z-30 border-l border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#050505]/50 backdrop-blur-xl">
        <div className="relative group transition-all focus-within:scale-105 duration-300">
          <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-crimson transition-colors" size={20} />
          <input type="text" placeholder="Search Desi Sanchar..." className="w-full bg-gray-100 dark:bg-white/5 border-none rounded-full py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-crimson transition-all shadow-sm" />
        </div>
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-5 text-white relative overflow-hidden shadow-2xl shadow-indigo-500/20 group hover:-translate-y-1 transition-transform duration-300">
          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity"><Radio size={80} /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-red-300">Live Now</span>
            </div>
            <h3 className="text-xl font-bold mb-1">Mirchi Top 20</h3>
            <p className="text-indigo-200 text-sm mb-4">RJ Nidhi • 12k Listening</p>
            <button className="bg-white text-indigo-900 w-full py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 active:scale-95 transition-all">
              <PlayCircle size={18} /> Tune In
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-[#111] rounded-3xl p-5 shadow-sm border border-gray-200 dark:border-white/5 hover:border-crimson/20 transition-colors">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-crimson animate-bounce" /> Trending in India</h3>
          <div className="space-y-4">
            <TrendItem category="Music" tag="#ArijitLive" posts="125k" />
            <TrendItem category="Sports" tag="#INDvsPAK" posts="890k" />
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 flex justify-around p-3 z-50 transition-transform duration-500 ease-in-out ${showHeader ? 'translate-y-0' : 'translate-y-full'}`}>
        <Home size={26} className="text-crimson cursor-pointer active:scale-75 transition-transform" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        <Search size={26} className="text-gray-400 cursor-pointer active:scale-75 transition-transform" />
        <PlusSquare size={32} className="text-gray-400 cursor-pointer active:scale-75 transition-transform -mt-1 text-crimson" />
        <div className="relative active:scale-75 transition-transform">
          <Bell size={26} className="text-gray-400 cursor-pointer" onClick={toggleNotificationSlider} />
          {unreadCount > 0 && <span className="absolute top-0 right-0 bg-crimson w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black animate-pulse" />}
        </div>
        <User size={26} className="text-gray-400 cursor-pointer active:scale-75 transition-transform" onClick={goToMyProfile} />
      </div>

      {activePostId && (
        <CommentsModal postId={activePostId} currentUser={user} onClose={() => setActivePostId(null)} />
      )}

      {/* === NOTIFICATION PANEL === */}
      <div
        className={`fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${showNotifications ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleNotificationSlider}
      >
        <div
          className={`
               fixed bg-white dark:bg-[#111] shadow-2xl z-[110] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
               lg:top-0 lg:h-full lg:w-[350px] lg:border-r lg:border-gray-200 lg:dark:border-white/5 
               ${showNotifications ? 'lg:translate-x-0' : 'lg:-translate-x-full'}
               lg:left-0 bottom-0 left-0 w-full h-[60vh] rounded-t-3xl
               ${showNotifications ? 'translate-y-0' : 'translate-y-full'}
             `}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center sticky top-0 bg-white dark:bg-[#111] z-10 rounded-t-3xl lg:rounded-none">
            <h2 className="font-bold text-lg">Notifications</h2>
            <button onClick={toggleNotificationSlider} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full active:rotate-90 transition-transform"><X size={20} /></button>
          </div>

          <div className="p-2 space-y-1 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar">
            {notifications.map((notif, index) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 rounded-xl flex gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all ${notif.is_read ? 'opacity-70' : 'bg-crimson/5 border border-crimson/10'}`}
              >
                <div className="mt-1">
                  {notif.type === 'like' && <Heart size={18} className="text-red-500 fill-red-500 animate-bounce" />}
                  {notif.type === 'comment' && <MessageCircle size={18} className="text-blue-500 fill-blue-500" />}
                  {notif.type === 'follow' && <UserPlus size={18} className="text-green-500 fill-green-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gray-200 relative overflow-hidden">
                        {notif.actor?.avatar_url ? <Image src={notif.actor.avatar_url} fill alt="u" /> : null}
                      </div>
                      <span className="font-bold text-sm">{notif.actor?.username}</span>
                    </div>

                    {notif.type === 'follow' && !followingIds.has(notif.actor_id) && (
                      <button
                        onClick={(e) => handleFollowBack(e, notif.actor_id)}
                        className="text-[10px] font-bold bg-crimson text-white px-3 py-1.5 rounded-full hover:bg-red-600 transition-colors shadow-sm active:scale-95"
                      >
                        Follow Back
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{notif.message}</p>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium">{timeAgo(notif.created_at)}</p>
                </div>
              </div>
            ))}
            {notifications.length === 0 && <div className="text-center py-10 text-gray-500">No notifications yet.</div>}
          </div>
        </div>
      </div>

    </div>
  )
}

// ==========================================
// SUB COMPONENTS
// ==========================================

function StoryItem({ name, img, isAdd }: any) {
  return (
    <div className="flex flex-col items-center space-y-2 min-w-[70px] cursor-pointer group snap-center">
      <div className={`w-16 h-16 rounded-full p-[2px] ${isAdd ? 'border-2 border-dashed border-gray-300' : 'bg-gradient-to-tr from-yellow-400 via-crimson to-purple-600 group-hover:rotate-12 transition-transform duration-500'}`}>
        <div className="w-full h-full rounded-full border-2 border-white dark:border-black overflow-hidden relative bg-gray-200 dark:bg-gray-800 flex items-center justify-center transition-transform group-hover:scale-95">
          {isAdd ? <PlusSquare size={24} className="text-gray-400" /> : <Image src={img} alt="story" fill className="object-cover" unoptimized />}
        </div>
      </div>
      <span className="text-xs font-medium truncate w-16 text-center group-hover:text-crimson transition-colors">{isAdd ? "Add Story" : name}</span>
    </div>
  )
}

function PostCard({ post, currentUser, onOpenComments }: any) {
  const [isLiked, setIsLiked] = useState(post.isLiked)
  const [likesCount, setLikesCount] = useState(post.likesCount)
  const [animateLike, setAnimateLike] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const goToProfile = () => { router.push(`/profile/${post.user_id}`) }

  const toggleLike = async () => {
    const newIsLiked = !isLiked
    setIsLiked(newIsLiked)
    setLikesCount(prev => newIsLiked ? prev + 1 : prev - 1)

    if (newIsLiked) {
      setAnimateLike(true)
      setTimeout(() => setAnimateLike(false), 300)
      await supabase.from('likes').insert({ user_id: currentUser.id, post_id: post.id })

      if (currentUser.id !== post.user_id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: currentUser.id,
          type: 'like',
          message: `liked your post.`,
          post_id: post.id
        })
      }
    } else {
      await supabase.from('likes').delete().match({ user_id: currentUser.id, post_id: post.id })
    }
  }

  return (
    <div className="bg-white/90 dark:bg-[#111]/90 backdrop-blur-sm rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden hover:shadow-lg hover:border-crimson/20 transition-all duration-300">
      <div className="flex justify-between items-start p-4 pb-2">
        <div className="flex gap-3">
          <div onClick={goToProfile} className="w-10 h-10 rounded-full bg-gradient-to-tr from-crimson to-nebula flex items-center justify-center text-white font-bold overflow-hidden cursor-pointer hover:scale-110 transition-transform">
            {post.profiles?.avatar_url ? <Image src={post.profiles.avatar_url} alt="user" width={40} height={40} unoptimized /> : post.profiles?.username[0]?.toUpperCase()}
          </div>
          <div>
            <h4 onClick={goToProfile} className="font-bold text-base hover:underline cursor-pointer text-gray-900 dark:text-white">{post.profiles?.username}</h4>
            <span className="text-gray-500 text-sm">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        <button className="text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors"><MoreHorizontal size={20} /></button>
      </div>

      <div className="px-4 pb-3">
        <p className="mb-3 text-[17px] leading-relaxed">{post.content}</p>
        {post.song_title && (
          <div className="inline-flex items-center gap-2 bg-crimson/5 border border-crimson/20 rounded-xl px-3 py-2 mb-2 w-full">
            <div className="w-8 h-8 bg-crimson/10 rounded-lg flex items-center justify-center"><Music size={16} className="text-crimson animate-pulse" /></div>
            <div className="flex-1"><div className="text-xs font-bold text-crimson">{post.song_title}</div></div>
            <PlayCircle size={20} className="text-crimson" />
          </div>
        )}
      </div>

      {post.image_url && (
        <div className="w-full h-[400px] relative bg-gray-100 dark:bg-black group">
          <Image src={post.image_url} alt="Post" fill className="object-cover transition-transform duration-700 group-hover:scale-105" unoptimized />
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-white/5 mt-2">
        <div className="flex gap-8">
          <button onClick={toggleLike} className={`flex items-center gap-2 transition-colors group ${isLiked ? 'text-crimson' : 'text-gray-500 hover:text-crimson'}`}>
            <div className={`p-2 rounded-full group-hover:bg-crimson/10 transition-transform ${animateLike ? 'scale-125' : 'active:scale-90'}`}>
              <Heart size={22} fill={isLiked ? "currentColor" : "none"} className={isLiked && animateLike ? 'animate-ping' : ''} />
            </div>
            <span className="text-sm font-medium">{likesCount}</span>
          </button>
          <button onClick={onOpenComments} className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors group">
            <div className="p-2 rounded-full group-hover:bg-blue-500/10 active:scale-90 transition-transform"><MessageCircle size={22} /></div>
            <span className="text-sm font-medium">{post.commentsCount}</span>
          </button>
          <ActionBtn icon={<Share2 size={22} />} count="" />
        </div>
      </div>
    </div>
  )
}

function CommentsModal({ postId, currentUser, onClose }: any) {
  const [comments, setComments] = useState<any[]>([])
  const [postDetails, setPostDetails] = useState<any>(null)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchComments()
    fetchPostDetails()
  }, [])

  const fetchPostDetails = async () => {
    const { data } = await supabase.from('posts').select(`*, profiles:user_id (username, avatar_url)`).eq('id', postId).single()
    if (data) setPostDetails(data)
  }

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select(`*, profiles:user_id (username, avatar_url), posts(user_id)`).eq('post_id', postId).order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  const handleSendComment = async () => {
    if (!newComment.trim()) return
    const { data: insertedComment, error } = await supabase.from('comments').insert({ post_id: postId, user_id: currentUser.id, content: newComment, parent_id: replyTo?.id || null }).select('*, posts(user_id)').single()

    if (!error && insertedComment) {
      setNewComment(''); setReplyTo(null); fetchComments()
      const postOwnerId = insertedComment.posts?.user_id
      if (postOwnerId && currentUser.id !== postOwnerId) {
        await supabase.from('notifications').insert({
          user_id: postOwnerId,
          actor_id: currentUser.id,
          type: 'comment',
          message: `commented: "${newComment.substring(0, 20)}..."`,
          post_id: postId
        })
      }
    }
  }

  const rootComments = comments.filter(c => !c.parent_id)
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId)

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#090909] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
          <h2 className="font-bold text-lg">Post Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full active:rotate-90 transition-transform"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {postDetails && (
            <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 relative overflow-hidden">
                  {postDetails.profiles?.avatar_url ? <Image src={postDetails.profiles.avatar_url} fill alt="u" /> : null}
                </div>
                <span className="font-bold text-sm">{postDetails.profiles?.username}</span>
                <span className="text-xs text-gray-500">• {timeAgo(postDetails.created_at)}</span>
              </div>
              <p className="text-sm mb-3">{postDetails.content}</p>
              {postDetails.image_url && (
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-black mb-2">
                  <Image src={postDetails.image_url} fill className="object-cover" alt="post" unoptimized />
                </div>
              )}
            </div>
          )}

          <div className="p-4 space-y-6">
            <h3 className="font-bold text-sm text-gray-500">Comments ({comments.length})</h3>
            {rootComments.map(comment => (
              <div key={comment.id} className="animate-in slide-in-from-bottom-2 fade-in">
                <CommentItem comment={comment} onReply={(c: any) => setReplyTo(c)} />
                <div className="pl-8 mt-3 space-y-3 border-l-2 border-gray-100 dark:border-white/5 ml-2">
                  {getReplies(comment.id).map(reply => (<CommentItem key={reply.id} comment={reply} onReply={(c: any) => setReplyTo(c)} isReply />))}
                </div>
              </div>
            ))}
            {rootComments.length === 0 && <div className="text-center text-gray-500 mt-10">No comments yet. Start the conversation!</div>}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/40">
          {replyTo && <div className="flex justify-between items-center text-xs text-blue-500 mb-2 px-2 animate-pulse"><span>Replying to @{replyTo.profiles?.username}</span><button onClick={() => setReplyTo(null)}><X size={12} /></button></div>}
          <div className="flex gap-2">
            <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendComment()} placeholder={replyTo ? "Write a reply..." : "Add a comment..."} className="flex-1 bg-white dark:bg-[#151515] border border-gray-200 dark:border-white/10 rounded-full px-4 py-2 text-sm outline-none focus:border-crimson transition-all focus:scale-[1.01]" />
            <button onClick={handleSendComment} className="p-2 bg-crimson text-white rounded-full hover:scale-105 active:scale-90 transition-transform"><Send size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentItem({ comment, onReply, isReply }: any) {
  return (
    <div className="flex gap-3">
      <div className={`rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center font-bold text-xs ${isReply ? 'w-6 h-6' : 'w-8 h-8'}`}>
        {comment.profiles?.avatar_url ? <Image src={comment.profiles.avatar_url} width={32} height={32} alt="u" className="rounded-full" /> : comment.profiles?.username[0].toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2"><span className="font-bold text-sm">{comment.profiles?.username}</span><span className="text-gray-500 text-xs">{timeAgo(comment.created_at)}</span></div>
        <p className="text-sm text-gray-800 dark:text-gray-300 mt-0.5">{comment.content}</p>
        <button onClick={() => onReply(comment)} className="text-xs font-bold text-gray-500 mt-1 hover:text-crimson flex items-center gap-1 transition-colors">Reply</button>
      </div>
    </div>
  )
}

function NavItem({ icon, text, active, badge, onClick }: any) {
  return (
    <div onClick={onClick} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-300 group hover:scale-105 ${active ? 'bg-crimson/10 text-crimson font-bold shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}>
      <div className="relative group-hover:rotate-6 transition-transform">
        {icon}
        {badge && <span className="absolute top-0 right-0 bg-crimson w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black animate-pulse" />}
      </div>
      <span className="text-xl tracking-tight">{text}</span>
    </div>
  )
}

function TrendItem({ category, tag, posts }: any) {
  return (
    <div className="flex justify-between items-start cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors">
      <div><div className="text-xs text-gray-500 mb-0.5">{category} • Trending</div><div className="font-bold text-sm group-hover:text-crimson transition-colors">{tag}</div><div className="text-xs text-gray-400">{posts} posts</div></div><MoreHorizontal size={16} className="text-gray-300 group-hover:text-white transition-colors" />
    </div>
  )
}

function ActionBtn({ icon, count }: any) {
  return (
    <button className="flex items-center gap-2 text-gray-500 hover:text-crimson transition-colors group active:scale-95"><div className="p-2 rounded-full group-hover:bg-crimson/10 transition-colors">{icon}</div>{count && <span className="text-sm font-medium">{count}</span>}</button>
  )
}