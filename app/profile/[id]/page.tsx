'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
    ArrowLeft, MapPin, Calendar, LogOut, Home, Search,
    Bell, User, Sun, Moon, Mic2, X, Edit3, Trash2, Heart, MessageCircle, AlertTriangle, Send, Camera, Loader2, Lock
} from 'lucide-react'
import { useTheme } from "next-themes"
import heic2any from "heic2any"
import imageCompression from 'browser-image-compression';

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

export default function UserProfile() {
    const { id } = useParams()
    const router = useRouter()
    const supabase = createClient()
    const { theme, setTheme } = useTheme()
    const avatarInputRef = useRef<HTMLInputElement>(null)

    // Data States
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [posts, setPosts] = useState<any[]>([])

    // Logic States
    const [followersCount, setFollowersCount] = useState(0)
    const [followingCount, setFollowingCount] = useState(0)
    const [isFollowing, setIsFollowing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)

    // Modals
    const [zoomImage, setZoomImage] = useState(false)
    const [showEditProfile, setShowEditProfile] = useState(false)
    const [selectedPost, setSelectedPost] = useState<any>(null)
    const [postToDelete, setPostToDelete] = useState<string | null>(null)
    const [showFollowers, setShowFollowers] = useState(false)
    const [showFollowing, setShowFollowing] = useState(false)
    const [followList, setFollowList] = useState<any[]>([])
    const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null)

    const isOwner = currentUser?.id === profile?.id

    useEffect(() => {
        const getData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setCurrentUser(user)

            const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', id).single()
            setProfile(userProfile)

            fetchPosts(user?.id)

            const { count: followers } = await supabase.from('follows').select('*', { count: 'exact' }).eq('following_id', id)
            const { count: following } = await supabase.from('follows').select('*', { count: 'exact' }).eq('follower_id', id)
            setFollowersCount(followers || 0)
            setFollowingCount(following || 0)

            if (user) {
                const { data: followStatus } = await supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', id).single()
                setIsFollowing(!!followStatus)
            }

            setLoading(false)
        }
        getData()
    }, [id])

    const fetchPosts = async (currentUserId?: string) => {
        const { data: userPosts } = await supabase.from('posts').select('*, likes(user_id), comments(id)').eq('user_id', id).order('created_at', { ascending: false })
        const formatted = userPosts?.map((p: any) => ({
            ...p,
            isLiked: currentUserId ? p.likes.some((l: any) => l.user_id === currentUserId) : false,
            likesCount: p.likes?.length || 0,
            commentsCount: p.comments?.length || 0
        })) || []
        setPosts(formatted)
    }

    const openFollowersList = async () => {
        const { data } = await supabase.from('follows').select('profiles!follower_id(id, username, full_name, avatar_url)').eq('following_id', id)
        const list = data?.map((item: any) => item.profiles) || []
        setFollowList(list)
        setShowFollowers(true)
    }

    const openFollowingList = async () => {
        const { data } = await supabase.from('follows').select('profiles!following_id(id, username, full_name, avatar_url)').eq('follower_id', id)
        const list = data?.map((item: any) => item.profiles) || []
        setFollowList(list)
        setShowFollowing(true)
    }

    const handleFollow = async () => {
        if (!currentUser) return router.push('/login')
        const newStatus = !isFollowing
        setIsFollowing(newStatus)
        setFollowersCount(prev => newStatus ? prev + 1 : prev - 1)

        if (newStatus) {
            await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: profile.id })
            if (currentUser.id !== profile.id) {
                await supabase.from('notifications').insert({
                    user_id: profile.id,
                    actor_id: currentUser.id,
                    type: 'follow',
                    message: 'started following you.'
                })
            }
        } else {
            await supabase.from('follows').delete().match({ follower_id: currentUser.id, following_id: profile.id })
        }
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files[0]) return;

        const originalFile = e.target.files[0];
        setUploadingAvatar(true);

        try {
            // 1. Compress & Convert
            const options = {
                maxSizeMB: 0.5,             // Profile pics can be smaller (0.5MB)
                maxWidthOrHeight: 500,      // Resize to 500px is plenty
                useWebWorker: true,
                fileType: "image/jpeg"
            };

            const compressedBlob = await imageCompression(originalFile, options);
            const compressedFile = new File([compressedBlob], originalFile.name.replace(/\.heic$/i, ".jpg"), {
                type: "image/jpeg",
            });

            // 2. Upload Logic
            const fileExt = "jpg"; // We know it's JPG now
            const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('post_images').upload(filePath, compressedFile);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('post_images').getPublicUrl(filePath);

            const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
            if (updateError) throw updateError;

            setProfile({ ...profile, avatar_url: publicUrl });

        } catch (error: any) {
            console.error(error);
            alert('Error uploading image: ' + error.message);
        } finally {
            setUploadingAvatar(false);
        }
    }
    const confirmDelete = async () => {
        if (!postToDelete) return
        const { error } = await supabase.from('posts').delete().eq('id', postToDelete)
        if (!error) {
            setPosts(posts.filter(p => p.id !== postToDelete))
            setSelectedPost(null)
            setPostToDelete(null)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const goToMyProfile = () => {
        if (currentUser?.id) {
            router.push(`/profile/${currentUser.id}`)
        } else {
            router.push('/login')
        }
    }

    const toggleLikePost = async (post: any) => {
        if (!currentUser) return
        const newIsLiked = !post.isLiked
        const updatedPost = { ...post, isLiked: newIsLiked, likesCount: newIsLiked ? post.likesCount + 1 : post.likesCount - 1 }
        setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p))
        if (selectedPost?.id === post.id) setSelectedPost(updatedPost)

        if (newIsLiked) {
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

    if (loading) return null
    if (!profile) return <div className="min-h-screen flex items-center justify-center dark:bg-[#050505] dark:text-white">User not found</div>

    return (
        <div className="min-h-screen w-full bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-white transition-colors duration-500 flex">

            <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-[280px] flex-col border-r border-gray-200 dark:border-white/5 bg-white/50 dark:bg-black/50 backdrop-blur-xl z-30">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 relative"><Image src="/logo.png" alt="Logo" fill className="object-contain" /></div>
                        <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-crimson to-nebula">DESI SANCHAR</span>
                    </div>
                    <nav className="space-y-1">
                        <NavItem icon={<Home size={26} />} text="Home" onClick={() => router.push('/')} />
                        <NavItem icon={<Search size={26} />} text="Explore" />
                        <NavItem icon={<Mic2 size={26} />} text="Karaoke Mode" />
                        <NavItem icon={<Bell size={26} />} text="Notifications" badge="3" />
                        <NavItem icon={<User size={26} />} text="Profile" onClick={goToMyProfile} active={currentUser?.id === profile.id} />
                    </nav>
                </div>
                <div className="mt-auto p-4 border-t border-gray-200 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]">
                    <div className="flex gap-2">
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 flex items-center justify-center gap-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 py-2 rounded-lg transition-colors text-xs font-bold">
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} {theme === 'dark' ? 'Light' : 'Dark'}
                        </button>
                        <button onClick={handleLogout} className="flex-1 flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-crimson py-2 rounded-lg transition-colors text-xs font-bold">
                            <LogOut size={16} /> Exit
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 min-h-screen lg:pl-[280px] relative z-10 pb-20 lg:pb-0">
                <div className="h-32 md:h-64 bg-gradient-to-r from-crimson to-purple-600 relative">
                    <button onClick={() => router.back()} className="absolute top-4 left-4 p-2 bg-black/30 rounded-full text-white hover:bg-black/50 transition-colors backdrop-blur-md">
                        <ArrowLeft size={24} />
                    </button>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                    <div className="flex flex-col items-center text-center md:flex-row md:items-end md:text-left gap-4 md:gap-6 -mt-16 md:-mt-24 mb-6">

                        {/* Profile Pic */}
                        <div className="relative group">
                            <div
                                onClick={() => !uploadingAvatar && setZoomImage(true)}
                                className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[5px] border-white dark:border-[#050505] bg-gray-200 relative shadow-2xl cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                            >
                                {profile.avatar_url ? (
                                    <Image src={profile.avatar_url} alt="Profile" fill className="object-cover" unoptimized />
                                ) : (
                                    <div className="w-full h-full bg-crimson rounded-full flex items-center justify-center text-4xl md:text-5xl text-white font-bold">{profile.username?.[0]?.toUpperCase()}</div>
                                )}

                                {uploadingAvatar && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                        <Loader2 className="animate-spin text-white" size={32} />
                                    </div>
                                )}
                            </div>

                            {isOwner && (
                                <>
                                    <button
                                        onClick={() => avatarInputRef.current?.click()}
                                        className="absolute bottom-1 right-1 md:bottom-2 md:right-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-full shadow-lg border border-gray-300 dark:border-gray-700 hover:scale-110 transition-transform text-gray-700 dark:text-white"
                                        title="Change Profile Picture"
                                    >
                                        <Camera size={20} />
                                    </button>
                                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                </>
                            )}
                        </div>

                        <div className="flex-1 mt-2 md:mt-0 md:mb-2">
                            {/* REAL NAME (Large, Dark, Permanent) */}
                            <h1 className="text-3xl md:text-4xl font-black mb-1">{profile.full_name || profile.username}</h1>

                            {/* USERNAME (Small, Gray, Editable) */}
                            <p className="text-gray-500 font-medium text-lg">@{profile.username.toLowerCase().replace(/\s/g, '')}</p>
                        </div>

                        <div className="w-full md:w-auto mb-2">
                            {isOwner ? (
                                <button onClick={() => setShowEditProfile(true)} className="w-full md:w-auto justify-center px-6 py-3 rounded-full border border-gray-300 dark:border-white/20 font-bold text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-2">
                                    <Edit3 size={16} /> Edit Profile
                                </button>
                            ) : (
                                <button onClick={handleFollow} className={`w-full md:w-auto px-8 py-3 rounded-full font-bold shadow-lg transition-all ${isFollowing ? 'bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white' : 'bg-crimson text-white'}`}>
                                    {isFollowing ? 'Following' : 'Follow'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mb-8 text-center md:text-left">
                        <p className="text-base md:text-lg leading-relaxed max-w-2xl mb-4 mx-auto md:mx-0">{profile.bio || "No bio yet."}</p>
                        <div className="flex justify-center md:justify-start flex-wrap gap-6 text-gray-500 text-sm">
                            <div className="flex items-center gap-2"><MapPin size={18} className="text-crimson" /> India</div>
                            <div className="flex items-center gap-2"><Calendar size={18} className="text-crimson" /> Joined {new Date().getFullYear()}</div>
                        </div>
                    </div>

                    <div className="flex justify-around md:justify-start md:gap-12 border-y border-gray-200 dark:border-white/10 py-4 mb-8">
                        <div className="text-center">
                            <div className="font-black text-xl">{posts.length}</div>
                            <div className="text-gray-500 text-xs font-bold mt-1">POSTS</div>
                        </div>
                        <div onClick={openFollowersList} className="text-center cursor-pointer hover:opacity-70 transition-opacity">
                            <div className="font-black text-xl">{followersCount}</div>
                            <div className="text-gray-500 text-xs font-bold mt-1">FOLLOWERS</div>
                        </div>
                        <div onClick={openFollowingList} className="text-center cursor-pointer hover:opacity-70 transition-opacity">
                            <div className="font-black text-xl">{followingCount}</div>
                            <div className="text-gray-500 text-xs font-bold mt-1">FOLLOWING</div>
                        </div>
                    </div>

                    <div className="sticky top-0 bg-gray-50 dark:bg-[#050505] z-20 py-3 mb-4 flex items-center gap-2 border-b border-gray-200 dark:border-white/5">
                        <div className="bg-black dark:bg-white w-1 h-6 rounded-full" />
                        <h3 className="font-bold text-lg">POSTS</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 pb-20">
                        {posts.map((post) => (
                            <div key={post.id} onClick={() => setSelectedPost(post)} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer group aspect-square relative">
                                {post.image_url ? (
                                    <Image src={post.image_url} alt="Post" fill className="object-cover group-hover:scale-105 transition-transform" unoptimized />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center p-4 text-center italic text-xs text-gray-500 bg-gray-100 dark:bg-white/5">"{post.content.substring(0, 40)}..."</div>
                                )}
                                <div className="hidden md:flex absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center gap-6 text-white font-bold">
                                    <div className="flex items-center gap-2"><Heart fill="white" size={20} /> {post.likesCount}</div>
                                    <div className="flex items-center gap-2"><MessageCircle fill="white" size={20} /> {post.commentsCount}</div>
                                </div>
                            </div>
                        ))}
                        {posts.length === 0 && <div className="col-span-full text-center py-10 text-gray-500">No posts yet.</div>}
                    </div>
                </div>
            </main>

            {/* === MODALS === */}

            {zoomImage && (
                <div onClick={() => setZoomImage(false)} className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4">
                    <div className="relative w-full max-w-lg aspect-square rounded-full overflow-hidden border-4 border-white/20">
                        {profile.avatar_url ? <Image src={profile.avatar_url} alt="Zoom" fill className="object-cover" unoptimized /> : <div className="w-full h-full bg-crimson" />}
                    </div>
                </div>
            )}

            {showEditProfile && (
                <EditProfileModal
                    profile={profile}
                    supabase={supabase}
                    onClose={() => setShowEditProfile(false)}
                    onUpdate={(newProfile: any) => { setProfile(newProfile); setShowEditProfile(false) }}
                />
            )}

            {selectedPost && (
                <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedPost(null)}>
                    <div className="bg-white dark:bg-[#111] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden relative">
                                    {profile.avatar_url ? <Image src={profile.avatar_url} fill alt="u" unoptimized /> : null}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-sm">{profile.username}</span>
                                    <span className="text-xs text-gray-500">{timeAgo(selectedPost.created_at)}</span>
                                </div>
                            </div>
                            {isOwner && (
                                <button onClick={() => setPostToDelete(selectedPost.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-full transition-colors">
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                        {selectedPost.image_url && (
                            <div className="relative w-full h-64 bg-black">
                                <Image src={selectedPost.image_url} fill className="object-contain" alt="post" unoptimized />
                            </div>
                        )}
                        <div className="p-6">
                            <p className="text-lg mb-4">{selectedPost.content}</p>
                            <div className="flex gap-8 border-t border-gray-100 dark:border-white/10 pt-4">
                                <button
                                    onClick={() => toggleLikePost(selectedPost)}
                                    className={`flex items-center gap-2 transition-colors ${selectedPost.isLiked ? 'text-crimson' : 'text-gray-500 hover:text-crimson'}`}
                                >
                                    <Heart fill={selectedPost.isLiked ? "currentColor" : "none"} size={26} />
                                    <span className="font-bold">{selectedPost.likesCount}</span>
                                </button>

                                <button
                                    onClick={() => setActiveCommentPostId(selectedPost.id)}
                                    className="flex items-center gap-2 text-gray-500 hover:text-blue-500 transition-colors"
                                >
                                    <MessageCircle size={26} />
                                    <span className="font-bold">{selectedPost.commentsCount}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {postToDelete && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#151515] p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-red-100 dark:border-red-900/30">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-500"><AlertTriangle size={24} /></div>
                            <h3 className="text-lg font-bold mb-2">Delete Post?</h3>
                            <p className="text-gray-500 text-sm mb-6">This action cannot be undone.</p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setPostToDelete(null)} className="flex-1 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">Cancel</button>
                                <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {(showFollowers || showFollowing) && (
                <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => { setShowFollowers(false); setShowFollowing(false) }}>
                    <div className="bg-white dark:bg-[#111] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-lg">{showFollowers ? 'Followers' : 'Following'}</h3>
                            <button onClick={() => { setShowFollowers(false); setShowFollowing(false) }} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
                            {followList.map((u: any) => (
                                <div key={u.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 p-2 rounded-xl transition-colors" onClick={() => router.push(`/profile/${u.id}`)}>
                                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden relative border border-gray-100 dark:border-white/10">
                                        {u.avatar_url ? <Image src={u.avatar_url} fill alt="u" unoptimized /> : <div className="w-full h-full bg-crimson flex items-center justify-center text-white font-bold">{u.username?.[0]?.toUpperCase()}</div>}
                                    </div>
                                    <div className="font-bold">{u.username}</div>
                                </div>
                            ))}
                            {followList.length === 0 && <div className="text-center text-gray-500 py-8">List is empty.</div>}
                        </div>
                    </div>
                </div>
            )}

            {activeCommentPostId && (
                <CommentsModal
                    postId={activeCommentPostId}
                    currentUser={currentUser}
                    onClose={() => setActiveCommentPostId(null)}
                />
            )}

        </div>
    )
}

function CommentsModal({ postId, currentUser, onClose }: any) {
    const [comments, setComments] = useState<any[]>([])
    const [newComment, setNewComment] = useState('')
    const [replyTo, setReplyTo] = useState<any>(null)
    const supabase = createClient()

    useEffect(() => { fetchComments() }, [])

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
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md h-full bg-white dark:bg-[#090909] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                    <h2 className="font-bold text-lg">Comments ({comments.length})</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {rootComments.map(comment => (
                        <div key={comment.id}>
                            <CommentItem comment={comment} onReply={(c: any) => setReplyTo(c)} />
                            <div className="pl-8 mt-3 space-y-3 border-l-2 border-gray-100 dark:border-white/5 ml-2">
                                {getReplies(comment.id).map(reply => (<CommentItem key={reply.id} comment={reply} onReply={(c: any) => setReplyTo(c)} isReply />))}
                            </div>
                        </div>
                    ))}
                    {rootComments.length === 0 && <div className="text-center text-gray-500 mt-10">No comments yet. Start the conversation!</div>}
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/40">
                    {replyTo && <div className="flex justify-between items-center text-xs text-blue-500 mb-2 px-2"><span>Replying to @{replyTo.profiles?.username}</span><button onClick={() => setReplyTo(null)}><X size={12} /></button></div>}
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

function EditProfileModal({ profile, supabase, onClose, onUpdate }: any) {
    const [username, setUsername] = useState(profile.username || '')
    const [bio, setBio] = useState(profile.bio || '')
    const [loading, setLoading] = useState(false)

    const handleSave = async () => {
        setLoading(true)
        const { error } = await supabase.from('profiles').update({ username: username, bio: bio }).eq('id', profile.id)
        if (!error) {
            onUpdate({ ...profile, username: username, bio: bio })
        } else {
            alert("Error updating profile")
        }
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#111] w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <h2 className="text-xl font-bold mb-6">Edit Profile</h2>

                {/* Real Name (Locked) */}
                <label className="block text-sm font-bold text-gray-500 mb-2">Real Name (Permanent)</label>
                <div className="relative mb-4">
                    <input value={profile.full_name || 'User'} disabled className="w-full bg-gray-200 dark:bg-white/5 text-gray-500 rounded-xl px-4 py-3 outline-none cursor-not-allowed" />
                    <Lock className="absolute right-4 top-3 text-gray-400" size={18} />
                </div>

                {/* Username (Editable) */}
                <label className="block text-sm font-bold text-gray-500 mb-2">Username / Handle</label>
                <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-gray-100 dark:bg-white/5 rounded-xl px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-crimson" />

                <label className="block text-sm font-bold text-gray-500 mb-2">Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="w-full bg-gray-100 dark:bg-white/5 rounded-xl px-4 py-3 mb-6 outline-none focus:ring-2 focus:ring-crimson resize-none" />

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-white/5">Cancel</button>
                    <button onClick={handleSave} disabled={loading} className="flex-1 py-3 rounded-xl font-bold bg-crimson text-white hover:opacity-90">{loading ? 'Saving...' : 'Save Changes'}</button>
                </div>
            </div>
        </div>
    )
}

function NavItem({ icon, text, active, badge, onClick }: any) {
    return (
        <div onClick={onClick} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all group ${active ? 'bg-crimson/10 text-crimson font-bold' : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}>
            <div className="relative">{icon}{badge && <span className="absolute -top-1 -right-1 bg-crimson text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-black">{badge}</span>}</div>
            <span className="text-xl tracking-tight">{text}</span>
        </div>
    )
}