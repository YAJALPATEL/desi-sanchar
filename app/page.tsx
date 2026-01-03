
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Home, Search, Bell, User, LogOut, PlusSquare,
  Heart, MessageCircle, Share2, Music, MoreHorizontal, Sun, Moon,
  Radio, TrendingUp, Mic2, PlayCircle, Image as ImageIcon, X, Send, UserPlus, MapPin,
  Eye, Trash2, ChevronUp
} from 'lucide-react'
import { useTheme } from "next-themes"

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

  // === STORY STATES ===
  const [stories, setStories] = useState<any[]>([])
  const [uniqueUserStories, setUniqueUserStories] = useState<any[]>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [initialStoryIndex, setInitialStoryIndex] = useState(0)

  const [loading, setLoading] = useState(true)
  const [activePostId, setActivePostId] = useState<string | null>(null)
  const [showHeader, setShowHeader] = useState(true)
  const lastScrollY = useRef(0)
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Notifications
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

      const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
      const fIds = new Set(follows?.map((i: any) => i.following_id) || [])
      setFollowingIds(fIds)

      fetchPosts(user.id)
      fetchNotifications(user.id)
      fetchStories(user.id, fIds)

      const channel = supabase.channel('realtime-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchNotifications(user.id))
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
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) setShowHeader(false)
        else setShowHeader(true)
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

  const fetchStories = async (currentUserId: string, fIds: Set<string>) => {
    const { data } = await supabase
      .from('stories')
      .select(`*, profiles:user_id (id, username, avatar_url)`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (data) {
      const relevantStories = data.filter((s: any) => fIds.has(s.user_id) || s.user_id === currentUserId)

      const groupedStories = relevantStories.sort((a: any, b: any) => {
        if (a.user_id === b.user_id) return 0;
        return a.user_id > b.user_id ? 1 : -1;
      })

      setStories(groupedStories)

      const unique = groupedStories.reduce((acc: any[], current: any) => {
        if (!acc.find(item => item.user_id === current.user_id)) {
          return acc.concat([current]);
        }
        return acc;
      }, []);
      setUniqueUserStories(unique)
    }
  }

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase.from('notifications').select(`*, actor:actor_id(username, avatar_url)`).eq('user_id', userId).order('created_at', { ascending: false })
    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter((n: any) => !n.is_read).length)
    }
  }

  const markNotificationsRead = async () => {
    if (unreadCount > 0 && user) {
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
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
    if (notif.type === 'follow') router.push(`/profile/${notif.actor_id}`)
    else if (notif.post_id) setActivePostId(notif.post_id)
    setShowNotifications(false)
  }

  const handleLogout = async (e: any) => {
    e.stopPropagation()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const goToMyProfile = () => { if (user?.id) router.push(`/profile/${user.id}`) }
  const goToCreatePost = () => { router.push('/create') }
  const goToAddStory = () => { router.push('/story/create') }

  const openStoryViewer = (startStoryId: string) => {
    const index = stories.findIndex(s => s.id === startStoryId)
    if (index !== -1) {
      setInitialStoryIndex(index)
      setViewerOpen(true)
    }
  }

  if (loading || !mounted) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><div className="w-10 h-10 border-4 border-crimson border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white transition-colors duration-500 overflow-x-hidden">

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden"><div className="absolute -top-[10%] -right-[10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse" /><div className="absolute -bottom-[10%] -left-[10%] w-[500px] h-[500px] bg-crimson/20 rounded-full blur-[100px] animate-pulse" /></div>

      {/* === LEFT SIDEBAR === */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-[280px] flex-col border-r border-gray-200 dark:border-white/5 bg-white/60 dark:bg-black/60 backdrop-blur-xl z-30 shadow-xl shadow-black/5">
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 relative"><Image src="/logo.png" alt="Logo" fill className="object-contain" unoptimized /></div><span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-crimson to-nebula">DESI SANCHAR</span></div>
          <nav className="space-y-2 flex-1">
            <NavItem icon={<Home size={26} />} text="Home" active />
            <NavItem icon={<Search size={26} />} text="Explore" />
            <NavItem icon={<Mic2 size={26} />} text="Karaoke Mode" />
            <NavItem icon={<Bell size={26} />} text="Notifications" onClick={toggleNotificationSlider} badge={unreadCount > 0} />
            <NavItem icon={<User size={26} />} text="Profile" onClick={goToMyProfile} />
          </nav>
          <div className="mt-auto">
            <div className="mb-6"><button onClick={goToCreatePost} className="w-full bg-gradient-to-r from-crimson to-rose-600 text-white font-bold py-3.5 rounded-full shadow-lg flex items-center justify-center gap-2"><PlusSquare size={20} /><span>Create Post</span></button></div>

            {/* Profile Card & Logout */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer group" onClick={goToMyProfile}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-crimson to-orange-500 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white dark:bg-black overflow-hidden relative flex items-center justify-center text-xs font-bold">
                    {user?.user_metadata?.avatar_url ? <Image src={user.user_metadata.avatar_url} fill className="object-cover" alt="u" unoptimized /> : user?.email?.[0].toUpperCase()}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm truncate w-24">{user?.user_metadata?.username || "User"}</span>
                  <span className="text-xs text-gray-500">@{user?.email?.split('@')[0]}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Logout">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* === MAIN CONTENT === */}
      <main className="w-full min-h-screen lg:pl-[280px] xl:pr-[350px] relative z-10">
        <div className={`lg:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-black/80 backdrop-blur-xl p-4 flex justify-between items-center border-b border-gray-200 dark:border-white/5 z-40 w-full ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
          <div className="flex items-center gap-2"><div className="w-8 h-8 relative"><Image src="/logo.png" alt="Logo" fill className="object-contain" unoptimized /></div><h1 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-crimson to-nebula">DESI SANCHAR</h1></div>
          <div className="flex gap-3 items-center"><div onClick={goToMyProfile} className="w-8 h-8 rounded-full bg-crimson flex items-center justify-center text-white font-bold text-sm cursor-pointer">{user?.email?.[0].toUpperCase()}</div></div>
        </div>

        <div className="max-w-[700px] mx-auto w-full pb-20 pt-20 lg:pt-6 px-4 md:px-6">
          <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar mb-4 w-full snap-x snap-mandatory">
            <StoryItem isAdd onClick={goToAddStory} />
            {uniqueUserStories.map((story) => (
              <StoryItem
                key={story.id}
                name={story.profiles?.username}
                img={story.profiles?.avatar_url}
                onClick={() => openStoryViewer(story.id)}
              />
            ))}
          </div>

          <div onClick={goToCreatePost} className="bg-white/80 dark:bg-[#111]/80 backdrop-blur-sm rounded-3xl p-4 shadow-lg mb-8 hover:border-crimson/30 transition-all cursor-pointer flex gap-4 items-center">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-crimson to-nebula flex-shrink-0 flex items-center justify-center text-white font-bold">{user?.email?.[0].toUpperCase()}</div>
            <div className="flex-1 bg-gray-100 dark:bg-white/5 rounded-full px-5 py-3 text-gray-500">What's playing in your mind?</div>
            <div className="p-2 bg-gray-100 dark:bg-white/5 rounded-full text-crimson"><ImageIcon size={20} /></div>
          </div>

          <div className="space-y-6">
            {posts.map((post, index) => (
              <div key={post.id} className="animate-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 100}ms` }}>
                <PostCard post={post} currentUser={user} onOpenComments={() => setActivePostId(post.id)} />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* === MOBILE BOTTOM NAV === */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-gray-200 dark:border-white/10 flex justify-around p-3 z-50 transition-transform duration-500 ease-in-out ${showHeader ? 'translate-y-0' : 'translate-y-full'}`}>
        <Home size={26} className="text-crimson active:scale-75 transition-transform" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        <Search size={26} className="text-gray-400 active:scale-75 transition-transform" />
        <PlusSquare size={32} className="text-gray-400 active:scale-75 transition-transform -mt-1 text-crimson" onClick={() => router.push('/create')} />
        <div className="relative active:scale-75 transition-transform"><Bell size={26} className="text-gray-400" onClick={toggleNotificationSlider} />{unreadCount > 0 && <span className="absolute top-0 right-0 bg-crimson w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black animate-pulse" />}</div>
        <User size={26} className="text-gray-400 active:scale-75 transition-transform" onClick={() => user && router.push(`/profile/${user.id}`)} />
      </div>

      {/* === RIGHT SIDEBAR === */}
      <aside className="hidden xl:block fixed top-0 right-0 h-screen w-[350px] p-6 space-y-6 overflow-y-auto z-30 border-l border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-[#050505]/50 backdrop-blur-xl">
        <div className="relative group">
          <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-crimson" size={20} />
          <input type="text" placeholder="Search..." className="w-full bg-gray-100 dark:bg-white/5 border-none rounded-full py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-crimson transition-all" />
        </div>

        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-3xl p-5 text-white relative overflow-hidden shadow-2xl group cursor-pointer">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><Radio size={12} className="animate-pulse" /> Live Radio</div>
              <MoreHorizontal size={20} className="text-white/50" />
            </div>
            <h3 className="text-2xl font-black mb-1">Mirchi Top 20</h3>
            <p className="text-indigo-200 text-sm mb-6">RJ Nidhi • 12k Listening</p>
            <button className="bg-white text-indigo-900 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg"><PlayCircle size={20} /> Tune In Now</button>
          </div>
        </div>

        {/* Trends */}
        <div className="bg-white/50 dark:bg-white/5 rounded-3xl p-5 border border-gray-100 dark:border-white/5">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-crimson" /> Trends for you</h3>
          <div className="space-y-1">
            <TrendItem category="Music" tag="#DiljitDosanjh" posts="54.2k" />
            <TrendItem category="Cinema" tag="#Pushpa2" posts="120k" />
            <TrendItem category="Tech" tag="#AIRevolution" posts="24k" />
            <TrendItem category="Sports" tag="#IPL2026" posts="89k" />
          </div>
        </div>
      </aside>

      {activePostId && <CommentsModal postId={activePostId} currentUser={user} onClose={() => setActivePostId(null)} />}

      <div className={`fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-700 ${showNotifications ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={toggleNotificationSlider}>
        <div className={`fixed bg-white dark:bg-[#111] shadow-2xl z-[110] transition-transform duration-700 lg:top-0 lg:h-full lg:w-[350px] lg:border-r lg:border-gray-200 lg:dark:border-white/5 ${showNotifications ? 'lg:translate-x-0' : 'lg:-translate-x-full'} lg:left-0 bottom-0 left-0 w-full h-[60vh] rounded-t-3xl ${showNotifications ? 'translate-y-0' : 'translate-y-full'}`} onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center sticky top-0 bg-white dark:bg-[#111] z-10"><h2 className="font-bold text-lg">Notifications</h2><button onClick={toggleNotificationSlider}><X size={20} /></button></div>
          <div className="p-2 space-y-1 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar">
            {notifications.map((notif) => (
              <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-4 rounded-xl flex gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${notif.is_read ? 'opacity-70' : 'bg-crimson/5'}`}>
                <div className="mt-1">{notif.type === 'like' && <Heart size={18} className="text-red-500" />}{notif.type === 'comment' && <MessageCircle size={18} className="text-blue-500" />}{notif.type === 'follow' && <UserPlus size={18} className="text-green-500" />}</div>
                <div className="flex-1"><div className="font-bold text-sm">{notif.actor?.username}</div><p className="text-sm">{notif.message}</p></div>
              </div>
            ))}
            {notifications.length === 0 && <div className="text-center py-10 text-gray-500">No notifications yet.</div>}
          </div>
        </div>
      </div>

      {viewerOpen && (
        <StoryViewer
          stories={stories}
          startIndex={initialStoryIndex}
          currentUser={user}
          onClose={() => setViewerOpen(false)}
        />
      )}

    </div>
  )
}

// ==========================================
// STORY VIEWER (Views Fix + Custom Delete)
// ==========================================
function StoryViewer({ stories, startIndex, currentUser, onClose }: any) {
  const [currentIndex, setCurrentIndex] = useState(startIndex)
  const [progress, setProgress] = useState(0)

  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [viewCount, setViewCount] = useState(0)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<any[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const supabase = createClient()
  const story = stories[currentIndex]
  const isOwner = story?.user_id === currentUser?.id

  // Progress logic
  const currentOwnerId = story?.user_id
  const userStories = stories.filter((s: any) => s.user_id === currentOwnerId)
  const localIndex = userStories.findIndex((s: any) => s.id === story?.id)

  useEffect(() => {
    if (!story) return
    setProgress(0)
    setIsLiked(false)
    setLikeCount(0)
    setViewCount(0)
    setIsPaused(false)
    setShowDeleteConfirm(false)

    const recordViewAndFetchStats = async () => {
      // Record View
      if (!isOwner) {
        await supabase.from('story_views').insert({ story_id: story.id, user_id: currentUser.id }).catch(() => { })
      }
      // Get Counts
      const { count: vCount } = await supabase.from('story_views').select('*', { count: 'exact', head: true }).eq('story_id', story.id)
      setViewCount(vCount || 0)

      const { count: lCount } = await supabase.from('story_likes').select('*', { count: 'exact', head: true }).eq('story_id', story.id)
      setLikeCount(lCount || 0)

      const { data: likeData } = await supabase.from('story_likes').select('*').eq('story_id', story.id).eq('user_id', currentUser.id).single()
      if (likeData) setIsLiked(true)
    }
    recordViewAndFetchStats()
  }, [currentIndex, story])

  useEffect(() => {
    if (!story || showAnalytics || isPaused || showDeleteConfirm) return
    if (story.media_type === 'video') return

    const durationMs = (story.duration || 5) * 1000
    const intervalMs = 50
    const step = 100 / (durationMs / intervalMs)

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer)
          handleNext()
          return 100
        }
        return prev + step
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [currentIndex, story, showAnalytics, isPaused, showDeleteConfirm])

  const handleNext = () => {
    if (currentIndex < stories.length - 1) setCurrentIndex((p: number) => p + 1)
    else onClose()
  }

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((p: number) => p - 1)
  }

  const toggleLike = async () => {
    const newStatus = !isLiked
    setIsLiked(newStatus)
    setLikeCount((prev) => newStatus ? prev + 1 : prev - 1)

    if (newStatus) {
      await supabase.from('story_likes').insert({ story_id: story.id, user_id: currentUser.id })
      if (!isOwner) await supabase.from('notifications').insert({ user_id: story.user_id, actor_id: currentUser.id, type: 'like', message: 'liked your story.' })
    } else {
      await supabase.from('story_likes').delete().match({ story_id: story.id, user_id: currentUser.id })
    }
  }

  const performDelete = async () => {
    const { error } = await supabase.from('stories').delete().eq('id', story.id)
    if (!error) {
      onClose()
      window.location.reload()
    } else {
      alert("Error: " + error.message)
    }
  }

  // === SAFE ANALYTICS FETCH (Prevents 400 Error & Fixes Empty List) ===
  const openAnalytics = async () => {
    setIsPaused(true)
    setShowAnalytics(true)

    try {
      // 1. Fetch View IDs
      const { data: views, error: vError } = await supabase
        .from('story_views')
        .select('user_id, created_at')
        .eq('story_id', story.id)
        .order('created_at', { ascending: false })

      if (vError || !views || views.length === 0) {
        setAnalyticsData([])
        return
      }

      // 2. Fetch Profiles separately (Safe way)
      const userIds = views.map((v: any) => v.user_id)
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds)

      if (pError) console.error("Profile Fetch Error:", pError)

      // 3. Fetch Likes
      const { data: likes } = await supabase
        .from('story_likes')
        .select('user_id')
        .eq('story_id', story.id)
        .in('user_id', userIds)

      const likedSet = new Set(likes?.map((l: any) => l.user_id))
      const profileMap = new Map(profiles?.map((p: any) => [p.id, p]))

      // 4. Merge Data
      const formatted = views.map((view: any) => ({
        created_at: view.created_at,
        user: profileMap.get(view.user_id),
        hasLiked: likedSet.has(view.user_id)
      }))

      setAnalyticsData(formatted)
    } catch (e) {
      console.error("Analytics Error:", e)
    }
  }

  if (!story) return null
  const stickers = story.stickers?.stickers || []
  const bgGradient = story.stickers?.background || 'bg-black'

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full h-full md:max-w-md md:h-[90vh] md:rounded-2xl overflow-hidden bg-black shadow-2xl flex flex-col">

        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 p-2 z-50 flex gap-1">
          {userStories.map((s: any, i: number) => (
            <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div className={`h-full bg-white transition-all ease-linear ${i === localIndex ? 'duration-75' : 'duration-0'}`} style={{ width: i < localIndex ? '100%' : i === localIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 p-4 z-50 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-crimson relative overflow-hidden">
              {story.profiles?.avatar_url ? <Image src={story.profiles.avatar_url} fill alt="u" unoptimized /> : <div className="w-full h-full bg-gray-500" />}
            </div>
            <div className="text-white font-bold text-sm shadow-black drop-shadow-md">{story.profiles?.username}</div>
            <div className="text-white/70 text-xs shadow-black drop-shadow-md">{timeAgo(story.created_at)}</div>
          </div>
          <div className="flex items-center gap-4">
            {isOwner && <button onClick={() => setShowDeleteConfirm(true)} className="text-white/80 hover:text-red-500 p-2 rounded-full bg-black/20 backdrop-blur-md"><Trash2 size={20} /></button>}
            <button onClick={onClose} className="text-white p-2 hover:bg-white/20 rounded-full"><X size={24} /></button>
          </div>
        </div>

        <div className="absolute inset-0 flex z-40" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)} onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)}>
          <div className="w-1/3 h-full" onClick={handlePrev} />
          <div className="w-2/3 h-full" onClick={handleNext} />
        </div>

        <div className={`flex-1 relative flex items-center justify-center overflow-hidden ${story.media_type === 'text' ? `bg-gradient-to-br ${bgGradient}` : 'bg-black'}`}>
          {story.media_type === 'image' && story.media_url && <Image src={story.media_url} fill className="object-contain" alt="Story" unoptimized priority />}
          {story.media_type === 'video' && story.media_url && <video src={story.media_url} className="w-full h-full object-contain" autoPlay playsInline onEnded={handleNext} />}
          {story.media_type === 'text' && <div className="p-8 text-center"><h1 className="text-3xl font-bold text-white leading-relaxed break-words">{story.content}</h1></div>}
          {stickers.map((s: any) => (
            <div key={s.id} className="absolute px-4 py-2 bg-white/20 backdrop-blur-md rounded-xl text-white font-bold shadow-lg flex items-center gap-2 border border-white/30 z-30" style={{ top: `${s.y}%`, left: `${s.x}%`, transform: 'translate(-50%, -50%)', color: s.color || 'white' }}>
              {s.type === 'location' && <><MapPin size={16} className="text-red-400" /> {s.content}</>}
              {s.type === 'mention' && <><User size={16} className="text-blue-400" /> {s.content}</>}
              {s.content}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-[60] flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <button onClick={toggleLike} className="flex items-center gap-2 text-white bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10 hover:bg-white/10 transition-all">
              <Heart size={20} fill={isLiked ? "red" : "none"} className={isLiked ? "text-red-500 animate-bounce" : "text-white"} />
              <span className="text-sm font-bold">{likeCount}</span>
            </button>
          </div>

          {isOwner && (
            <div onClick={openAnalytics} className="flex flex-col items-center gap-1 cursor-pointer animate-pulse">
              <ChevronUp size={20} className="text-white/70" />
              <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                <Eye size={16} className="text-white" />
                <span className="text-white font-bold text-sm">{viewCount}</span>
              </div>
            </div>
          )}

          <button className="text-white p-2"><Send size={24} /></button>
        </div>

        {/* Custom Delete Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-6 animate-in fade-in">
            <div className="bg-[#1a1a1a] p-6 rounded-3xl w-full max-w-sm text-center border border-white/10">
              <h3 className="text-white font-bold text-xl mb-2">Delete Story?</h3>
              <p className="text-gray-400 mb-6">This will permanently delete this story from your profile.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-6 py-2.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors">Cancel</button>
                <button onClick={performDelete} className="px-6 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Drawer */}
        {showAnalytics && (
          <div className="absolute inset-0 z-[70] bg-black/95 animate-in slide-in-from-bottom duration-300 flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <div className="flex flex-col">
                <h3 className="font-bold text-lg text-white">Story Activity</h3>
                <span className="text-xs text-gray-400">{viewCount} views • {likeCount} likes</span>
              </div>
              <button onClick={() => { setShowAnalytics(false); setIsPaused(false) }} className="p-2 bg-white/10 rounded-full text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {analyticsData.map((v: any, i) => (
                <div key={i} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-700 relative overflow-hidden">
                      {v.user?.avatar_url && <Image src={v.user.avatar_url} fill alt="u" unoptimized />}
                    </div>
                    <span className="text-white font-bold text-sm">{v.user?.username || "Unknown"}</span>
                  </div>
                  {v.hasLiked && <Heart size={16} className="text-red-500 fill-red-500" />}
                </div>
              ))}
              {analyticsData.length === 0 && <div className="text-center text-gray-500 mt-10">No views yet.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ... Rest of the components (PostCard, etc.) ...
// (Kept exactly same)
function StoryItem({ name, img, isAdd, onClick }: any) {
  return (
    <div onClick={onClick} className="flex flex-col items-center space-y-2 min-w-[70px] cursor-pointer group snap-center">
      <div className={`w-16 h-16 rounded-full p-[2px] ${isAdd ? 'border-2 border-dashed border-gray-300' : 'bg-gradient-to-tr from-yellow-400 via-crimson to-purple-600 group-hover:rotate-12 transition-transform duration-500'}`}>
        <div className="w-full h-full rounded-full border-2 border-white dark:border-black overflow-hidden relative bg-gray-200 dark:bg-gray-800 flex items-center justify-center transition-transform group-hover:scale-95">
          {isAdd ? <PlusSquare size={24} className="text-gray-400" /> : <Image src={img || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"} alt="story" fill className="object-cover" unoptimized />}
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
    setLikesCount((prev: number) => newIsLiked ? prev + 1 : prev - 1)

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

      {post.location && (
        <div className="px-4 pt-3 flex items-center gap-1.5 text-xs font-medium text-gray-400">
          <MapPin size={14} className="text-crimson" />
          <span>{post.location}</span>
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
                  {postDetails.profiles?.avatar_url ? <Image src={postDetails.profiles.avatar_url} fill alt="u" unoptimized /> : null}
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
              {postDetails.location && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mt-2">
                  <MapPin size={14} className="text-crimson" />
                  <span>{postDetails.location}</span>
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
        {comment.profiles?.avatar_url ? <Image src={comment.profiles.avatar_url} width={32} height={32} alt="u" className="rounded-full" unoptimized /> : comment.profiles?.username[0].toUpperCase()}
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
    <div className="flex justify-between items-start cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors"><div><div className="text-xs text-gray-500 mb-0.5">{category} • Trending</div><div className="font-bold text-sm group-hover:text-crimson transition-colors">{tag}</div><div className="text-xs text-gray-400">{posts} posts</div></div><MoreHorizontal size={16} className="text-gray-300 group-hover:text-white transition-colors" /></div>
  )
}

function ActionBtn({ icon, count }: any) {
  return (
    <button className="flex items-center gap-2 text-gray-500 hover:text-crimson transition-colors group active:scale-95"><div className="p-2 rounded-full group-hover:bg-crimson/10 transition-colors">{icon}</div>{count && <span className="text-sm font-medium">{count}</span>}</button>
  )
}